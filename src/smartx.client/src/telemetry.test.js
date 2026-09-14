import test from 'node:test';
import assert from 'node:assert/strict';
import { makePacket, simulatedValue } from './telemetry.js';
const sensor = { id: 'test', readingKind: 'Temperature', minValue: 10, maxValue: 40 };
test('normal and spike simulations exercise both threshold paths', () => {
  for (const random of [() => 0, () => 0.5, () => 1]) {
    const value = simulatedValue(sensor, false, random);
    assert.ok(value >= 10 && value <= 40);
  }
  assert.ok(simulatedValue(sensor, true) > 40);
});
test('power remains integer; fractional and overflowing values are rejected', () => {
  const power = { ...sensor, readingKind: 'Power' };
  assert.equal(Number.isInteger(simulatedValue(power)), true);
  assert.throws(() => makePacket(power, 1.25));
  assert.throws(() => makePacket(power, 2147483648));
  assert.throws(() => makePacket(power, -1));
});
test('false remains Boolean and is never interpreted as missing', () => {
  const packet = makePacket({ ...sensor, readingKind: 'Switch' }, false);
  assert.equal(packet.value, false);
  assert.throws(() => makePacket({ ...sensor, readingKind: 'Switch' }, 'false'));
});
test('invalid temperatures are rejected and packets carry identity and timestamp', () => {
  assert.throws(() => makePacket(sensor, NaN));
  assert.throws(() => makePacket(sensor, Infinity));
  assert.throws(() => makePacket(sensor, '25'));
  const packet = makePacket(sensor, 25);
  assert.equal(packet.sensorId, 'test');
  assert.ok(Number.isFinite(Date.parse(packet.timestampUtc)));
});
