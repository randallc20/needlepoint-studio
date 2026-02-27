namespace NeedlepointApp.API.Models;

public record DmcColor(string Number, string Name, int R, int G, int B)
{
    public string Hex => $"#{R:x2}{G:x2}{B:x2}";
}

public record StitchCell(string Color, string? DmcNumber, string StitchType);

public record PatternGrid(int Width, int Height, Dictionary<string, StitchCell> Cells);

public record ChatRequest(string Message, List<ChatHistoryItem> History);

public record ChatHistoryItem(string Role, string Content);

public record ConvertImageRequest(string ImageBase64, int TargetWidth, int TargetHeight, int ColorCount, bool Dithering);

public record ConvertImageResponse(PatternGrid Pattern, List<UsedColor> Colors);

public record UsedColor(string DmcNumber, string Name, string Hex, int StitchCount);

public record AiGenerateRequest(string Prompt, int TargetWidth, int TargetHeight, int ColorCount);
