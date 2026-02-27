using NeedlepointApp.API.Models;
using NeedlepointApp.API.Services;

namespace NeedlepointApp.API.Endpoints;

public static class PatternEndpoints
{
    public static void MapPatternEndpoints(this WebApplication app)
    {
        // Convert an uploaded image to a needlepoint pattern
        app.MapPost("/api/patterns/convert", (ConvertImageRequest req, QuantizationService quant) =>
        {
            try
            {
                var imageBytes = Convert.FromBase64String(req.ImageBase64);
                var result = quant.Convert(imageBytes, req.TargetWidth, req.TargetHeight, req.ColorCount, req.Dithering);
                return Results.Ok(result);
            }
            catch (Exception ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // Return the DMC color database
        app.MapGet("/api/colors/dmc", () =>
        {
            return Results.Ok(DmcDatabase.Colors.Select(c => new
            {
                number = c.Number,
                name = c.Name,
                r = c.R,
                g = c.G,
                b = c.B,
                hex = c.Hex,
            }));
        });
    }
}
