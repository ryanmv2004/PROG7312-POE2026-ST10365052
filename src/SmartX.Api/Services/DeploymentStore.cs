using System.Text.Json;
using System.Text.Json.Serialization;
using SmartX.Api.Models;

namespace SmartX.Api.Services;

public sealed class DeploymentStore
{
    private readonly object gate = new();
    private readonly string file;
    private readonly DeploymentValidator validator;
    private readonly JsonSerializerOptions json = new(JsonSerializerDefaults.Web)
    { Converters = { new JsonStringEnumConverter() }, WriteIndented = true };

    public DeploymentStore(IWebHostEnvironment environment, DeploymentValidator validator)
    {
        this.validator = validator;
        var directory = Path.Combine(environment.ContentRootPath, "App_Data");
        Directory.CreateDirectory(directory);
        file = Path.Combine(directory, "deployment.json");
    }
    public DeploymentRequest Load()
    {
        lock (gate) return File.Exists(file)
            ? JsonSerializer.Deserialize<DeploymentRequest>(File.ReadAllText(file), json) ?? new(null)
            : new(null);
    }
    public DeploymentValidation Save(DeploymentRequest request)
    {
        var result = validator.Validate(request.Root);
        if (!result.IsValid) return result;
        lock (gate)
        {
            File.WriteAllText(file + ".tmp", JsonSerializer.Serialize(request, json));
            File.Move(file + ".tmp", file, true);
        }
        return result;
    }
}
