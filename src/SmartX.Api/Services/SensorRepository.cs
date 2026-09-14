using System.Text.Json;
using SmartX.Api.Models;

namespace SmartX.Api.Services;

public sealed class SensorRepository
{
    private readonly object gate = new();
    private readonly string file;
    private readonly int maximum;
    private Dictionary<Guid, SensorProfile> profiles;

    public SensorRepository(IWebHostEnvironment environment, IConfiguration config)
    {
        var directory = Path.Combine(environment.ContentRootPath, "App_Data");
        Directory.CreateDirectory(directory);
        file = Path.Combine(directory, "sensors.json");
        maximum = Math.Clamp(config.GetValue("Gateway:MaxSensors", 100), 1, 10000);
        var items = File.Exists(file)
            ? JsonSerializer.Deserialize<List<SensorProfile>>(File.ReadAllText(file)) ?? [] : [];
        profiles = items.ToDictionary(s => s.Id);
    }

    public SensorProfile[] All() { lock (gate) return profiles.Values.OrderBy(s => s.RegisteredAtUtc).ToArray(); }
    public SensorProfile Get(Guid id)
    {
        lock (gate) return profiles.TryGetValue(id, out var value) ? value
            : throw new GatewayException(404, "Sensor not found.");
    }

    public SensorProfile Add(RegisterSensorRequest request)
    {
        var identifier = request.DeviceIdentifier?.Trim();
        var location = request.Location?.Trim();
        if (string.IsNullOrWhiteSpace(identifier) || identifier.Length > 100)
            throw new GatewayException(400, "Device identifier is required and must be at most 100 characters.");
        if (string.IsNullOrWhiteSpace(location) || location.Length > 120)
            throw new GatewayException(400, "Location is required and must be at most 120 characters.");
        if (!Enum.IsDefined(request.Category) || !Enum.IsDefined(request.ReadingKind))
            throw new GatewayException(400, "Select a valid category and reading kind.");
        if ((int)request.Category != (int)request.ReadingKind)
            throw new GatewayException(400, "Use Environmental/Temperature, PowerConsumption/Power or Actuator/Switch.");
        if (!double.IsFinite(request.MinValue) || !double.IsFinite(request.MaxValue)
            || request.MinValue >= request.MaxValue)
            throw new GatewayException(400, "Thresholds must be finite numbers with minimum below maximum.");
        if (request.ReadingKind == ReadingKind.Temperature
            && (request.MinValue < -1000 || request.MaxValue > 1000))
            throw new GatewayException(400, "Temperature thresholds must be between -1000 and 1000.");
        if (request.ReadingKind == ReadingKind.Power
            && (request.MinValue < 0 || request.MaxValue > 1000000
                || request.MinValue != Math.Truncate(request.MinValue) || request.MaxValue != Math.Truncate(request.MaxValue)))
            throw new GatewayException(400, "Power thresholds must be whole numbers between 0 and 1000000.");
        if (request.ReadingKind == ReadingKind.Switch && (request.MinValue != 0 || request.MaxValue != 1))
            throw new GatewayException(400, "Switch thresholds must be 0 and 1.");
        if (request.DisconnectAfterSeconds is < 5 or > 3600)
            throw new GatewayException(400, "Missing-data timeout must be between 5 and 3600 seconds.");
        lock (gate)
        {
            if (profiles.Count >= maximum) throw new GatewayException(409, "Sensor capacity reached.");
            if (profiles.Values.Any(s => s.DeviceIdentifier.Equals(identifier, StringComparison.OrdinalIgnoreCase)))
                throw new GatewayException(409, "This device identifier is already registered.");
            var sensor = new SensorProfile(Guid.NewGuid(), identifier, location, request.Category,
                request.ReadingKind, request.MinValue, request.MaxValue,
                request.DisconnectAfterSeconds, DateTimeOffset.UtcNow);
            var updated = new Dictionary<Guid, SensorProfile>(profiles) { [sensor.Id] = sensor };
            File.WriteAllText(file + ".tmp", JsonSerializer.Serialize(updated.Values));
            File.Move(file + ".tmp", file, true);
            profiles = updated;
            return sensor;
        }
    }
}
