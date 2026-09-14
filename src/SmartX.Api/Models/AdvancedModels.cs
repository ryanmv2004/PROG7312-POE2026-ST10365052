namespace SmartX.Api.Models;
public readonly record struct MeterReading(long Watts)
{
    public static MeterReading operator +(MeterReading left, MeterReading right)
        => new(checked(left.Watts + right.Watts));
    public static MeterReading operator -(MeterReading left, MeterReading right)
        => new(checked(left.Watts - right.Watts));
    public static bool operator >(MeterReading left, MeterReading right) => left.Watts > right.Watts;
    public static bool operator <(MeterReading left, MeterReading right) => left.Watts < right.Watts;
    public static bool operator >=(MeterReading left, MeterReading right) => left.Watts >= right.Watts;
    public static bool operator <=(MeterReading left, MeterReading right) => left.Watts <= right.Watts;
}

public sealed record HistoricalBatchRequest<T> where T : struct
{
    public required TelemetryPacket<T>[][] RawBatches { get; init; }
}
public sealed record BatchReceipt(int BatchCount, int[] BatchSizes, int AcceptedCount, int AnomalyCount);
public sealed record MeterComparison(Guid MeterAId, Guid MeterBId,
    MeterReading MeterA, MeterReading MeterB, MeterReading Aggregate, MeterReading Delta,
    bool AExceedsB, DateTimeOffset AReceivedAtUtc, DateTimeOffset BReceivedAtUtc, bool HasStaleReading);

public enum DeploymentNodeKind { Facility, Zone, SubZone, Device }
public sealed record DeploymentNode
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required DeploymentNodeKind Kind { get; init; }
    public required bool Enabled { get; init; }
    public Guid? SensorId { get; init; }
    public DeploymentNode[]? Children { get; init; } = [];
}
public sealed record DeploymentRequest(DeploymentNode? Root);
public sealed record DeploymentIssue(string Path, string Message);
public sealed record DeploymentPlacement(Guid SensorId, string Path);
public sealed record DeploymentValidation(bool IsValid, int VisitedNodes,
    List<DeploymentIssue> Errors, List<DeploymentPlacement> Placements);
