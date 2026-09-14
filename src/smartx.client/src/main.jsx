import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api, post, readingsPath } from './api.js';
import { makePacket, simulatedValue } from './telemetry.js';
import './styles.css';
import AdvancedFeatures from './AdvancedFeatures.jsx';

const labels = { Healthy: 'Healthy', Anomaly: 'Outside range', NoRecentData: 'No recent data', Waiting: 'Awaiting first reading' };
const categoryNames = { Environmental: 'Environmental', PowerConsumption: 'Power consumption', Actuator: 'Actuator' };
const clock = date => date ? new Date(date).toLocaleTimeString() : '—';
const units = kind => kind === 'Temperature' ? '°C' : kind === 'Power' ? 'W' : '';
const valueText = value => typeof value === 'boolean' ? (value ? 'ON' : 'OFF') : String(value);

function App() {
  const [page, setPage] = useState('home');
  const [sensors, setSensors] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [filter, setFilter] = useState('');
  const [category, setCategory] = useState('All');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const data = await api('/sensors');
      setSensors(data); setConnected(true);
      setSelectedId(current => current || data[0]?.sensor.id || '');
    } catch (e) { setConnected(false); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let active = true, timer;
    const poll = async () => { await refresh(); if (active) timer = setTimeout(poll, 2000); };
    poll(); return () => { active = false; clearTimeout(timer); };
  }, [refresh]);
  useEffect(() => { if (!notice) return; const id = setTimeout(() => setNotice(''), 6000); return () => clearTimeout(id); }, [notice]);
  const selected = sensors.find(s => s.sensor.id === selectedId);
  const filtered = sensors.filter(({ sensor }) =>
    (category === 'All' || sensor.category === category) &&
    `${sensor.deviceIdentifier} ${sensor.location}`.toLowerCase().includes(filter.toLowerCase()));
  async function demo() {
    setBusy(true); setError('');
    try {
      const existing = await api('/sensors');
      const definitions = [
        { deviceIdentifier: 'DEMO-TEMP-001', location: 'Room A · Gateway lab', category: 'Environmental', readingKind: 'Temperature', minValue: 10, maxValue: 40 },
        { deviceIdentifier: 'DEMO-POWER-001', location: 'Zone B · Distribution board', category: 'PowerConsumption', readingKind: 'Power', minValue: 0, maxValue: 1500 },
        { deviceIdentifier: 'DEMO-POWER-002', location: 'Zone C · Workshop', category: 'PowerConsumption', readingKind: 'Power', minValue: 0, maxValue: 2000 },
        { deviceIdentifier: 'DEMO-SWITCH-001', location: 'Node C · Smart lighting', category: 'Actuator', readingKind: 'Switch', minValue: 0, maxValue: 1 }
      ];
      for (const definition of definitions) {
        const sensor = existing.find(x => x.sensor.deviceIdentifier === definition.deviceIdentifier)?.sensor
          || await post('/sensors', { ...definition, disconnectAfterSeconds: 15 });
        for (let i = 0; i < 12; i++) {
          const packet = makePacket(sensor, simulatedValue(sensor, i === 8 && sensor.readingKind !== 'Switch'));
          packet.timestampUtc = new Date(Date.now() - (11 - i) * 2000).toISOString();
          await post(readingsPath(sensor), packet);
        }
      }
      await refresh(); setPage('dashboard'); setNotice('Demo sensors are ready. Select one and start its simulator to keep readings arriving.');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <div className="shell">
    <aside><a className="brand" href="#" onClick={e => { e.preventDefault(); setPage('home'); }}><span className="brandmark">X</span> SMART-X</a>
      <div className="eyebrow navlabel">WORKSPACE</div>
      <button className={`nav ${page === 'home' ? 'active' : ''}`} onClick={() => setPage('home')}>◈ <span>Gateway overview</span></button>
      <button className={`nav ${page === 'dashboard' ? 'active' : ''}`} onClick={() => setPage('dashboard')}>⌁ <span>Sensor telemetry</span></button>
      <button className="nav" disabled>⇄ <span>Command stream <small>PART 2</small></span></button>
      <button className="nav" disabled>◇ <span>Mesh routing <small>FINAL POE</small></span></button>
      <div className="sidebar-foot"><span className={`dot ${connected ? 'green' : 'red'}`}/>{loading ? 'Connecting to gateway…' : connected ? 'Gateway connected' : 'Gateway unavailable'}<small>SMART-X / INGESTION GATEWAY</small></div>
    </aside>
    <main><header><div className="breadcrumb">Workspace <span>/</span> {page === 'home' ? 'Overview' : 'Sensor telemetry'}</div><span className="pill">PART 1 · DATA INGESTION</span></header>
      <div className="content">
        {!connected && !loading && <div className="message error" role="alert">Cannot reach the API. Start SmartX.Api on port 5080. Displayed readings may be stale. <button onClick={refresh}>Retry</button></div>}
        {error && <div className="message error" role="alert">{error}<button onClick={() => setError('')}>Dismiss</button></div>}
        {notice && <div className="message success" role="status">{notice}</div>}
        {page === 'home' ? <>
          <div className="hero"><div className="eyebrow">YOUR CONNECTED ECOSYSTEM</div><h1>Every signal.<br/><span>A clearer picture.</span></h1><p>Register devices, follow their readings, and investigate problems from one gateway.</p><div className="actions"><button className="primary" onClick={() => setPage('dashboard')}>Open telemetry dashboard →</button><button disabled={busy || !connected} onClick={demo}>{busy ? 'Preparing demo…' : 'Load demo sensors'}</button></div></div>
          <div className="pillars"><button className="pillar available" onClick={() => setPage('dashboard')}><span className="eyebrow">01 / AVAILABLE</span><div className="pillar-icon">⌁</div><h2>Sensor data ingestion<br/>& telemetry</h2><p>Capture typed readings, monitor sensor health and investigate unusual activity.</p><strong>Open module →</strong></button>
            <button className="pillar" disabled><span className="eyebrow">02 / PART 2</span><div className="pillar-icon">⇄</div><h2>Real-time command<br/>stream & history</h2><p>Command dispatch and execution history will become available in Part 2.</p><strong>Coming later</strong></button>
            <button className="pillar" disabled><span className="eyebrow">03 / FINAL POE</span><div className="pillar-icon">◇</div><h2>Network topology<br/>& mesh routing</h2><p>Explore connected nodes and routing in the final POE.</p><strong>Coming later</strong></button></div>
          <div className="onboarding"><b>New to Smart-X?</b><span>1. Register a sensor</span><span>2. Send a reading</span><span>3. Inspect its signal</span></div>
        </> : <>
          <div className="page-heading"><div><div className="eyebrow">LIVE OPERATIONS</div><h1>Sensor telemetry</h1><p>From incoming signal to actionable insight.</p></div><div className="actions"><button disabled={busy || !connected} onClick={demo}>{busy ? 'Loading…' : 'Load demo'}</button><button className="primary" onClick={() => setRegisterOpen(true)}>+ Register sensor</button></div></div>
          <div className="stats"><Stat label="REGISTERED SENSORS" value={sensors.length}/><Stat label="HEALTHY NOW" value={sensors.filter(s => s.status === 'Healthy').length} tone="green-text"/><Stat label="NEED ATTENTION" value={sensors.filter(s => ['Anomaly', 'NoRecentData'].includes(s.status)).length} tone="orange-text"/><Stat label="ACCEPTED THIS SESSION" value={sensors.reduce((sum, s) => sum + s.acceptedCount, 0)}/></div>
          <div className="dashboard-grid"><section className="panel inventory"><div className="panel-heading"><h2>Sensor fleet</h2><span className="muted">{filtered.length} devices</span></div><div className="filters"><input aria-label="Search sensors" placeholder="Search device or location…" value={filter} onChange={e => setFilter(e.target.value)}/><select aria-label="Filter category" value={category} onChange={e => setCategory(e.target.value)}><option>All</option>{Object.entries(categoryNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></div>
            {loading ? <p className="empty">Loading sensors…</p> : !filtered.length ? <div className="empty"><h3>{sensors.length ? 'No matching sensors' : 'Your first signal starts here'}</h3><p>{sensors.length ? 'Try another search or category.' : 'Register a sensor or load the four demo devices.'}</p></div> : <div className="sensor-list">{filtered.map(item => <button className={`sensor-card ${selectedId === item.sensor.id ? 'selected' : ''}`} key={item.sensor.id} onClick={() => setSelectedId(item.sensor.id)}><div className="row"><strong>{item.sensor.deviceIdentifier}</strong><span className="kind-icon">{item.sensor.readingKind === 'Temperature' ? '°' : item.sensor.readingKind === 'Power' ? 'ϟ' : '◉'}</span></div><p>{item.sensor.location}</p><div className="row"><Status status={item.status}/><small>{clock(item.lastReceivedAtUtc)}</small></div></button>)}</div>}
          </section><div className="detail-column">{selected ? <SensorDetail key={selected.sensor.id} sensors={sensors} entry={selected} connected={connected} refresh={refresh} onError={setError} onNotice={setNotice}/> : <section className="panel empty"><h2>Select a sensor</h2><p>Its readings, simulator and attachments will appear here.</p></section>}</div></div>
        </>}
        <footer>SMART-X GATEWAY <span>Latest 300 readings per sensor · Refreshes every 2 seconds</span></footer>
      </div>
    </main>
    {registerOpen && <RegisterModal onClose={() => setRegisterOpen(false)} onCreated={async sensor => { setSelectedId(sensor.id); setRegisterOpen(false); setNotice('Sensor registered. Send its first reading below.'); await refresh(); }}/>} 
  </div>;
}
function Stat({ label, value, tone = '' }) { return <div className="stat"><div className="eyebrow">{label}</div><strong className={tone}>{value}</strong></div>; }
function Status({ status }) { return <span className={`status ${status}`}><span className="dot"/>{labels[status] || status}</span>; }

function SensorDetail({ entry, sensors, connected, refresh, onError, onNotice }) {
  const sensor = entry.sensor;
  const [readings, setReadings] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [running, setRunning] = useState(false);
  const [manual, setManual] = useState(sensor.readingKind === 'Switch' ? 'true' : String((sensor.minValue + sensor.maxValue) / 2));
  const [point, setPoint] = useState(null);
  const [windowSize, setWindowSize] = useState(30);
  const [pending, setPending] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pulse, setPulse] = useState(0);
  const fileInput = useRef(null);
  useEffect(() => {
    let active = true, timer;
    async function poll() {
      try { const data = await api(readingsPath(sensor)); if (active) { setReadings(data); setDetailError(''); } }
      catch (e) { if (active) setDetailError(e.message); }
      if (active) timer = setTimeout(poll, 2000);
    }
    poll(); return () => { active = false; clearTimeout(timer); };
  }, [sensor.id, pulse]);
  useEffect(() => {
    let active = true;
    api(`/sensors/${sensor.id}/attachments`).then(data => { if (active) setAttachments(data); }).catch(e => { if (active) setDetailError(e.message); });
    return () => { active = false; };
  }, [sensor.id]);
  useEffect(() => {
    if (!running) return;
    let active = true, timer;
    async function send() {
      try {
        await post(readingsPath(sensor), makePacket(sensor, simulatedValue(sensor)));
        if (active) { setPulse(p => p + 1); await refresh(); }
      } catch (e) { if (active) { setRunning(false); onError(e.message); } return; }
      if (active) timer = setTimeout(send, 2000);
    }
    send(); return () => { active = false; clearTimeout(timer); };
  }, [running, sensor.id]);
  async function sendValue(value) {
    setPending(true);
    try { await post(readingsPath(sensor), makePacket(sensor, value)); setPulse(p => p + 1); await refresh(); onNotice('Reading accepted by the gateway.'); }
    catch (e) { onError(e.message); } finally { setPending(false); }
  }
  async function upload(event) {
    event.preventDefault(); const file = fileInput.current.files[0];
    if (!file) { onError('Choose a file first.'); return; }
    if (file.size > 5 * 1024 * 1024 || file.size === 0) { onError('Choose a non-empty file of at most 5 MiB.'); return; }
    const data = new FormData(); data.append('file', file); setUploading(true);
    try { await api(`/sensors/${sensor.id}/attachments`, { method: 'POST', body: data }); setAttachments(await api(`/sensors/${sensor.id}/attachments`)); fileInput.current.value = ''; onNotice('File attached to this sensor.'); }
    catch (e) { onError(e.message); } finally { setUploading(false); }
  }
  const latest = readings.at(-1);
  const shown = readings.slice(-windowSize);
  const anomalies = readings.filter(r => r.isAnomaly).slice(-5).reverse();
  return <>
    <section className="panel"><div className="panel-heading"><div><div className="eyebrow">{categoryNames[sensor.category]}</div><h2>{sensor.deviceIdentifier}</h2><p>{sensor.location}</p></div><Status status={entry.status}/></div>
      {detailError && <div className="message error" role="alert">{detailError} Readings may be stale.</div>}
      <div className="reading-heading"><div><strong>{latest ? valueText(latest.packet.value) : '—'}</strong> <span>{units(sensor.readingKind)}</span><p>Latest received value · {clock(latest?.receivedAtUtc)}</p></div><label className="inline-label">View<select value={windowSize} onChange={e => setWindowSize(Number(e.target.value))}><option value="30">Last 30 readings</option><option value="100">Last 100 readings</option><option value="300">Last 300 readings</option></select></label></div>
      <TelemetryChart readings={shown} sensor={sensor} onSelect={setPoint}/>
      <div className="chart-caption"><span><i className="legend teal"/> Readings <i className="legend orange"/> Outside expected range</span><span>{sensor.readingKind === 'Switch' ? '0 = OFF · 1 = ON' : `Expected ${sensor.minValue}–${sensor.maxValue} ${units(sensor.readingKind)}`}</span></div>
      <p className="hint">Select a point to inspect its value and timestamps. Plotted in arrival order; hover to see device time.</p>
    </section>
    <section className="panel troubleshooting"><div className="panel-heading"><h2>Signal inspector</h2><span className="eyebrow">DETECT → INVESTIGATE</span></div>
      {entry.status === 'NoRecentData' && <div className="alert"><b>No readings for over {sensor.disconnectAfterSeconds} seconds</b><p>Last received at {clock(entry.lastReceivedAtUtc)}. Check power, network connectivity and the sender configuration. A missing reading indicates a possible disconnect, not a confirmed hardware fault.</p></div>}
      {entry.status === 'Waiting' && <p className="hint">Awaiting this session’s first reading. Use the simulator or submit a reading below.</p>}
      {point ? <div className={`inspection ${point.isAnomaly ? 'alert' : ''}`}><div className="row"><b>{point.isAnomaly ? 'Outside configured range' : 'Selected reading'}: {valueText(point.packet.value)} {units(sensor.readingKind)}</b><button className="text-button" onClick={() => setPoint(null)}>Clear</button></div><p>Device time: {new Date(point.packet.timestampUtc).toLocaleString()}<br/>Gateway arrival: {new Date(point.receivedAtUtc).toLocaleString()}</p><p>{point.isAnomaly ? 'Compare nearby readings. Check calibration, the configured threshold and environmental or load changes. A threshold breach flags a reading for review; it does not prove a sensor fault.' : 'This reading is within the configured range. Compare its neighbours if you suspect an unusual change.'}</p></div> : <p className="hint">Click a graph point or a recent alert to see the evidence and suggested checks.</p>}
      {anomalies.length > 0 && <div className="alert-list"><span className="eyebrow">RECENT THRESHOLD ALERTS</span>{anomalies.map((r, i) => <button key={i} onClick={() => setPoint(r)}><span>⚠ {valueText(r.packet.value)} {units(sensor.readingKind)}</span><span>{clock(r.packet.timestampUtc)} →</span></button>)}</div>}
    </section>
    <section className="panel"><div className="panel-heading"><h2>Send test telemetry</h2><span className={`status ${running ? 'Healthy' : 'Waiting'}`}><span className="dot"/>{running ? 'Simulator running' : 'Simulator stopped'}</span></div><div className="actions"><button className={running ? 'danger' : 'primary'} disabled={!connected && !running} onClick={() => setRunning(!running)}>{running ? 'Stop simulator' : 'Start simulator'}</button><button disabled={pending || !connected} onClick={() => sendValue(simulatedValue(sensor))}>Send normal reading</button><button disabled={pending || !connected || sensor.readingKind === 'Switch'} onClick={() => { setRunning(false); sendValue(simulatedValue(sensor, true)); }}>Inject spike</button></div><p className="hint">The simulator sends every 2 seconds while this sensor is open. Stop it and wait {sensor.disconnectAfterSeconds} seconds to demonstrate missing data. Injecting a spike pauses the simulator so you can inspect it. Switch ON/OFF changes are not faults.</p>
      <form className="manual-form" onSubmit={e => { e.preventDefault(); sendValue(sensor.readingKind === 'Switch' ? manual === 'true' : Number(manual)); }}><label>Manual value {units(sensor.readingKind)}{sensor.readingKind === 'Switch' ? <select value={manual} onChange={e => setManual(e.target.value)}><option value="true">ON (true)</option><option value="false">OFF (false)</option></select> : <input type="number" required step={sensor.readingKind === 'Power' ? '1' : 'any'} min={sensor.readingKind === 'Power' ? '0' : undefined} value={manual} onChange={e => setManual(e.target.value)}/>}</label><button disabled={pending || !connected} type="submit">{pending ? 'Sending…' : 'Submit reading'}</button></form>
    </section>
    <AdvancedFeatures sensor={sensor} sensors={sensors} refresh={refresh}/>
    <section className="panel"><div className="panel-heading"><h2>Device attachments</h2><span className="muted">{attachments.length} / 20 files</span></div><p className="hint">Configuration, deployment photos and hardware logs. Up to 5 MiB each.</p><form className="upload-form" onSubmit={upload}><input aria-label="Choose sensor attachment" ref={fileInput} type="file" accept=".txt,.log,.json,.csv,.xml,.pdf,.png,.jpg,.jpeg"/><button type="submit" disabled={uploading || !connected}>{uploading ? 'Uploading…' : 'Upload file'}</button></form><div className="files">{attachments.length ? attachments.map(file => <a key={file.id} href={`/api/sensors/${sensor.id}/attachments/${file.id}`} download><span>↧ {file.fileName}</span><small>{(file.sizeBytes / 1024).toFixed(1)} KB</small></a>) : <p className="hint">No files attached to this sensor yet.</p>}</div></section>
  </>;
}

function TelemetryChart({ readings, sensor, onSelect }) {
  if (!readings.length) return <div className="chart-empty">Waiting for a signal. Send the first reading to start the chart.</div>;
  const values = readings.map(r => Number(r.packet.value));
  const low = Math.min(sensor.minValue, ...values), high = Math.max(sensor.maxValue, ...values);
  const padding = (high - low || 1) * 0.15;
  const yMin = low - padding, yMax = high + padding;
  const x = i => 55 + i / Math.max(readings.length - 1, 1) * 685;
  const y = value => 195 - (value - yMin) / (yMax - yMin) * 175;
  return <svg className="chart" viewBox="0 0 780 235" aria-label={`${sensor.deviceIdentifier} recent telemetry chart`}>
    <rect x="55" y={y(sensor.maxValue)} width="685" height={Math.max(0, y(sensor.minValue) - y(sensor.maxValue))} fill="#e9f6f1"/>
    {[0, 1, 2, 3, 4].map(i => { const v = yMin + (yMax - yMin) * i / 4; return <g key={i}><line x1="55" x2="740" y1={y(v)} y2={y(v)} stroke="#e4e9ee"/><text x="45" y={y(v) + 4} textAnchor="end">{v.toFixed(sensor.readingKind === 'Switch' ? 1 : 0)}</text></g>; })}
    <polyline points={readings.map((r, i) => `${x(i)},${y(Number(r.packet.value))}`).join(' ')} fill="none" stroke="#008b75" strokeWidth="2.5"/>
    {readings.map((r, i) => <circle key={i} cx={x(i)} cy={y(Number(r.packet.value))} r={r.isAnomaly ? 6 : 4} fill={r.isAnomaly ? '#d45a21' : '#008b75'} tabIndex="0" role="button" aria-label={`${valueText(r.packet.value)} at ${clock(r.packet.timestampUtc)}${r.isAnomaly ? ', outside range' : ''}`} onClick={() => onSelect(r)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(r); } }}><title>{valueText(r.packet.value)} · {clock(r.packet.timestampUtc)}</title></circle>)}
    <text x="55" y="225">{clock(readings[0].packet.timestampUtc)}</text><text x="740" y="225" textAnchor="end">{clock(readings.at(-1).packet.timestampUtc)}</text>
  </svg>;
}
function RegisterModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ deviceIdentifier: '', location: '', category: 'Environmental', readingKind: 'Temperature', minValue: 10, maxValue: 40, disconnectAfterSeconds: 15 });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const dialog = useRef(null);
  useEffect(() => { dialog.current.showModal(); }, []);
  const change = (key, value) => setForm(old => ({ ...old, [key]: value }));
  function changeCategory(value) {
    const settings = { Environmental: ['Temperature', 10, 40], PowerConsumption: ['Power', 0, 1500], Actuator: ['Switch', 0, 1] }[value];
    setForm(old => ({ ...old, category: value, readingKind: settings[0], minValue: settings[1], maxValue: settings[2] }));
  }
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { const sensor = await post('/sensors', { ...form, minValue: Number(form.minValue), maxValue: Number(form.maxValue), disconnectAfterSeconds: Number(form.disconnectAfterSeconds) }); await onCreated(sensor); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <dialog ref={dialog} onCancel={e => { e.preventDefault(); if (!busy) onClose(); }} aria-labelledby="register-title"><form onSubmit={submit}><div className="panel-heading"><div><div className="eyebrow">NEW DEVICE</div><h2 id="register-title">Register a sensor</h2></div><button type="button" disabled={busy} onClick={onClose} aria-label="Close registration">×</button></div><p className="hint">Identify the device, choose its location and configure its expected signal.</p>{error && <div role="alert" className="message error">{error}</div>}
    <label>MAC address or unique identifier<input autoFocus required maxLength="100" placeholder="e.g. AA:BB:CC:DD:EE:01" value={form.deviceIdentifier} onChange={e => change('deviceIdentifier', e.target.value)}/></label>
    <label>Deployment location<input required maxLength="120" placeholder="e.g. Room 2 / Zone A / Node 01" value={form.location} onChange={e => change('location', e.target.value)}/></label>
    <label>Sensor category<select value={form.category} onChange={e => changeCategory(e.target.value)}>{Object.entries(categoryNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
    <p className="hint">Payload: {form.readingKind === 'Temperature' ? 'float · temperature in °C' : form.readingKind === 'Power' ? 'int · power in watts' : 'bool · switch ON / OFF'}</p>
    {form.readingKind !== 'Switch' && <div className="two-columns"><label>Expected minimum<input required type="number" step="any" value={form.minValue} onChange={e => change('minValue', e.target.value)}/></label><label>Expected maximum<input required type="number" step="any" value={form.maxValue} onChange={e => change('maxValue', e.target.value)}/></label></div>}
    <label>Missing-data timeout (seconds)<input required type="number" min="5" max="3600" step="1" value={form.disconnectAfterSeconds} onChange={e => change('disconnectAfterSeconds', e.target.value)}/></label><div className="actions modal-actions"><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="primary" disabled={busy}>{busy ? 'Registering…' : 'Register sensor'}</button></div>
  </form></dialog>;
}

createRoot(document.getElementById('root')).render(<App/>);
