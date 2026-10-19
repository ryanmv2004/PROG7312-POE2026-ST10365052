namespace SmartX.Api.Models;

public sealed record DeviceCommandRequest(Guid SensorId, string Action, string? Value = null, string? Reason = null);
public sealed record DeviceCommand(Guid Id, Guid SensorId, string DeviceIdentifier, string Action, string Value,
    string? PreviousValue, DateTimeOffset CreatedAtUtc, string Status, string? Reason);
public sealed record CommandDashboard(DeviceCommand[] History, string[] ActiveAlerts, SuggestedAction[] Suggestions, int PendingTelemetry, int CriticalAlerts);
public sealed record SuggestedAction(string DeviceIdentifier, string Title, string Detail, string Action, string Value, string Priority);
public sealed record TelemetryQueueStats(int Pending, int CriticalPending, long Processed, long CriticalProcessed);
