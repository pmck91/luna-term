export async function api<T>(path: string, options: RequestInit = {}, csrf?: string): Promise<T> {
  const response = await fetch(path, { ...options, headers: { ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...options.headers }, credentials: 'same-origin' });
  const data = await response.json().catch(() => ({ error: 'The server did not respond. Please try again.' }));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data as T;
}
