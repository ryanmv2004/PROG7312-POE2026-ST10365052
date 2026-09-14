export async function api(path, options = {}) {
  const response = await fetch('/api' + path, {
    ...options,
    headers: { 'X-SmartX-Client': 'dashboard', ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers }
  });
  if (!response.ok) {
    let message = `Request failed (${response.status}). Check the input and try again.`;
    try { const problem = await response.json(); message = problem.detail || problem.title || message; } catch { /* Non-JSON server failure. */ }
    throw new Error(message);
  }
  return response.status === 204 ? null : response.json();
}
export const kindPath = sensor => sensor.readingKind.toLowerCase();
export const readingsPath = sensor => `/sensors/${sensor.id}/telemetry/${kindPath(sensor)}`;
export const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) });
