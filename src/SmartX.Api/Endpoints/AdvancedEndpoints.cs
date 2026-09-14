using SmartX.Api.Models;
using SmartX.Api.Services;

namespace SmartX.Api.Endpoints;

public static class AdvancedEndpoints
{
    public static void MapAdvancedEndpoints(this WebApplication app)
    {
        var api = app.MapGroup("/api");
        api.MapGet("/meters/{aId:guid}/compare/{bId:guid}",
            (Guid aId, Guid bId, MeterComparisonService service) => Results.Ok(service.Compare(aId, bId)));
        api.MapPost("/sensors/{id:guid}/telemetry/temperature/batches",
            (Guid id, HistoricalBatchRequest<float> request, HistoricalBatchService service) => Results.Ok(service.Ingest(id, request)));
        api.MapPost("/sensors/{id:guid}/telemetry/power/batches",
            (Guid id, HistoricalBatchRequest<int> request, HistoricalBatchService service) => Results.Ok(service.Ingest(id, request)));
        api.MapPost("/sensors/{id:guid}/telemetry/switch/batches",
            (Guid id, HistoricalBatchRequest<bool> request, HistoricalBatchService service) => Results.Ok(service.Ingest(id, request)));
        api.MapGet("/deployment", (DeploymentStore store) => Results.Ok(store.Load()));
        // Validation is an operation: HTTP 200 contains isValid=false and path-specific errors.
        api.MapPost("/deployment/validate", (DeploymentRequest request, DeploymentValidator validator) =>
            Results.Ok(validator.Validate(request.Root)));
        api.MapPost("/deployment", (DeploymentRequest request, DeploymentStore store) =>
        {
            var result = store.Save(request);
            return Results.Json(result, statusCode: result.IsValid ? 200 : 400);
        });
    }
}
