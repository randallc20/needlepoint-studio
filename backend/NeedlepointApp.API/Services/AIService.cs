using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using NeedlepointApp.API.Models;

namespace NeedlepointApp.API.Services;

/// <summary>
/// Orchestrates the AI pipeline using raw HTTP calls:
///   - Anthropic Claude API for chat + prompt refinement
///   - OpenAI DALL-E 3 API for image generation
///   - QuantizationService for image-to-pattern conversion
/// </summary>
public class AIService
{
    private readonly HttpClient _http;
    private readonly QuantizationService _quantization;
    private readonly ILogger<AIService> _logger;
    private readonly string _anthropicKey;
    private readonly string _openaiKey;

    private const string BaseSystemPrompt = """
        You are an expert needlepoint designer and teacher named Stitch, integrated into NeedlePoint Studio.

        Your expertise covers:
        - Needlepoint design, composition, and color theory
        - Stitch types: tent, continental, basketweave, long stitch, backstitch, French knot
        - Canvas types and mesh counts (10, 13, 14, 18, 22-count)
        - DMC, Anchor, and Madeira thread brands and color selection
        - Converting images and ideas into grid-based needlepoint patterns
        - Beginner guidance and advanced technique advice

        When the user describes a design they want to create, respond with a brief description of what you'll make, then a JSON block in this format:
        GENERATE_PATTERN: {"imagePrompt": "your optimized DALL-E prompt here"}

        When creating DALL-E prompts for needlepoint patterns:
        - Always include: "flat graphic illustration, bold outlines, limited color palette"
        - Always include: "no gradients, no photorealism, solid color regions"
        - Always include: "suitable for grid-based needlepoint pattern"
        - For small canvases (<100 stitches wide): "very simple design, large shapes, minimal detail"
        - For large canvases (>200 stitches wide): "can include fine detail and smaller elements"
        - Good contrast between elements

        When the user asks to refine or modify a previous design ("make it more blue", "add a border", etc.),
        create a new GENERATE_PATTERN with a modified prompt that incorporates their feedback.

        When the user asks questions about needlepoint (not requesting a design), just answer conversationally.
        """;

    private static string BuildSystemPrompt(int canvasWidth, int canvasHeight, int meshCount, int colorCount, string[]? paletteConstraint)
    {
        var sb = new StringBuilder(BaseSystemPrompt);
        var physW = (double)canvasWidth / meshCount;
        var physH = (double)canvasHeight / meshCount;
        sb.AppendLine();
        sb.AppendLine($"The user's canvas is {canvasWidth}x{canvasHeight} stitches ({meshCount}-count mesh).");
        sb.AppendLine($"Physical size: {physW:F1}\" x {physH:F1}\".");
        sb.AppendLine($"Target color count: {colorCount} DMC colors.");
        sb.AppendLine($"Include \"{colorCount} distinct colors maximum\" in DALL-E prompts.");
        if (paletteConstraint is { Length: > 0 })
        {
            sb.AppendLine($"IMPORTANT: The user wants to use only these DMC colors: {string.Join(", ", paletteConstraint)}");
            sb.AppendLine("Describe the design using colors close to these thread colors.");
        }
        return sb.ToString();
    }

    public AIService(IConfiguration config, QuantizationService quantization, ILogger<AIService> logger)
    {
        _http = new HttpClient();
        _quantization = quantization;
        _logger = logger;
        _anthropicKey = config["Anthropic:ApiKey"]
            ?? Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY")
            ?? throw new InvalidOperationException("ANTHROPIC_API_KEY not set");
        _openaiKey = config["OpenAI:ApiKey"]
            ?? Environment.GetEnvironmentVariable("OPENAI_API_KEY")
            ?? throw new InvalidOperationException("OPENAI_API_KEY not set");
    }

    public async IAsyncEnumerable<AiStreamChunk> StreamChatAsync(
        string userMessage,
        List<ChatHistoryItem> history,
        int targetWidth = 80,
        int targetHeight = 60,
        int colorCount = 25,
        bool dithering = true,
        int meshCount = 18,
        string[]? paletteConstraint = null)
    {
        // Build messages array for Claude
        var messages = new JsonArray();
        foreach (var h in history)
        {
            messages.Add(new JsonObject
            {
                ["role"] = h.Role,
                ["content"] = h.Content,
            });
        }
        messages.Add(new JsonObject
        {
            ["role"] = "user",
            ["content"] = userMessage,
        });

        var systemPrompt = BuildSystemPrompt(targetWidth, targetHeight, meshCount, colorCount, paletteConstraint);

        var requestBody = new JsonObject
        {
            ["model"] = "claude-sonnet-4-20250514",
            ["max_tokens"] = 1024,
            ["system"] = systemPrompt,
            ["stream"] = true,
            ["messages"] = messages,
        };

        var request = new HttpRequestMessage(HttpMethod.Post, "https://api.anthropic.com/v1/messages")
        {
            Content = new StringContent(requestBody.ToJsonString(), Encoding.UTF8, "application/json"),
        };
        request.Headers.Add("x-api-key", _anthropicKey);
        request.Headers.Add("anthropic-version", "2023-06-01");

        var response = await _http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode();

        var fullText = new StringBuilder();
        using var stream = await response.Content.ReadAsStreamAsync();
        using var reader = new StreamReader(stream);

        // Collect streamed text chunks
        var textChunks = new List<AiStreamChunk>();
        while (!reader.EndOfStream)
        {
            var line = await reader.ReadLineAsync();
            if (line == null) continue;
            if (!line.StartsWith("data: ")) continue;
            var data = line[6..];
            if (data == "[DONE]") break;

            var parsed = ParseStreamEvent(data);
            if (parsed != null)
            {
                fullText.Append(parsed);
                yield return new AiStreamChunk("text", parsed, null, null);
            }
        }

        // Check if response contains a pattern generation request
        var responseText = fullText.ToString();
        var imagePrompt = ExtractImagePrompt(responseText);
        if (imagePrompt == null) yield break;

        // DALL-E 3 image generation
        yield return new AiStreamChunk("status", "Generating image with DALL-E 3...", "generating-image", "Generating image...");

        var imageBytes = await GenerateImageSafeAsync(imagePrompt);
        if (imageBytes == null)
        {
            yield return new AiStreamChunk("text", "\n\nSorry, image generation failed. Please try again.", null, null);
            yield break;
        }

        // Pattern conversion
        yield return new AiStreamChunk("status", "Converting to needlepoint pattern...", "converting", "Converting to needlepoint...");

        var result = ConvertPatternSafe(imageBytes, targetWidth, targetHeight, colorCount, dithering, paletteConstraint);
        if (result == null)
        {
            yield return new AiStreamChunk("text", "\n\nSorry, pattern conversion failed. Please try again.", null, null);
            yield break;
        }

        yield return new AiStreamChunk("pattern_ready", null, "done", "Pattern loaded onto canvas!")
        {
            Pattern = result,
        };

        var summary =
            $"\n\nI've generated your needlepoint pattern! It uses **{result.Colors.Count} DMC colors** across a **{targetWidth}x{targetHeight}** grid. " +
            $"Your top colors are: {string.Join(", ", result.Colors.Take(3).Select(c => $"DMC {c.DmcNumber} ({c.Name})"))}.\n\n" +
            "The pattern is now on your canvas. You can paint over any cells, adjust colors, or ask me to refine it!";
        yield return new AiStreamChunk("text", summary, null, null);
    }

    private static string? ParseStreamEvent(string data)
    {
        try
        {
            var evt = JsonDocument.Parse(data);
            var type = evt.RootElement.GetProperty("type").GetString();
            if (type != "content_block_delta") return null;
            var delta = evt.RootElement.GetProperty("delta");
            if (delta.GetProperty("type").GetString() != "text_delta") return null;
            return delta.GetProperty("text").GetString() ?? "";
        }
        catch { return null; }
    }

    private static string? ExtractImagePrompt(string responseText)
    {
        var genIndex = responseText.IndexOf("GENERATE_PATTERN:");
        if (genIndex < 0) return null;
        var jsonStart = responseText.IndexOf('{', genIndex);
        if (jsonStart < 0) return null;
        var jsonEnd = responseText.IndexOf('}', jsonStart) + 1;
        if (jsonEnd <= jsonStart) return null;
        try
        {
            var genJson = JsonDocument.Parse(responseText[jsonStart..jsonEnd]);
            return genJson.RootElement.GetProperty("imagePrompt").GetString();
        }
        catch { return null; }
    }

    private async Task<byte[]?> GenerateImageSafeAsync(string prompt)
    {
        try { return await GenerateImageAsync(prompt); }
        catch (Exception ex) { _logger.LogError(ex, "DALL-E generation failed"); return null; }
    }

    private ConvertImageResponse? ConvertPatternSafe(byte[] imageBytes, int w, int h, int colors, bool dither, string[]? paletteConstraint = null)
    {
        try { return _quantization.Convert(imageBytes, w, h, colors, dither, allowedDmcNumbers: paletteConstraint); }
        catch (Exception ex) { _logger.LogError(ex, "Pattern conversion failed"); return null; }
    }

    private async Task<byte[]> GenerateImageAsync(string prompt)
    {
        var requestBody = new JsonObject
        {
            ["model"] = "dall-e-3",
            ["prompt"] = prompt,
            ["n"] = 1,
            ["size"] = "1024x1024",
            ["quality"] = "standard",
            ["response_format"] = "b64_json",
        };

        var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/images/generations")
        {
            Content = new StringContent(requestBody.ToJsonString(), Encoding.UTF8, "application/json"),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _openaiKey);

        var response = await _http.SendAsync(request);
        response.EnsureSuccessStatusCode();

        var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        var b64 = json.RootElement.GetProperty("data")[0].GetProperty("b64_json").GetString()!;
        return Convert.FromBase64String(b64);
    }
}

public class AiStreamChunk(string Type, string? Content, string? Step, string? Message)
{
    public string Type { get; } = Type;
    public string? Content { get; } = Content;
    public string? Step { get; } = Step;
    public string? Message { get; } = Message;
    public ConvertImageResponse? Pattern { get; init; }
}
