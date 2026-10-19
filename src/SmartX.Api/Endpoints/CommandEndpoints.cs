using SmartX.Api.Models;
using SmartX.Api.Services;

namespace SmartX.Api.Endpoints;

public static class CommandEndpoints
{
    public static void MapCommandEndpoints(this WebApplication app)
    {
        var api = app.MapGroup("/api/commands");
        api.MapGet("/dashboard", (CommandStreamService service) => Results.Ok(service.Dashboard()));
        api.MapGet("/stats", (CommandStreamService service) => Results.Ok(service.Stats()));
        api.MapPost("/", (DeviceCommandRequest request, CommandStreamService service) => Results.Ok(service.Send(request)));
        api.MapPost("/undo", (CommandStreamService service) =>
        {
            var result = service.Undo();
            return result is null ? Results.NotFound(new { detail = "There are no commands to undo." }) : Results.Ok(result);
        });
    }
}
