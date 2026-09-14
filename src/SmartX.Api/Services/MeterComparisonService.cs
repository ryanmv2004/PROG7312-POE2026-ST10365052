using SmartX.Api.Models;

namespace SmartX.Api.Services;

public sealed class MeterComparisonService(TelemetryService telemetry)
{
    public MeterComparison Compare(Guid aId, Guid bId)
    {
        if (aId == bId) throw new GatewayException(400, "Choose two different power meters.");
        var aSensor = telemetry.RequireKind(aId, ReadingKind.Power);
        var bSensor = telemetry.RequireKind(bId, ReadingKind.Power);
        var aPacket = telemetry.Power(aId).Snapshot().LastOrDefault();
        var bPacket = telemetry.Power(bId).Snapshot().LastOrDefault();
        if (aPacket is null || bPacket is null)
            throw new GatewayException(409, "Both meters need at least one reading in this server session.");
        MeterReading meterA = new(aPacket.Packet.Value);
        MeterReading meterB = new(bPacket.Packet.Value);
        MeterReading aggregate = meterA + meterB; 
        MeterReading delta = meterA - meterB;     
        bool aExceedsB = meterA > meterB;         
        var now = DateTimeOffset.UtcNow;
        bool stale = (now - aPacket.ReceivedAtUtc).TotalSeconds > aSensor.DisconnectAfterSeconds
            || (now - bPacket.ReceivedAtUtc).TotalSeconds > bSensor.DisconnectAfterSeconds;
        return new(aId, bId, meterA, meterB, aggregate, delta, aExceedsB,
            aPacket.ReceivedAtUtc, bPacket.ReceivedAtUtc, stale);
    }
}
