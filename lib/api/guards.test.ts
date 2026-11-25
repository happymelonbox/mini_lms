import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { checkMutationHeaders, parseJsonBody, parsePageQuery } from "./guards";

const ORIGIN = "http://app.test";
const req = (headers: Record<string, string>, body = "{}") =>
  new Request("http://app.test/api/x", { method: "POST", headers, body });

describe("checkMutationHeaders", () => {
  it.each<{
    name: string;
    headers: Record<string, string>;
    appOrigin: string | undefined;
    status: number | null;
  }>([
    {
      name: "ok",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      appOrigin: ORIGIN,
      status: null,
    },
    {
      name: "json with charset",
      headers: { origin: ORIGIN, "content-type": "application/json; charset=utf-8" },
      appOrigin: ORIGIN,
      status: null,
    },
    {
      name: "missing origin",
      headers: { "content-type": "application/json" },
      appOrigin: ORIGIN,
      status: 403,
    },
    {
      name: "wrong origin",
      headers: { origin: "http://evil.test", "content-type": "application/json" },
      appOrigin: ORIGIN,
      status: 403,
    },
    {
      name: "origin prefix trick",
      headers: { origin: ORIGIN + ".evil.test", "content-type": "application/json" },
      appOrigin: ORIGIN,
      status: 403,
    },
    {
      name: "APP_ORIGIN unset fails closed",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      appOrigin: undefined,
      status: 403,
    },
    {
      name: "wrong content type",
      headers: { origin: ORIGIN, "content-type": "text/plain" },
      appOrigin: ORIGIN,
      status: 415,
    },
    { name: "no content type", headers: { origin: ORIGIN }, appOrigin: ORIGIN, status: 415 },
  ])("$name", ({ headers, appOrigin, status }) => {
    vi.stubEnv("APP_ORIGIN", appOrigin);
    const res = checkMutationHeaders(req(headers));
    expect(res?.status ?? null).toBe(status);
  });
});

describe("parseJsonBody", () => {
  const schema = z.object({ a: z.number() }).strict();
  it.each([
    { name: "valid", body: '{"a":1}', status: 200 },
    { name: "malformed", body: "{nope", status: 400 },
    { name: "schema violation", body: '{"a":"x"}', status: 400 },
    { name: "unknown key", body: '{"a":1,"b":2}', status: 400 },
  ])("$name", async ({ body, status }) => {
    const r = await parseJsonBody(req({ "content-type": "application/json" }, body), schema);
    expect("data" in r ? 200 : r.response.status).toBe(status);
  });
});

describe("parseJsonBody size limit (10 KB = 10240 bytes)", () => {
  const schema = z.object({ pad: z.string() });
  const bodyOf = (bytes: number) =>
    JSON.stringify({ pad: "x".repeat(bytes - '{"pad":""}'.length) });
  const chunked = (text: string, size = 1024) => {
    const bytes = new TextEncoder().encode(text);
    let i = 0;
    return new ReadableStream<Uint8Array>({
      pull(c) {
        if (i >= bytes.length) return c.close();
        c.enqueue(bytes.slice(i, (i += size)));
      },
    });
  };
  it.each([
    { name: "well under", bytes: 100, stream: false, status: 200 },
    { name: "exactly at the limit", bytes: 10_240, stream: false, status: 200 },
    { name: "one byte over", bytes: 10_241, stream: false, status: 413 },
    { name: "chunked (no content-length) under", bytes: 5_000, stream: true, status: 200 },
    { name: "chunked (no content-length) at the limit", bytes: 10_240, stream: true, status: 200 },
    { name: "chunked (no content-length) over", bytes: 10_241, stream: true, status: 413 },
  ])("$name", async ({ bytes, stream, status }) => {
    const text = bodyOf(bytes);
    const r = new Request("http://app.test/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      ...(stream ? { body: chunked(text), duplex: "half" } : { body: text }),
    } as RequestInit);
    const res = await parseJsonBody(r, schema);
    expect("data" in res ? 200 : res.response.status).toBe(status);
  });
  it.each([
    {
      name: "rejects on a declared content-length before reading",
      headers: { "content-length": "99999" },
      text: "{}",
    },
    // 5.2k chars but ~10.4 KB in UTF-8: bytes are counted, not characters
    {
      name: "counts bytes, not characters",
      headers: {} as Record<string, string>,
      text: JSON.stringify({ pad: "é".repeat(5_200) }),
    },
  ])("$name", async ({ headers, text }) => {
    const res = await parseJsonBody(
      req({ "content-type": "application/json", ...headers }, text),
      schema,
    );
    expect("data" in res ? 200 : res.response.status).toBe(413);
  });
});

describe("parsePageQuery", () => {
  it.each([
    { q: "?after=x", ok: false }, // rules live in schema.test.ts; this proves the query string is read
  ])("$q", ({ q, ok }) => {
    expect("query" in parsePageQuery(new Request(`http://app.test/x${q}`))).toBe(ok);
  });
});
