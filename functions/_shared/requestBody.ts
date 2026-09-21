/** Read JSON with a byte budget even when Content-Length is absent or dishonest. */
export class RequestBodyError extends Error {
  readonly status: 400 | 413;
  constructor(message: string, status: 400 | 413) { super(message); this.status = status; }
}

export async function readJsonRecord(request: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new RequestBodyError("Request payload is too large.", 413);
  if (!request.body) throw new RequestBodyError("A JSON object is required.", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new RequestBodyError("Request payload is too large.", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const buffer = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Not an object.");
    return value as Record<string, unknown>;
  } catch { throw new RequestBodyError("A valid JSON object is required.", 400); }
}
