using NeedlepointApp.API.Endpoints;
using NeedlepointApp.API.Services;

var builder = WebApplication.CreateBuilder(args);

// ── Services ──────────────────────────────────────────────────────────────────

builder.Services.AddCors(opts =>
    opts.AddDefaultPolicy(p =>
        p.WithOrigins("http://localhost:5173")
         .AllowAnyHeader()
         .AllowAnyMethod()
         .AllowCredentials()));

// App services
builder.Services.AddSingleton<QuantizationService>();
builder.Services.AddScoped<AIService>();

builder.Services.AddEndpointsApiExplorer();

// ── App ────────────────────────────────────────────────────────────────────────

var app = builder.Build();

app.UseCors();

// Register endpoint modules
app.MapAIEndpoints();
app.MapPatternEndpoints();

app.Run();
