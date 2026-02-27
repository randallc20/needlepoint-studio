using System.Text;
using System.Text.Json;
using NeedlepointApp.API.Models;
using NeedlepointApp.API.Services;

namespace NeedlepointApp.API.Endpoints;

public static class AIEndpoints
{
    public static void MapAIEndpoints(this WebApplication app)
    {
        // SSE streaming chat endpoint
        app.MapPost("/api/ai/chat", async (HttpContext ctx, AIService ai, ChatRequest req) =>
        {
            ctx.Response.Headers["Content-Type"] = "text/event-stream";
            ctx.Response.Headers["Cache-Control"] = "no-cache";
            ctx.Response.Headers["Connection"] = "keep-alive";
            ctx.Response.Headers["Access-Control-Allow-Origin"] = "*";

            async Task Send(string data)
            {
                await ctx.Response.WriteAsync($"data: {data}\n\n");
                await ctx.Response.Body.FlushAsync();
            }

            try
            {
                await foreach (var chunk in ai.StreamChatAsync(req.Message, req.History))
                {
                    var json = JsonSerializer.Serialize(new
                    {
                        type = chunk.Type,
                        content = chunk.Content,
                        step = chunk.Step,
                        message = chunk.Message,
                        pattern = chunk.Pattern,
                    }, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });

                    await Send(json);
                }
            }
            catch (Exception ex)
            {
                await Send(JsonSerializer.Serialize(new { type = "error", content = ex.Message }));
            }

            await Send("[DONE]");
        });
    }
}
