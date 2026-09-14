import React, { useState } from 'react';
import { api, post, readingsPath } from './api.js';
import { makePacket } from './telemetry.js';

export default function AdvancedFeatures({ sensor, sensors, refresh }) {
  const [batchJson, setBatchJson] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [otherId, setOtherId] = useState('');
  const [comparison, setComparison] = useState(null);
  const [treeJson, setTreeJson] = useState('');
  const [validation, setValidation] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const otherMeters = sensors.filter(x => x.sensor.readingKind === 'Power' && x.sensor.id !== sensor.id);

  async function work(action) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  function sampleBatch() {
    let index = 0;
    const value = sensor.readingKind === 'Switch' ? false : sensor.readingKind === 'Power'
      ? Math.round((sensor.minValue + sensor.maxValue) / 2) : (sensor.minValue + sensor.maxValue) / 2;
    const packet = () => ({ ...makePacket(sensor, value), timestampUtc: new Date(Date.now() - (5 - index++) * 2000).toISOString() });
    setBatchJson(JSON.stringify({ rawBatches: [[packet(), packet()], [packet(), packet(), packet()]] }, null, 2));
    setReceipt(null);
  }
  function sampleTree() {
    const node = (id, name, kind, children = [], sensorId = null) => ({ id, name, kind, enabled: true, sensorId, children });
    setTreeJson(JSON.stringify({ root: node('facility-a', 'Facility A', 'Facility', [
      node('zone-1', 'Zone 1', 'Zone', [node('sub-zone-b', 'Sub-Zone B', 'SubZone', [
        node('device-1', sensor.deviceIdentifier, 'Device', [], sensor.id)
      ])])
    ]) }, null, 2));
    setValidation(null); setNotice('Example ready. This maps the selected sensor into a four-level deployment.');
  }
  async function validateTree(save) {
    const body = JSON.parse(treeJson);
    const result = await post('/deployment/validate', body);
    setValidation(result);
    if (!result.isValid) { setNotice('Validation found problems. The saved configuration has not changed.'); return; }
    if (save) {
      await post('/deployment', body);
      setNotice('Validated deployment saved. It will survive a server restart.');
    } else setNotice('Deployment is valid. Use Validate & save to store this configuration.');
  }
  return <section className="panel advanced"><div className="panel-heading"><div><div className="eyebrow">CONFIGURATION & ANALYSIS</div><h2>Advanced sensor tools</h2></div></div>
    {error && <div className="message error" role="alert">{error}</div>}
    {notice && <div className="message success" role="status">{notice}</div>}
    {sensor.readingKind === 'Power' && <details open><summary>Meter aggregation & delta</summary><p className="hint">Compare this meter (A) with another meter (B). Results use each meter’s latest received reading and show when each arrived.</p>
      <label>Meter B<select disabled={busy} value={otherId} onChange={e => { setOtherId(e.target.value); setComparison(null); }}><option value="">Choose a second power meter…</option>{otherMeters.map(({ sensor: s }) => <option key={s.id} value={s.id}>{s.deviceIdentifier}</option>)}</select></label>
      {!otherMeters.length && <p className="hint">Register a second power sensor or click Load demo to create two example meters.</p>}
      <button disabled={!otherId || busy} onClick={() => work(async () => { setComparison(null); setComparison(await api(`/meters/${sensor.id}/compare/${otherId}`)); })}>Calculate aggregate & delta</button>
      {comparison && <div className="comparison-result"><div className="stats"><div className="stat">A + B<strong>{comparison.aggregate.watts} W</strong></div><div className="stat">A − B<strong>{comparison.delta.watts} W</strong></div></div><p>A: {comparison.meterA.watts} W · B: {comparison.meterB.watts} W · A greater than B: {comparison.aExceedsB ? 'Yes' : 'No'}</p><p className="hint">A received: {new Date(comparison.aReceivedAtUtc).toLocaleString()}<br/>B received: {new Date(comparison.bReceivedAtUtc).toLocaleString()}<br/>This is a snapshot; calculate again to refresh. The readings may represent different device times.</p>{comparison.hasStaleReading && <p className="alert">At least one reading is stale. Treat this as a comparison of last-known values.</p>}</div>}
    </details>}
    <details><summary>Import historical batches</summary><p className="hint">Import ordered groups of readings for this sensor. Unequal batch lengths are supported. All readings are validated before any are accepted.</p><button disabled={busy} onClick={sampleBatch}>Generate sample batches</button>
      <label>Historical batches JSON<textarea rows="10" spellCheck="false" value={batchJson} onChange={e => { setBatchJson(e.target.value); setReceipt(null); }} placeholder='{"rawBatches": [[...], [...]]}'/></label>
      <button disabled={busy || !batchJson.trim()} onClick={() => work(async () => { setReceipt(null); const result = await post(readingsPath(sensor) + '/batches', JSON.parse(batchJson)); setReceipt(result); await refresh(); })}>Import batches</button>
      {receipt && <div className="message success" role="status">Imported {receipt.acceptedCount} readings from {receipt.batchCount} batches ({receipt.batchSizes.join(' + ')}); {receipt.anomalyCount} outside range.</div>}
      <p className="hint">Maximum 20 batches, 100 readings per batch and 1,000 total. Timestamps must be ordered across batches and within the previous 24 hours (up to 5 minutes ahead allowed). Only the latest 300 arrivals remain in the chart. Importing history updates the gateway’s last-arrival time; it does not prove that the device is currently online.</p>
    </details>
    <details><summary>Deployment tree validation</summary><p className="hint">Validate Facility → Zone → Sub-Zone → Device, including every ancestor’s enabled state. This is a saved deployment configuration, separate from the free-text location label.</p><div className="actions"><button disabled={busy} onClick={sampleTree}>Generate deployment example</button><button disabled={busy} onClick={() => work(async () => { const data = await api('/deployment'); setTreeJson(data.root ? JSON.stringify(data, null, 2) : ''); setValidation(null); setNotice(data.root ? 'Saved deployment loaded.' : 'No deployment has been saved yet. Generate an example to begin.'); })}>Load saved deployment</button></div>
      <label>Deployment tree JSON<textarea rows="12" spellCheck="false" value={treeJson} onChange={e => { setTreeJson(e.target.value); setValidation(null); }} placeholder='{"root": {...}}'/></label>
      <div className="actions"><button disabled={busy || !treeJson.trim()} onClick={() => work(() => validateTree(false))}>Validate tree</button><button className="primary" disabled={busy || !treeJson.trim()} onClick={() => work(() => validateTree(true))}>Validate & save</button></div>
      <p className="hint">One facility configuration is saved for the gateway. Saving replaces that configuration; load and edit it to preserve existing placements. Maximum 100 nodes and 8 levels. Each sensor can appear only once. An example contains only the selected sensor.</p>
      {validation && <div className="tree-result"><h3>{validation.isValid ? 'Valid deployment' : 'Deployment needs attention'} · {validation.visitedNodes} nodes visited</h3>{validation.errors.map((e, i) => <div className="alert" key={i}><b>{e.path || 'Deployment root'}</b><p>{e.message}</p></div>)}{validation.placements.length > 0 && <><p className="hint">{validation.isValid ? 'Validated device paths:' : 'Discovered device paths (configuration is not valid yet):'}</p><ul>{validation.placements.map(p => <li key={p.sensorId}>{p.path}</li>)}</ul></>}</div>}
    </details>
  </section>;
}
