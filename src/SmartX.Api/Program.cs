using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http.Features;
using SmartX.Api.Endpoints;
using SmartX.Api.Models;
using SmartX.Api.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddProblemDetails();
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter(allowIntegerValues: false));
    options.SerializerOptions.NumberHandling = JsonNumberHandling.Strict;
    options.SerializerOptions.UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow;
});
builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = AttachmentStore.MaxFileBytes + 65536;
    options.MemoryBufferThreshold = 65536;
});
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = AttachmentStore.MaxFileBytes + 65536);
builder.Services.AddSingleton<SensorRepository>();
builder.Services.AddSingleton<TelemetryService>();
builder.Services.AddSingleton<AttachmentStore>();
builder.Services.AddSingleton<HistoricalBatchService>();
builder.Services.AddSingleton<MeterComparisonService>();
builder.Services.AddSingleton<DeploymentValidator>();
builder.Services.AddSingleton<DeploymentStore>();
var app = builder.Build();
app.UseExceptionHandler();
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    try
    {
        if (HttpMethods.IsPost(context.Request.Method)
            && context.Request.Headers["X-SmartX-Client"] != "dashboard")
        {
            context.Response.StatusCode = 403;
            await context.Response.WriteAsJsonAsync(new { detail = "Send X-SmartX-Client: dashboard for write requests." });
            return;
        }
        await next(context);
    }
    catch (GatewayException error)
    {
        context.Response.StatusCode = error.StatusCode;
        await context.Response.WriteAsJsonAsync(new { detail = error.Message });
    }
    catch (BadHttpRequestException error)
    {
        context.Response.StatusCode = error.StatusCode;
        await context.Response.WriteAsJsonAsync(new { detail = error.StatusCode == 413
            ? "Request exceeds the upload size limit."
            : "Invalid request. Check required fields, JSON value types and timestamp format." });
    }
    catch (InvalidDataException)
    {
        context.Response.StatusCode = 400;
        await context.Response.WriteAsJsonAsync(new { detail = "Invalid multipart upload or upload exceeds the configured limit." });
    }
});
app.UseDefaultFiles();
app.UseStaticFiles();
app.MapGatewayEndpoints();
app.MapAdvancedEndpoints();
app.Map("/api/{**path}", () => Results.NotFound(new { detail = "API endpoint not found." }));
app.MapFallbackToFile("index.html");
app.Run();
