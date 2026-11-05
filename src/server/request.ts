export class BodyTooLarge extends Error {
  constructor() {
    super("Слишком большой запрос");
  }
}

export function sameOrigin(request: Request) {
  return (
    request.headers.get("origin") ===
    new URL(process.env.BETTER_AUTH_URL ?? request.url).origin
  );
}
export async function boundedBody(
  request: Request,
  limit: number,
): Promise<Uint8Array> {
  if (Number(request.headers.get("content-length")) > limit)
    throw new BodyTooLarge();
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const parts: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) {
        // Do not let cancellation of an untrusted stream delay rejection.
        void reader.cancel().catch(() => {});
        throw new BodyTooLarge();
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
