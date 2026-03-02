using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;
using NeedlepointApp.API.Models;

namespace NeedlepointApp.API.Services;

/// <summary>
/// Converts an image (base64 PNG/JPG) into a needlepoint pattern grid.
/// Pipeline:
///   1. Decode image
///   2. Resize to target stitch dimensions
///   3. K-means clustering to reduce to N colors
///   4. Dithering (Floyd-Steinberg, ordered Bayer 4×4, or none)
///   5. Match each cluster to nearest DMC color (Delta-E CIE2000)
///   6. Build grid
/// </summary>
public class QuantizationService
{
    private const int KMeansIterations = 20;

    // Bayer 4×4 ordered dithering matrix
    private static readonly int[,] Bayer4x4 = {
        {  0,  8,  2, 10 },
        { 12,  4, 14,  6 },
        {  3, 11,  1,  9 },
        { 15,  7, 13,  5 },
    };

    public ConvertImageResponse Convert(
        byte[] imageBytes,
        int targetWidth,
        int targetHeight,
        int colorCount,
        bool dithering,
        string ditherMode = "floyd-steinberg",
        string[]? allowedDmcNumbers = null)
    {
        using var img = Image.Load<Rgb24>(imageBytes);
        img.Mutate(x => x.Resize(targetWidth, targetHeight));

        // Extract pixel data
        var pixels = new Rgb24[targetWidth * targetHeight];
        img.CopyPixelDataTo(pixels);

        // K-means clustering
        var palette = KMeans(pixels, colorCount);

        // Map each pixel to nearest palette entry using selected dithering method
        int[] assignments;
        var effectiveMode = ditherMode ?? (dithering ? "floyd-steinberg" : "none");
        switch (effectiveMode)
        {
            case "floyd-steinberg":
                assignments = FloydSteinbergDither(pixels, palette, targetWidth, targetHeight);
                break;
            case "ordered":
                assignments = OrderedDither(pixels, palette, targetWidth, targetHeight);
                break;
            default: // "none"
                assignments = pixels.Select(p => FindNearest(palette, p)).ToArray();
                break;
        }

        // Match palette entries to DMC colors (optionally constrained)
        DmcColor[] dmcPalette;
        double[] dmcDeltaEs;
        if (allowedDmcNumbers is { Length: > 0 })
        {
            var allowed = DmcDatabase.Colors.Where(c => allowedDmcNumbers.Contains(c.Number)).ToArray();
            if (allowed.Length > 0)
            {
                var matches = palette.Select(p => DmcDatabase.FindNearestWithDeltaE(p.R, p.G, p.B, allowed)).ToArray();
                dmcPalette = matches.Select(m => m.Color).ToArray();
                dmcDeltaEs = matches.Select(m => m.DeltaE).ToArray();
            }
            else
            {
                var matches = palette.Select(p => DmcDatabase.FindNearestWithDeltaE(p.R, p.G, p.B)).ToArray();
                dmcPalette = matches.Select(m => m.Color).ToArray();
                dmcDeltaEs = matches.Select(m => m.DeltaE).ToArray();
            }
        }
        else
        {
            var matches = palette.Select(p => DmcDatabase.FindNearestWithDeltaE(p.R, p.G, p.B)).ToArray();
            dmcPalette = matches.Select(m => m.Color).ToArray();
            dmcDeltaEs = matches.Select(m => m.DeltaE).ToArray();
        }

        // Build grid
        var cells = new Dictionary<string, StitchCell>();
        var stitchCounts = new Dictionary<string, int>();

        for (int row = 0; row < targetHeight; row++)
        {
            for (int col = 0; col < targetWidth; col++)
            {
                int idx = row * targetWidth + col;
                var dmc = dmcPalette[assignments[idx]];
                cells[$"{row},{col}"] = new StitchCell(dmc.Hex, dmc.Number, "tent");
                stitchCounts.TryAdd(dmc.Number, 0);
                stitchCounts[dmc.Number]++;
            }
        }

        // Track deltaE per DMC number (take worst/max for each unique number)
        var deltaEByDmc = new Dictionary<string, double>();
        for (int i = 0; i < dmcPalette.Length; i++)
        {
            var num = dmcPalette[i].Number;
            if (!deltaEByDmc.ContainsKey(num) || dmcDeltaEs[i] > deltaEByDmc[num])
                deltaEByDmc[num] = dmcDeltaEs[i];
        }

        var usedColors = stitchCounts
            .Select(kv =>
            {
                var dmc = DmcDatabase.Colors.First(c => c.Number == kv.Key);
                var de = deltaEByDmc.GetValueOrDefault(kv.Key, 0);
                return new UsedColor(dmc.Number, dmc.Name, dmc.Hex, kv.Value, Math.Round(de, 2));
            })
            .OrderByDescending(c => c.StitchCount)
            .ToList();

        return new ConvertImageResponse(
            new PatternGrid(targetWidth, targetHeight, cells),
            usedColors
        );
    }

    private static Rgb24[] KMeans(Rgb24[] pixels, int k)
    {
        var rng = new Random(42);

        // Initialize centroids by randomly sampling pixels
        var centroids = pixels
            .OrderBy(_ => rng.Next())
            .Take(k)
            .Select(p => new double[] { p.R, p.G, p.B })
            .ToArray();

        int[] assignments = new int[pixels.Length];

        for (int iter = 0; iter < KMeansIterations; iter++)
        {
            // Assign each pixel to nearest centroid
            bool changed = false;
            for (int i = 0; i < pixels.Length; i++)
            {
                int nearest = FindNearestCentroid(centroids, pixels[i]);
                if (nearest != assignments[i]) { assignments[i] = nearest; changed = true; }
            }
            if (!changed && iter > 0) break;

            // Recompute centroids
            var sums = new double[k][];
            var counts = new int[k];
            for (int j = 0; j < k; j++) sums[j] = new double[3];

            for (int i = 0; i < pixels.Length; i++)
            {
                int c = assignments[i];
                sums[c][0] += pixels[i].R;
                sums[c][1] += pixels[i].G;
                sums[c][2] += pixels[i].B;
                counts[c]++;
            }

            for (int j = 0; j < k; j++)
            {
                if (counts[j] > 0)
                {
                    centroids[j][0] = sums[j][0] / counts[j];
                    centroids[j][1] = sums[j][1] / counts[j];
                    centroids[j][2] = sums[j][2] / counts[j];
                }
            }
        }

        return centroids.Select(c => new Rgb24((byte)c[0], (byte)c[1], (byte)c[2])).ToArray();
    }

    private static int[] FloydSteinbergDither(Rgb24[] pixels, Rgb24[] palette, int width, int height)
    {
        var err = new float[pixels.Length, 3]; // error buffer
        var result = new int[pixels.Length];

        for (int row = 0; row < height; row++)
        {
            for (int col = 0; col < width; col++)
            {
                int idx = row * width + col;
                var p = pixels[idx];

                float r = Math.Clamp(p.R + err[idx, 0], 0, 255);
                float g = Math.Clamp(p.G + err[idx, 1], 0, 255);
                float b = Math.Clamp(p.B + err[idx, 2], 0, 255);

                var adjusted = new Rgb24((byte)r, (byte)g, (byte)b);
                int nearest = FindNearest(palette, adjusted);
                result[idx] = nearest;

                float er = r - palette[nearest].R;
                float eg = g - palette[nearest].G;
                float eb = b - palette[nearest].B;

                // Distribute error to neighbors (Floyd-Steinberg coefficients)
                void AddErr(int ni, float factor)
                {
                    if (ni >= 0 && ni < pixels.Length)
                    {
                        err[ni, 0] += er * factor;
                        err[ni, 1] += eg * factor;
                        err[ni, 2] += eb * factor;
                    }
                }

                AddErr(idx + 1, 7f / 16f);
                AddErr(idx + width - 1, 3f / 16f);
                AddErr(idx + width, 5f / 16f);
                AddErr(idx + width + 1, 1f / 16f);
            }
        }

        return result;
    }

    private static int[] OrderedDither(Rgb24[] pixels, Rgb24[] palette, int width, int height)
    {
        // Find max inter-centroid distance for scaling
        double maxDist = 0;
        for (int i = 0; i < palette.Length; i++)
        {
            for (int j = i + 1; j < palette.Length; j++)
            {
                double dr = palette[i].R - palette[j].R;
                double dg = palette[i].G - palette[j].G;
                double db = palette[i].B - palette[j].B;
                maxDist = Math.Max(maxDist, Math.Sqrt(dr * dr + dg * dg + db * db));
            }
        }
        double spread = Math.Max(16, maxDist * 0.25);

        var result = new int[pixels.Length];

        for (int row = 0; row < height; row++)
        {
            for (int col = 0; col < width; col++)
            {
                int idx = row * width + col;
                var p = pixels[idx];

                // Bayer threshold normalized to [-0.5, +0.5]
                double threshold = (Bayer4x4[row % 4, col % 4] / 16.0) - 0.5;

                var adjusted = new Rgb24(
                    (byte)Math.Clamp(Math.Round(p.R + threshold * spread), 0, 255),
                    (byte)Math.Clamp(Math.Round(p.G + threshold * spread), 0, 255),
                    (byte)Math.Clamp(Math.Round(p.B + threshold * spread), 0, 255)
                );

                result[idx] = FindNearest(palette, adjusted);
            }
        }

        return result;
    }

    private static int FindNearest(Rgb24[] palette, Rgb24 pixel)
    {
        int best = 0;
        long minDist = long.MaxValue;
        for (int i = 0; i < palette.Length; i++)
        {
            long dr = palette[i].R - pixel.R;
            long dg = palette[i].G - pixel.G;
            long db = palette[i].B - pixel.B;
            long dist = dr * dr + dg * dg + db * db;
            if (dist < minDist) { minDist = dist; best = i; }
        }
        return best;
    }

    private static int FindNearestCentroid(double[][] centroids, Rgb24 pixel)
    {
        int best = 0;
        double minDist = double.MaxValue;
        for (int i = 0; i < centroids.Length; i++)
        {
            double dr = centroids[i][0] - pixel.R;
            double dg = centroids[i][1] - pixel.G;
            double db = centroids[i][2] - pixel.B;
            double dist = dr * dr + dg * dg + db * db;
            if (dist < minDist) { minDist = dist; best = i; }
        }
        return best;
    }
}
