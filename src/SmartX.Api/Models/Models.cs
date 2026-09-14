using System.Text.Json.Serialization;

namespace SmartX.Api.Models;

public enum SensorCategory { Environmental, PowerConsumption, Actuator }
public enum ReadingKind { Temperature, Power, Switch }

public sealed record TelemetryPacket<T> where T : struct
{
    public required Guid SensorId { get; init; }
    public required DateTimeOffset TimestampUtc { get; init; }
    public required T Value { get; init; }
}

public sealed record RegisterSensorRequest(
    string? DeviceIdentifier, string? Location, SensorCategory Category,
    ReadingKind ReadingKind, double MinValue = 0, double MaxValue = 40,
    int DisconnectAfterSeconds = 15);

public sealed record SensorProfile(
    Guid Id, string DeviceIdentifier, string Location, SensorCategory Category,
    ReadingKind ReadingKind, double MinValue, double MaxValue,
    int DisconnectAfterSeconds, DateTimeOffset RegisteredAtUtc);

public sealed record ReceivedReading<T>(
    TelemetryPacket<T> Packet, DateTimeOffset ReceivedAtUtc, bool IsAnomaly) where T : struct;

public sealed record SensorStatus(
    SensorProfile Sensor, string Status, DateTimeOffset? LastReceivedAtUtc,
    long AcceptedCount, int RetainedCount, int RetainedAnomalyCount);

public sealed record AttachmentInfo(
    Guid Id, Guid SensorId, string FileName, string StoredName, long SizeBytes,
    DateTimeOffset UploadedAtUtc);

public sealed class GatewayException(int statusCode, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}
