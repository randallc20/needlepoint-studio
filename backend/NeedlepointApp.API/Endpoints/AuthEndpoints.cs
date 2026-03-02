using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
using NeedlepointApp.API.Data;

namespace NeedlepointApp.API.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this WebApplication app)
    {
        var auth = app.MapGroup("/api/auth");

        // POST /api/auth/login
        auth.MapPost("/login", async (LoginRequest req, AppDbContext db, HttpContext ctx) =>
        {
            var user = await db.Users.FirstOrDefaultAsync(u => u.Username == req.Username);
            if (user == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
                return Results.Unauthorized();

            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new(ClaimTypes.Name, user.Username),
                new("DisplayName", user.DisplayName),
                new("IsAdmin", user.IsAdmin.ToString()),
            };
            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            await ctx.SignInAsync(
                CookieAuthenticationDefaults.AuthenticationScheme,
                new ClaimsPrincipal(identity),
                new AuthenticationProperties { IsPersistent = true, ExpiresUtc = DateTimeOffset.UtcNow.AddDays(30) });

            return Results.Ok(new { user.Username, user.DisplayName, user.IsAdmin });
        });

        // POST /api/auth/logout
        auth.MapPost("/logout", async (HttpContext ctx) =>
        {
            await ctx.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Results.Ok();
        });

        // GET /api/auth/me
        auth.MapGet("/me", (HttpContext ctx) =>
        {
            if (ctx.User.Identity?.IsAuthenticated != true)
                return Results.Unauthorized();

            return Results.Ok(new
            {
                Username = ctx.User.FindFirst(ClaimTypes.Name)?.Value,
                DisplayName = ctx.User.FindFirst("DisplayName")?.Value,
                IsAdmin = ctx.User.FindFirst("IsAdmin")?.Value == "True",
            });
        });

        // GET /api/auth/users (admin only — list all users)
        auth.MapGet("/users", async (AppDbContext db, HttpContext ctx) =>
        {
            if (ctx.User.FindFirst("IsAdmin")?.Value != "True")
                return Results.Forbid();

            var users = await db.Users
                .OrderBy(u => u.Username)
                .Select(u => new { u.Id, u.Username, u.DisplayName, u.IsAdmin, u.CreatedAt })
                .ToListAsync();
            return Results.Ok(users);
        }).RequireAuthorization();

        // POST /api/auth/users (admin only — create user)
        auth.MapPost("/users", async (CreateUserRequest req, AppDbContext db, HttpContext ctx) =>
        {
            if (ctx.User.FindFirst("IsAdmin")?.Value != "True")
                return Results.Forbid();

            if (await db.Users.AnyAsync(u => u.Username == req.Username))
                return Results.Conflict(new { error = "Username already exists" });

            var user = new User
            {
                Username = req.Username,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
                DisplayName = req.DisplayName,
                IsAdmin = req.IsAdmin,
            };
            db.Users.Add(user);
            await db.SaveChangesAsync();
            return Results.Created($"/api/auth/users/{user.Id}",
                new { user.Id, user.Username, user.DisplayName, user.IsAdmin });
        }).RequireAuthorization();

        // DELETE /api/auth/users/{id} (admin only — delete user)
        auth.MapDelete("/users/{id:int}", async (int id, AppDbContext db, HttpContext ctx) =>
        {
            if (ctx.User.FindFirst("IsAdmin")?.Value != "True")
                return Results.Forbid();

            var currentUserId = int.Parse(ctx.User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            if (id == currentUserId)
                return Results.BadRequest(new { error = "Cannot delete your own account" });

            var user = await db.Users.FindAsync(id);
            if (user == null) return Results.NotFound();

            db.Users.Remove(user);
            await db.SaveChangesAsync();
            return Results.Ok();
        }).RequireAuthorization();

        // PUT /api/auth/users/{id}/password (admin only — reset password)
        auth.MapPut("/users/{id:int}/password", async (int id, ResetPasswordRequest req, AppDbContext db, HttpContext ctx) =>
        {
            if (ctx.User.FindFirst("IsAdmin")?.Value != "True")
                return Results.Forbid();

            var user = await db.Users.FindAsync(id);
            if (user == null) return Results.NotFound();

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
            await db.SaveChangesAsync();
            return Results.Ok();
        }).RequireAuthorization();

        // PUT /api/auth/change-password (any user — change own password)
        auth.MapPut("/change-password", async (ChangePasswordRequest req, AppDbContext db, HttpContext ctx) =>
        {
            var userId = int.Parse(ctx.User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var user = await db.Users.FindAsync(userId);
            if (user == null) return Results.NotFound();

            if (!BCrypt.Net.BCrypt.Verify(req.CurrentPassword, user.PasswordHash))
                return Results.BadRequest(new { error = "Current password is incorrect" });

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
            await db.SaveChangesAsync();
            return Results.Ok();
        }).RequireAuthorization();
    }
}

public record LoginRequest(string Username, string Password);
public record CreateUserRequest(string Username, string Password, string DisplayName, bool IsAdmin = false);
public record ResetPasswordRequest(string NewPassword);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
