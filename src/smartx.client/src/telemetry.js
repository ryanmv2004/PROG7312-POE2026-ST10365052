export function simulatedValue(sensor, anomaly = false, random = Math.random) {
  if (sensor.readingKind === 'Switch') return random() >= 0.5;
  const span = sensor.maxValue - sensor.minValue;
  const value = anomaly ? sensor.maxValue + Math.max(span * 0.6, 1)
    : sensor.minValue + span * (0.35 + random() * 0.3);
  return sensor.readingKind === 'Power' ? Math.round(value) : Number(value.toFixed(2));
}
export function makePacket(sensor, value) {
  if (sensor.readingKind === 'Switch') {
    if (typeof value !== 'boolean') throw new Error('Switch readings must be true or false.');
  } else {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Enter a finite numeric reading.');
    if (sensor.readingKind === 'Power' && (!Number.isInteger(value) || value < 0 || value > 2147483647))
      throw new Error('Power must be a non-negative 32-bit integer.');
  }
  return { sensorId: sensor.id, timestampUtc: new Date().toISOString(), value };
}
