using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
using NeedlepointApp.API.Data;
using NeedlepointApp.API.Endpoints;
using NeedlepointApp.API.Services;

var builder = WebApplication.CreateBuilder(args);

// ── Database ─────────────────────────────────────────────────────────────────
var dbFolder = builder.Environment.IsProduction()
    ? Path.Combine(Environment.GetEnvironmentVariable("HOME") ?? ".", "data")
    : ".";
Directory.CreateDirectory(dbFolder);
var dbPath = Path.Combine(dbFolder, "needlepoint.db");

builder.Services.AddDbContext<AppDbContext>(opts =>
    opts.UseSqlite($"Data Source={dbPath}"));

// ── Authentication ───────────────────────────────────────────────────────────
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(opts =>
    {
        opts.Cookie.Name = "NPS_Auth";
        opts.Cookie.HttpOnly = true;
        opts.Cookie.SameSite = SameSiteMode.Strict;
        opts.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        opts.ExpireTimeSpan = TimeSpan.FromDays(30);
        opts.SlidingExpiration = true;
        opts.Events.OnRedirectToLogin = ctx =>
        {
            ctx.Response.StatusCode = 401;
            return Task.CompletedTask;
        };
    });
builder.Services.AddAuthorization();

// ── Services ─────────────────────────────────────────────────────────────────
if (builder.Environment.IsDevelopment())
{
    builder.Services.AddCors(opts =>
        opts.AddDefaultPolicy(p =>
            p.WithOrigins("http://localhost:5173")
             .AllowAnyHeader()
             .AllowAnyMethod()
             .AllowCredentials()));
}

builder.Services.AddSingleton<QuantizationService>();
builder.Services.AddScoped<AIService>();
builder.Services.AddEndpointsApiExplorer();

// ── App ──────────────────────────────────────────────────────────────────────
var app = builder.Build();

// Apply migrations and seed admin user on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
    if (!db.Users.Any())
    {
        db.Users.Add(new User
        {
            Username = "admin",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("changeme"),
            DisplayName = "Admin",
            IsAdmin = true,
        });
        db.SaveChanges();
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseCors();
}

// Azure App Service runs behind a TLS-terminating load balancer
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor
                     | Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto
});

// Serve the Vite-built frontend from wwwroot/
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();

// Register endpoint modules
app.MapAuthEndpoints();
app.MapAIEndpoints();
app.MapPatternEndpoints();

// SPA fallback: any non-API, non-file route returns index.html
app.MapFallbackToFile("index.html");

app.Run();
