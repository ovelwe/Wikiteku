import assert from "node:assert/strict";

const base = new URL(process.env.SMOKE_BASE_URL ?? "http://localhost:3000");
const local = ["localhost", "127.0.0.1"].includes(base.hostname);
assert(
  local ||
    (process.argv.includes("--public") &&
      base.origin === "https://wikiteku.vercel.app"),
  "Use localhost or explicitly verify the Wikiteku public deployment",
);
assert(
  local || !process.env.SMOKE_OWNER_PASSWORD,
  "Local test credentials must never be sent to production",
);
async function request(path, init = {}) {
  return fetch(new URL(path, base), {
    ...init,
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
}

const home = await request("/");
assert.equal(home.status, 200);
assert.equal(home.headers.get("x-content-type-options"), "nosniff");
assert.equal(home.headers.get("x-frame-options"), "DENY");
assert.match(
  home.headers.get("content-security-policy") ?? "",
  /frame-ancestors 'none'/,
);
assert.doesNotMatch(
  home.headers.get("content-security-policy") ?? "",
  /unsafe-eval/,
);
assert.equal(home.headers.get("x-powered-by"), null);
for (const path of ["/explore", "/search?q=security-smoke", "/sitemap.xml"])
  assert.equal((await request(path)).status, 200, path);

const id = "81f76762-885a-4541-b213-efc6c2185a35";
const routes = [
  ["/api/themes", "POST", [401]],
  ["/api/reports", "POST", [401]],
  ["/api/reports", "PATCH", [401]],
  ["/api/fandoms/phase1-test/design", "POST", [403]],
  [`/api/fandoms/phase1-test/pages/${id}/design`, "POST", [403]],
  ["/api/fandoms/phase1-test/media", "POST", [403]],
  [`/api/fandoms/phase1-test/pages/${id}/translation`, "POST", [401, 404]],
  [`/api/fandoms/phase1-test/pages/${id}/translation`, "PATCH", [401, 404]],
];
for (const [path, method, statuses] of routes) {
  for (const origin of [undefined, "https://untrusted.example"]) {
    const response = await request(path, {
      method,
      body: "{}",
      headers: origin ? { origin } : {},
    });
    assert.equal(response.status, 403, `${method} ${path}: origin`);
  }
  const response = await request(path, {
    method,
    body: "{}",
    headers: { origin: base.origin },
  });
  assert(
    statuses.includes(response.status),
    `${method} ${path}: anonymous ${response.status}`,
  );
}
for (const path of ["/settings", "/create", "/reports", "/moderation"]) {
  const response = await request(path);
  assert([303, 307].includes(response.status), path);
  assert.equal(response.headers.get("location"), "/login");
}
assert.equal((await request("/api/themes")).status, 401);
const registration = await request("/api/auth/sign-up/email", {
  method: "POST",
  body: "{}",
  headers: { origin: base.origin, "content-type": "application/json" },
});
assert.equal(
  registration.status,
  process.argv.includes("--registration-open") ? 400 : 403,
  "Registration must be closed or reject invalid input before account creation",
);

// Optional owner checks only reject input; no article/theme is saved.
if (process.env.SMOKE_OWNER_PASSWORD) {
  const login = await request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { origin: base.origin, "content-type": "application/json" },
    body: JSON.stringify({
      email: "phase1-20261022@example.invalid",
      password: process.env.SMOKE_OWNER_PASSWORD,
    }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  assert(cookie);
  assert.equal(
    (await request("/moderation", { headers: { cookie } })).status,
    404,
  );
  for (const [path, limit] of [
    ["/api/themes", 12000],
    ["/api/fandoms/phase1-test/design", 256000],
    [`/api/fandoms/phase1-test/pages/${id}/design`, 256000],
  ]) {
    async function* chunks() {
      // Cyrillic payload stays below the old character limit but exceeds bytes.
      yield JSON.stringify({ name: "я".repeat(Math.ceil(limit / 2)) });
    }
    const response = await request(path, {
      method: "POST",
      body: chunks(),
      duplex: "half",
      headers: {
        cookie,
        origin: base.origin,
        "content-type": "application/json",
      },
    });
    assert.equal(response.status, 413, `${path}: streamed UTF-8 byte limit`);
    const invalid = await request(path, {
      method: "POST",
      body: "{",
      headers: { cookie, origin: base.origin },
    });
    assert.equal(invalid.status, 400, `${path}: malformed JSON`);
  }
  console.log("Authenticated streamed body limits and malformed JSON: passed");
}
console.log(
  "Production headers, public DB reads, Origin, anonymous access and closed registration: passed",
);
