import React, { useCallback, useEffect, useState } from 'react';
import { api, post } from './api.js';

export default function CommandStream({ onNotice }) {
  const [devices, setDevices] = useState([]);
  const [dashboard, setDashboard] = useState({ history: [], activeAlerts: [], suggestions: [] });
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [alertFilter, setAlertFilter] = useState('All');
  const [selected, setSelected] = useState('');
  const [value, setValue] = useState('ON');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try {
      const [s, d] = await Promise.all([api('/sensors'), api('/commands/dashboard')]);
      setDevices(s); setDashboard(d);
      setSelected(current => current || s.find(x => x.sensor.category === 'Actuator')?.sensor.id || '');
      setError('');
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => {
    let active = true, timer;
    const poll = async () => { if (active) await refresh(); if (active) timer = setTimeout(poll, 2000); };
    poll(); return () => { active = false; clearTimeout(timer); };
  }, [refresh]);
  const filtered = devices.filter(d => {
    const s = d.sensor;
    const matches = `${s.deviceIdentifier} ${s.location}`.toLowerCase().includes(query.toLowerCase());
    return matches && (category === 'All' || s.category === category) &&
      (alertFilter === 'All' || (alertFilter === 'Alerts' ? ['Anomaly','NoRecentData'].includes(d.status) : d.status === 'Healthy'));
  });
  async function issue(action, commandValue) {
    if (!selected) return;
    setBusy(true); setError('');
    try {
      const result = await post('/commands/', { sensorId: selected, action, value: commandValue });
      onNotice?.(`${result.action.toUpperCase()} ${result.value} accepted for ${result.deviceIdentifier}. This coursework gateway simulates device execution.`);
      await refresh();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function undo() {
    setBusy(true); setError('');
    try { const result = await post('/commands/undo', {}); onNotice?.(`Undo accepted: ${result.deviceIdentifier} set to ${result.value}.`); await refresh(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const chosen = devices.find(d => d.sensor.id === selected);
  return <div className="content command-page">
    <div className="hero compact"><div className="eyebrow">PART 2 / LIVE DEVICE OPERATIONS</div><h1>Command stream<span>.</span></h1><p>Monitor live device health, issue simulated actuator overrides, review command history and investigate proactive insights.</p><div className="actions"><button disabled={busy} onClick={undo}>↶ Undo last command</button><button onClick={refresh}>Refresh now</button></div></div>
    {error && <div className="message error" role="alert">{error}</div>}
    <div className="stats-grid"><div className="stat-card"><span>Registered devices</span><strong>{devices.length}</strong></div><div className="stat-card"><span>Active alerts</span><strong>{dashboard.activeAlerts.length}</strong></div><div className="stat-card"><span>Command records</span><strong>{dashboard.history.length}</strong></div><div className="stat-card"><span>Critical events processed</span><strong>{dashboard.criticalProcessed ?? 'Live'}</strong></div></div>
    <section className="panel"><div className="panel-heading"><div><div className="eyebrow">DEVICE CONTROL</div><h2>Manual override</h2></div><span className="pill">SIMULATED DISPATCH</span></div>
      <p className="hint">Commands are recorded by the API and update the simulated actuator state; they do not operate physical hardware.</p>
      <div className="two-columns"><label>Actuator<select value={selected} onChange={e => setSelected(e.target.value)}><option value="">Choose actuator…</option>{devices.filter(d => d.sensor.category === 'Actuator').map(d => <option key={d.sensor.id} value={d.sensor.id}>{d.sensor.deviceIdentifier} · {d.sensor.location}</option>)}</select></label><label>Desired state<select value={value} onChange={e => setValue(e.target.value)}><option value="ON">ON</option><option value="OFF">OFF</option></select></label></div>
      <div className="actions"><button className="primary" disabled={busy || !selected} onClick={() => issue('set', value)}>Set {value}</button><button disabled={busy || !selected} onClick={() => issue('toggle')}>Toggle relay</button><button disabled={busy || !selected} onClick={() => issue('pump', value)}>Pump {value}</button></div>
      {chosen && <p className="hint">Selected device: {chosen.sensor.deviceIdentifier} · current telemetry state: {chosen.status}. Manual commands are stored separately from sensor readings.</p>}
    </section>
    <section className="panel"><div className="panel-heading"><div><div className="eyebrow">LIVE MONITOR</div><h2>Device status & search</h2></div></div>
      <div className="filter-row"><input aria-label="Search devices" placeholder="Search device name or location…" value={query} onChange={e => setQuery(e.target.value)}/><select value={category} onChange={e => setCategory(e.target.value)}><option value="All">All categories</option><option value="Environmental">Environmental</option><option value="PowerConsumption">Power consumption</option><option value="Actuator">Actuator</option></select><select value={alertFilter} onChange={e => setAlertFilter(e.target.value)}><option value="All">All states</option><option value="Alerts">Active alerts</option><option value="Healthy">Healthy only</option></select></div>
      <div className="device-list">{filtered.map(d => <div className="device-row" key={d.sensor.id}><div><strong>{d.sensor.deviceIdentifier}</strong><p>{d.sensor.location} · {d.sensor.category}</p></div><span className={`status ${d.status}`}><span className="dot"/>{d.status}</span><span>{d.latestReceivedAtUtc ? new Date(d.latestReceivedAtUtc).toLocaleTimeString() : 'No readings yet'}</span></div>)}{!filtered.length && <p className="hint">No devices match the selected filters.</p>}</div>
    </section>
    <section className="panel"><div className="panel-heading"><div><div className="eyebrow">PREDICTIVE ACTION ENGINE</div><h2>Suggested actions & automated insights</h2></div></div><p className="hint">Heuristic recommendations use current sensor status and recent command frequency. Validate every suggestion against your operating procedure before acting.</p>
      <div className="suggestions">{dashboard.suggestions.map((s, i) => <article className="suggestion" key={`${s.deviceIdentifier}-${i}`}><span className={`priority ${s.priority}`}>{s.priority}</span><strong>{s.title} · {s.deviceIdentifier}</strong><p>{s.detail}</p>{s.action === 'set' && <button disabled={busy} onClick={() => { const d = devices.find(x => x.sensor.deviceIdentifier === s.deviceIdentifier); if (d) { setSelected(d.sensor.id); issue('set', s.value); } }}>Apply suggested state: {s.value}</button>}</article>)}{!dashboard.suggestions.length && <p className="hint">No suggestions yet. Register devices, send telemetry and use manual commands to build activity history.</p>}</div>
    </section>
    <section className="panel"><div className="panel-heading"><div><div className="eyebrow">STACK + SORTED TIMELINE</div><h2>Command history</h2></div></div><p className="hint">Newest commands first. Use Undo to revert the last recorded override.</p>
      <div className="history-list">{dashboard.history.map(c => <article className="history-row" key={c.id}><div><strong>{c.deviceIdentifier}</strong><p>{c.action.toUpperCase()} → {c.value} {c.previousValue ? `(previous: ${c.previousValue})` : ''}</p></div><span>{new Date(c.createdAtUtc).toLocaleString()}</span><small>{c.status}</small></article>)}{!dashboard.history.length && <p className="hint">No manual commands have been issued yet.</p>}</div>
    </section>
  </div>;
}
