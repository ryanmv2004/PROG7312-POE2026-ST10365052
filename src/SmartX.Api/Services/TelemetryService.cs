using System.Collections.Concurrent;
using SmartX.Api.Models;

namespace SmartX.Api.Services;

public sealed class TelemetryService(SensorRepository sensors, IConfiguration config)
{
    private readonly int capacity = Math.Clamp(config.GetValue("Gateway:ReadingsPerSensor", 300), 10, 10000);
    private readonly ConcurrentDictionary<Guid, TelemetryBuffer<float>> temperatures = new();
    private readonly ConcurrentDictionary<Guid, TelemetryBuffer<int>> powers = new();
    private readonly ConcurrentDictionary<Guid, TelemetryBuffer<bool>> switches = new();

    public TelemetryBuffer<float> Temperature(Guid id) => temperatures.GetOrAdd(id, _ => new(capacity));
    public TelemetryBuffer<int> Power(Guid id) => powers.GetOrAdd(id, _ => new(capacity));
    public TelemetryBuffer<bool> Switch(Guid id) => switches.GetOrAdd(id, _ => new(capacity));

    public SensorProfile RequireKind(Guid id, ReadingKind kind)
    {
        var sensor = sensors.Get(id);
        if (sensor.ReadingKind != kind) throw new GatewayException(400, "Payload type does not match the registered sensor.");
        return sensor;
    }

    private SensorProfile Validate<T>(Guid id, TelemetryPacket<T> packet, ReadingKind kind) where T : struct
    {
        var sensor = RequireKind(id, kind);
        if (packet.SensorId != id) throw new GatewayException(400, "Payload sensor ID must match the route.");
        if (packet.TimestampUtc == default || packet.TimestampUtc > DateTimeOffset.UtcNow.AddMinutes(5)
            || packet.TimestampUtc < DateTimeOffset.UtcNow.AddDays(-1))
            throw new GatewayException(400, "Timestamp must be within the past 24 hours and no more than 5 minutes ahead.");
        return sensor;
    }


    public bool Check(Guid id, TelemetryPacket<float> packet)
    {
        var s = Validate(id, packet, ReadingKind.Temperature);
        if (!float.IsFinite(packet.Value)) throw new GatewayException(400, "Temperature must be finite.");
        return packet.Value < s.MinValue || packet.Value > s.MaxValue;
    }
    public bool Check(Guid id, TelemetryPacket<int> packet)
    {
        var s = Validate(id, packet, ReadingKind.Power);
        if (packet.Value < 0) throw new GatewayException(400, "Power cannot be negative.");
        return packet.Value < s.MinValue || packet.Value > s.MaxValue;
    }
    public bool Check(Guid id, TelemetryPacket<bool> packet)
    {
        Validate(id, packet, ReadingKind.Switch);
        return false;
    }
    public ReceivedReading<float> Ingest(Guid id, TelemetryPacket<float> packet)
        { var anomaly = Check(id, packet); return Temperature(id).Add(packet, anomaly); }
    public ReceivedReading<int> Ingest(Guid id, TelemetryPacket<int> packet)
        { var anomaly = Check(id, packet); return Power(id).Add(packet, anomaly); }
    public ReceivedReading<bool> Ingest(Guid id, TelemetryPacket<bool> packet)
        { var anomaly = Check(id, packet); return Switch(id).Add(packet, anomaly); }

    public SensorStatus Status(SensorProfile sensor) => sensor.ReadingKind switch
    {
        ReadingKind.Temperature => Temperature(sensor.Id).Status(sensor),
        ReadingKind.Power => Power(sensor.Id).Status(sensor),
        ReadingKind.Switch => Switch(sensor.Id).Status(sensor),
        _ => throw new GatewayException(400, "Unsupported sensor kind.")
    };
}
