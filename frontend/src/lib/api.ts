export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

export type User = { id: string; email: string; is_active: boolean; created_at: string };
export type Document = { id: string; filename: string; content_type: string; size_bytes: number | null; status: string; is_favorite: boolean; workspace_id: string | null; created_at: string; updated_at: string };
export type Workspace = { id: string; name: string; description: string | null; document_count: number; created_at: string; updated_at: string };
export type Citation = { chunk_id: string; document_id: string; filename: string; page_number: number | null; relevance_score: number };
export type Message = { id: string; role: "user" | "assistant"; content: string; citations: Citation[] | null; created_at: string };
export type Chat = { id: string; title: string; created_at: string; updated_at: string; messages?: Message[] };
export type TokenResponse = { access_token: string; token_type: string; user: User };

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

export async function api<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  let response: Response;
  try { response = await fetch(`${API_BASE}${path}`, { ...options, headers }); }
  catch { throw new ApiError(0, "The InsightDoc server is unavailable. Please try again shortly."); }
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined" && token) window.dispatchEvent(new Event("insightdoc:unauthorized"));
    let message = `Request failed (${response.status})`;
    try { const body = await response.json(); message = typeof body.detail === "string" ? body.detail : message; } catch {}
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}
