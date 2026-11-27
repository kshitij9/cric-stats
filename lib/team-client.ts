/** Saving teams from a page. */

/** Sends a change; throws with the server's words if it is refused. */
export async function send<T>(method: 'POST' | 'PUT' | 'DELETE', url: string, body?: unknown) {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('could not reach the server');
  }
  const json = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(json?.error ?? `Request failed (${response.status})`);
  }
  return json as T;
}
