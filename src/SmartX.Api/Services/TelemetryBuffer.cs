using SmartX.Api.Models;

namespace SmartX.Api.Services;

public sealed class TelemetryBuffer<T>(int capacity) where T : struct
{
    private readonly object gate = new();
    private readonly Queue<ReceivedReading<T>> readings = new();
    private long accepted;
    private DateTimeOffset? lastReceived;
    private bool latestAnomaly;

    public ReceivedReading<T> Add(TelemetryPacket<T> packet, bool anomaly)
    {
        lock (gate)
        {
            var received = new ReceivedReading<T>(packet, DateTimeOffset.UtcNow, anomaly);
            if (readings.Count == capacity) readings.Dequeue();
            readings.Enqueue(received);
            accepted++;
            lastReceived = received.ReceivedAtUtc;
            latestAnomaly = anomaly;
            return received;
        }
    }

    public ReceivedReading<T>[] Snapshot()
    {
        lock (gate) return readings.ToArray();
    }

    public SensorStatus Status(SensorProfile sensor)
    {
        lock (gate)
        {
            var state = lastReceived is null ? "Waiting"
                : (DateTimeOffset.UtcNow - lastReceived.Value).TotalSeconds > sensor.DisconnectAfterSeconds
                    ? "NoRecentData" : latestAnomaly ? "Anomaly" : "Healthy";
            return new(sensor, state, lastReceived, accepted, readings.Count,
                readings.Count(r => r.IsAnomaly));
        }
    }
}
