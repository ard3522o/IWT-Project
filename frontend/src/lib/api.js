const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

export function setApiToken(token) {
  if (token) sessionStorage.setItem('smart-mess-token', token);
  else sessionStorage.removeItem('smart-mess-token');
}

export async function apiRequest(path, options = {}) {
  const { auth = true, ...init } = options;
  const headers = new Headers(init.headers || {});
  if (init.body !== undefined && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (auth) {
    const token = sessionStorage.getItem('smart-mess-token');
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
      body: init.body !== undefined && typeof init.body !== 'string' && !(init.body instanceof FormData) ? JSON.stringify(init.body) : init.body,
    });
  } catch {
    throw new Error(`Cannot reach the API at ${baseUrl}. Check the backend URL and make sure the Render service is running.`);
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && auth) {
      setApiToken(null);
      window.dispatchEvent(new Event('smart-mess:unauthorized'));
    }
    throw new Error(result.error || `Request failed (${response.status}).`);
  }
  return result;
}

export { baseUrl as apiBaseUrl };
