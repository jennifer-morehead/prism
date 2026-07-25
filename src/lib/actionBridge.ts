/**
 * Calls the local Vite dev-server action bridge at /api/actions.
 * In production this would be replaced by real Base44 SDK calls,
 * but for the hackathon the Vite plugin handles all actions in-memory.
 */
export async function callAction<TData>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<TData> {
  const res = await fetch("/api/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });

  if (!res.ok) {
    throw new Error(`Action ${action} HTTP ${res.status}`);
  }

  const envelope = (await res.json()) as
    | { ok: true; data: TData }
    | { ok: false; error: { code: string; message: string } };

  if (!envelope.ok) {
    throw new Error(envelope.error.message ?? `Action ${action} failed`);
  }

  return envelope.data;
}
