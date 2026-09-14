using SmartX.Api.Models;

namespace SmartX.Api.Services;

public sealed class HistoricalBatchService(TelemetryService telemetry)
{
    public BatchReceipt Ingest(Guid id, HistoricalBatchRequest<float> request)
    {
        telemetry.RequireKind(id, ReadingKind.Temperature);
        return Transfer(request, packet => telemetry.Check(id, packet), telemetry.Temperature(id));
    }
    public BatchReceipt Ingest(Guid id, HistoricalBatchRequest<int> request)
    {
        telemetry.RequireKind(id, ReadingKind.Power);
        return Transfer(request, packet => telemetry.Check(id, packet), telemetry.Power(id));
    }
    public BatchReceipt Ingest(Guid id, HistoricalBatchRequest<bool> request)
    {
        telemetry.RequireKind(id, ReadingKind.Switch);
        return Transfer(request, packet => telemetry.Check(id, packet), telemetry.Switch(id));
    }

    private static BatchReceipt Transfer<T>(HistoricalBatchRequest<T> request,
        Func<TelemetryPacket<T>, bool> validate, TelemetryBuffer<T> destination) where T : struct
    {
        TelemetryPacket<T>[][] rawBatches = request.RawBatches;
        if (rawBatches is null || rawBatches.Length is < 1 or > 20)
            throw new GatewayException(400, "Provide between 1 and 20 historical batches.");
        int total = 0;
        foreach (TelemetryPacket<T>[] batch in rawBatches)
        {
            if (batch is null || batch.Length is < 1 or > 100)
                throw new GatewayException(400, "Each batch must contain 1 to 100 packets.");
            total += batch.Length;
        }
        if (total > 1000) throw new GatewayException(400, "At most 1000 readings may be imported per request.");

        List<TelemetryPacket<T>> readings = new(total);
        List<bool> anomalyFlags = new(total);
        DateTimeOffset? previous = null;
        for (int batchIndex = 0; batchIndex < rawBatches.Length; batchIndex++)
        {
            for (int readingIndex = 0; readingIndex < rawBatches[batchIndex].Length; readingIndex++)
            {
                var packet = rawBatches[batchIndex][readingIndex];
                if (packet is null) throw new GatewayException(400, $"Null packet in batch {batchIndex + 1}.");
                if (previous is not null && packet.TimestampUtc < previous.Value)
                    throw new GatewayException(400, "Historical packets must be ordered by device timestamp across all batches.");
                anomalyFlags.Add(validate(packet));
                readings.Add(packet);
                previous = packet.TimestampUtc;
            }
        }
        for (int i = 0; i < readings.Count; i++) destination.Add(readings[i], anomalyFlags[i]);
        return new(rawBatches.Length, rawBatches.Select(batch => batch.Length).ToArray(),
            readings.Count, anomalyFlags.Count(flag => flag));
    }
}
