using System.Collections.Concurrent;
using SmartX.Api.Models;

namespace SmartX.Api.Services;

// Thread-safe in-memory Part 2 engine. Queue = FIFO telemetry, PriorityQueue = critical
// work, Stack = command undo, Dictionary = live devices, SortedDictionary = timeline,
// HashSet = de-duplicated active alerts.
public sealed class CommandStreamService(SensorRepository sensors, TelemetryService telemetry)
{
    private readonly object gate = new();
    private readonly Queue<(Guid SensorId, DateTimeOffset ReceivedAt)> telemetryQueue = new();
    private readonly PriorityQueue<(Guid SensorId, DateTimeOffset ReceivedAt), int> criticalQueue = new();
    private readonly Dictionary<Guid, string> liveStates = new();
    private readonly Stack<DeviceCommand> undoStack = new();
    private readonly SortedDictionary<DateTimeOffset, DeviceCommand> timeline = new();
    private readonly HashSet<string> activeAlerts = new(StringComparer.OrdinalIgnoreCase);
    private readonly List<DeviceCommand> history = [];
    private long processed, criticalProcessed;

    public void ObserveTelemetry(Guid id, bool critical)
    {
        lock (gate)
        {
            telemetryQueue.Enqueue((id, DateTimeOffset.UtcNow));
            if (critical) criticalQueue.Enqueue((id, DateTimeOffset.UtcNow), 0);
            // Simulated worker drains immediately, prioritising critical events.
            while (criticalQueue.TryDequeue(out var alert, out _)) { criticalProcessed++; processed++; }
            while (telemetryQueue.TryDequeue(out _)) processed++;
        }
    }

    public DeviceCommand Send(DeviceCommandRequest request)
    {
        lock (gate)
        {
            var registered = sensors.Get(request.SensorId);
            if (registered.Category != SensorCategory.Actuator)
                throw new GatewayException(400, "Manual commands are only supported for registered actuator devices.");
            var action = request.Action?.Trim().ToLowerInvariant();
            if (action is not ("set" or "toggle" or "pump" or "relay" or "undo"))
                throw new GatewayException(400, "Action must be set, toggle, pump or relay.");
            var oldValue = liveStates.GetValueOrDefault(request.SensorId, "OFF");
            var value = request.Value?.Trim().ToUpperInvariant();
            if (action == "toggle") value = oldValue == "ON" ? "OFF" : "ON";
            if (action == "pump" || action == "relay") value = string.IsNullOrWhiteSpace(value) ? "ON" : value;
            if (value is not ("ON" or "OFF"))
                throw new GatewayException(400, "Command value must be ON or OFF.");
            var command = new DeviceCommand(Guid.NewGuid(), request.SensorId, registered.DeviceIdentifier,
                action!, value, oldValue, DateTimeOffset.UtcNow, "Simulated/Accepted", request.Reason);
            liveStates[request.SensorId] = value;
            undoStack.Push(command);
            history.Add(command);
            timeline[command.CreatedAtUtc] = command;
            return command;
        }
    }

    public DeviceCommand? Undo()
    {
        lock (gate)
        {
            if (!undoStack.TryPop(out var previous)) return null;
            var value = previous.PreviousValue ?? "OFF";
            liveStates[previous.SensorId] = value;
            var undo = new DeviceCommand(Guid.NewGuid(), previous.SensorId, previous.DeviceIdentifier,
                "undo", value, previous.Value, DateTimeOffset.UtcNow, "Simulated/Accepted", $"Reverted command {previous.Id}");
            history.Add(undo); timeline[undo.CreatedAtUtc] = undo;
            return undo;
        }
    }

    public CommandDashboard Dashboard()
    {
        lock (gate)
        {
            var registered = sensors.All().Select(profile => telemetry.Status(profile)).ToArray();
            activeAlerts.Clear();
            var suggestions = new List<SuggestedAction>();
            foreach (var item in registered)
            {
                var s = item.Sensor;
                var status = item.Status;
                if (status is "Anomaly" or "NoRecentData")
                {
                    activeAlerts.Add($"{s.DeviceIdentifier}:{status}");
                    suggestions.Add(new(s.DeviceIdentifier, status == "Anomaly" ? "Investigate out-of-range reading" : "Check device connectivity",
                        $"Device status is {status}. Inspect power, wiring, thresholds and the latest telemetry.", "inspect", "", "High"));
                }
                if (s.Category == SensorCategory.Actuator && liveStates.GetValueOrDefault(s.Id, "OFF") == "OFF")
                    suggestions.Add(new(s.DeviceIdentifier, "Actuator available", "Review whether this actuator should be enabled based on your operating procedure.", "set", "ON", "Normal"));
            }
            // Pattern-based heuristic: telemetry alerts plus command history are surfaced as proactive insights.
            var recent = history.TakeLast(10).GroupBy(c => c.DeviceIdentifier).OrderByDescending(g => g.Count()).FirstOrDefault();
            if (recent is not null)
                suggestions.Insert(0, new(recent.Key, "Repeated operator activity", $"This device appears in {recent.Count()} of the latest command records. Review whether an automation rule is appropriate.", "inspect", "", "Medium"));
            return new(history.AsEnumerable().Reverse().Take(100).ToArray(), activeAlerts.ToArray(), suggestions.Take(8).ToArray(),
                telemetryQueue.Count, criticalQueue.Count);
        }
    }

    public TelemetryQueueStats Stats() { lock (gate) return new(telemetryQueue.Count, criticalQueue.Count, processed, criticalProcessed); }
}
