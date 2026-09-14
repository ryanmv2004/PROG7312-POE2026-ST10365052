using SmartX.Api.Models;
using SmartX.Api.Services;

namespace SmartX.Api.Endpoints;

public static class GatewayEndpoints
{
    public static void MapGatewayEndpoints(this WebApplication app)
    {
        var api = app.MapGroup("/api");
        api.MapGet("/health", () => Results.Ok(new { status = "Healthy", utc = DateTimeOffset.UtcNow }));
        api.MapGet("/sensors", (SensorRepository repo, TelemetryService telemetry) =>
            Results.Ok(repo.All().Select(telemetry.Status)));
        api.MapGet("/sensors/{id:guid}", (Guid id, SensorRepository repo, TelemetryService telemetry) =>
            Results.Ok(telemetry.Status(repo.Get(id))));
        api.MapPost("/sensors", (RegisterSensorRequest request, SensorRepository repo) =>
        {
            var sensor = repo.Add(request);
            return Results.Created($"/api/sensors/{sensor.Id}", sensor);
        });

        api.MapPost("/sensors/{id:guid}/telemetry/temperature",
            (Guid id, TelemetryPacket<float> packet, TelemetryService telemetry) => Results.Ok(telemetry.Ingest(id, packet)));
        api.MapPost("/sensors/{id:guid}/telemetry/power",
            (Guid id, TelemetryPacket<int> packet, TelemetryService telemetry) => Results.Ok(telemetry.Ingest(id, packet)));
        api.MapPost("/sensors/{id:guid}/telemetry/switch",
            (Guid id, TelemetryPacket<bool> packet, TelemetryService telemetry) => Results.Ok(telemetry.Ingest(id, packet)));
        api.MapGet("/sensors/{id:guid}/telemetry/temperature", (Guid id, TelemetryService telemetry) =>
        {
            telemetry.RequireKind(id, ReadingKind.Temperature);
            return Results.Ok(telemetry.Temperature(id).Snapshot());
        });
        api.MapGet("/sensors/{id:guid}/telemetry/power", (Guid id, TelemetryService telemetry) =>
        {
            telemetry.RequireKind(id, ReadingKind.Power);
            return Results.Ok(telemetry.Power(id).Snapshot());
        });
        api.MapGet("/sensors/{id:guid}/telemetry/switch", (Guid id, TelemetryService telemetry) =>
        {
            telemetry.RequireKind(id, ReadingKind.Switch);
            return Results.Ok(telemetry.Switch(id).Snapshot());
        });

        api.MapGet("/sensors/{id:guid}/attachments", async (Guid id, SensorRepository repo, AttachmentStore files) =>
        {
            repo.Get(id);
            return Results.Ok(await files.List(id));
        });
        // Explicit multipart reading: no inferred IFormFile binding or cookie authentication.
        // Local-only API; same-origin header check in Program.cs protects browser writes.
        api.MapPost("/sensors/{id:guid}/attachments", async (Guid id, HttpRequest request,
            SensorRepository repo, AttachmentStore files, CancellationToken ct) =>
        {
            repo.Get(id);
            if (!request.HasFormContentType) throw new GatewayException(400, "Use multipart/form-data.");
            var form = await request.ReadFormAsync(ct);
            if (form.Files.Count != 1 || form.Files[0].Name != "file")
                throw new GatewayException(400, "Provide exactly one upload using the field name 'file'.");
            var item = await files.Add(id, form.Files[0], ct);
            return Results.Created($"/api/sensors/{id}/attachments/{item.Id}", item);
        });
        api.MapGet("/sensors/{id:guid}/attachments/{attachmentId:guid}",
            async (Guid id, Guid attachmentId, SensorRepository repo, AttachmentStore files) =>
        {
            repo.Get(id);
            var file = await files.Download(id, attachmentId);
            return Results.File(file.Path, "application/octet-stream", file.Name);
        });
    }
}
