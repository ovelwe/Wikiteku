import { afterEach, describe, expect, it, vi } from "vitest";
import { BodyTooLarge, boundedBody, sameOrigin } from "../src/server/request";

afterEach(() => vi.unstubAllEnvs());

describe("request boundaries", () => {
  it("requires the configured origin, including scheme and port", () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://wiki.example");
    for (const origin of [
      null,
      "null",
      "http://wiki.example",
      "https://wiki.example.evil",
      "https://wiki.example:444",
    ]) {
      expect(
        sameOrigin(
          new Request("https://internal.example/api/themes", {
            headers: origin ? { origin } : {},
          }),
        ),
      ).toBe(false);
    }
    expect(
      sameOrigin(
        new Request("https://internal.example/api/themes", {
          headers: { origin: "https://wiki.example" },
        }),
      ),
    ).toBe(true);
  });

  it("reads the exact byte boundary and accepts an empty body", async () => {
    const bytes = new TextEncoder().encode("Привет");
    expect(
      await boundedBody(
        new Request("http://localhost", { method: "POST", body: bytes }),
        bytes.length,
      ),
    ).toEqual(bytes);
    expect(await boundedBody(new Request("http://localhost"), 10)).toEqual(
      new Uint8Array(),
    );
  });

  it("rejects oversized content-length before reading", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: "{}",
      headers: { "content-length": "100" },
    });
    await expect(boundedBody(request, 10)).rejects.toBeInstanceOf(BodyTooLarge);
    expect(request.bodyUsed).toBe(false);
  });

  it.each([undefined, "1"])(
    "caps streamed bytes despite content-length %s and cancels upstream",
    async (declared) => {
      const cancel = vi.fn();
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(8));
          controller.enqueue(new Uint8Array(8));
        },
        cancel,
      });
      const request = new Request("http://localhost", {
        method: "POST",
        body,
        duplex: "half",
        headers: declared ? { "content-length": declared } : {},
      } as RequestInit & { duplex: string });
      await expect(boundedBody(request, 10)).rejects.toBeInstanceOf(
        BodyTooLarge,
      );
      expect(cancel).toHaveBeenCalledOnce();
      expect(body.locked).toBe(false);
    },
  );

  it("propagates stream failures and releases the lock", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error("disconnected"));
      },
    });
    const request = new Request("http://localhost", {
      method: "POST",
      body,
      duplex: "half",
    } as RequestInit & { duplex: string });
    await expect(boundedBody(request, 10)).rejects.toThrow("disconnected");
    expect(body.locked).toBe(false);
  });
});
