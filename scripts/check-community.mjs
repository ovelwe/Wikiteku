// Opt-in live smoke test. Only the existing synthetic phase1-test fixture is touched.
// Run against the local app with DATABASE_URL, SMOKE_OWNER_PASSWORD and SMOKE_OUTSIDER_PASSWORD.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

const url = new URL(process.env.DATABASE_URL);
assert(
  ["localhost", "127.0.0.1"].includes(url.hostname) &&
    url.pathname === "/wikiteku",
  "Use the local wikiteku database only",
);
const base = "http://localhost:3000";
const client = new pg.Client({ connectionString: url.toString() });
await client.connect();
const inserted = [];
let fandom;
let page;
async function login(email, password) {
  assert(password, "Set both SMOKE passwords for the synthetic accounts");
  const response = await fetch(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: base },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200, `Login failed: ${email}`);
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
}
async function get(path, cookie = "") {
  const response = await fetch(`${base}${path}`, {
    headers: { cookie },
    redirect: "manual",
  });
  return { status: response.status, text: await response.text() };
}
try {
  const result = await client.query(
    `select f.id, f.visibility, f.title from fandoms f join "user" u on u.id=f.owner_id where f.slug='phase1-test' and u.email='phase1-20261022@example.invalid'`,
  );
  fandom = result.rows[0];
  assert(fandom, "Synthetic owner/fandom fixture is required");
  page = (
    await client.query(
      "select id,status,deleted_at from pages where fandom_id=$1 and slug='test-page'",
      [fandom.id],
    )
  ).rows[0];
  assert(page, "Synthetic article fixture is required");
  const actors = (
    await client.query(
      `select id,email from "user" where email in ('phase1-20261022@example.invalid','outside-20261022@example.invalid')`,
    )
  ).rows;
  assert.equal(actors.length, 2);
  const outsider = actors.find((actor) => actor.email.startsWith("outside-"));
  assert.equal(
    (
      await client.query(
        "select id from fandom_members where fandom_id=$1 and user_id=$2",
        [fandom.id, outsider.id],
      )
    ).rowCount,
    0,
    "Outsider must not be a member",
  );
  const ownerCookie = await login(
    "phase1-20261022@example.invalid",
    process.env.SMOKE_OWNER_PASSWORD,
  );
  const outsiderCookie = await login(
    "outside-20261022@example.invalid",
    process.env.SMOKE_OUTSIDER_PASSWORD,
  );
  for (const actor of actors) {
    const id = randomUUID();
    const row = await client.query(
      "insert into favorites(id,user_id,fandom_id) values($1,$2,$3) on conflict(user_id,fandom_id) do nothing returning id",
      [id, actor.id, fandom.id],
    );
    if (row.rowCount) inserted.push(id);
  }
  const articleHref = "/f/phase1-test/wiki/test-page";
  await client.query("update fandoms set visibility='public' where id=$1", [
    fandom.id,
  ]);
  await client.query(
    "update pages set status='published',deleted_at=null where id=$1",
    [page.id],
  );
  let response = await get("/activity", outsiderCookie);
  assert.equal(response.status, 200);
  assert(
    response.text.includes(articleHref),
    "Published article missing from feed",
  );
  await client.query("update pages set status='draft' where id=$1", [page.id]);
  assert(
    !(await get("/activity", ownerCookie)).text.includes(articleHref),
    "Draft leaked into feed",
  );
  await client.query(
    "update pages set status='published',deleted_at=now() where id=$1",
    [page.id],
  );
  assert(
    !(await get("/activity", ownerCookie)).text.includes(articleHref),
    "Archived article leaked into feed",
  );
  await client.query("update pages set deleted_at=null where id=$1", [page.id]);
  await client.query("update fandoms set visibility='private' where id=$1", [
    fandom.id,
  ]);
  assert(
    (await get("/activity", ownerCookie)).text.includes(articleHref),
    "Member lost access to private feed",
  );
  assert(
    !(await get("/activity", outsiderCookie)).text.includes(articleHref),
    "Private feed leaked to outsider",
  );
  response = await get("/favorites", outsiderCookie);
  assert(response.text.includes("Сообщество недоступно"));
  assert(
    !response.text.includes(fandom.title),
    "Private title leaked through saved card",
  );
  assert.equal(
    (await get("/f/phase1-test/members", outsiderCookie)).status,
    404,
  );
  assert.equal((await get("/f/phase1-test/members")).status, 404);
  assert.equal((await get("/f/phase1-test/members", ownerCookie)).status, 200);
  assert(
    [303, 307].includes((await get("/favorites")).status),
    "Anonymous favorites must require login",
  );
  assert(
    [303, 307].includes((await get("/activity")).status),
    "Anonymous feed must require login",
  );
  response = await get("/favorites", `${ownerCookie}; locale=en`);
  assert(
    response.text.includes("Your communities and their latest pages"),
    "English locale missing",
  );
  assert.equal((await get("/activity?page=1.01", ownerCookie)).status, 200);
  console.log(
    "PASS: published/draft/archive filters; private access; unavailable favorites; members; anonymous redirects; English; pagination.",
  );
} finally {
  if (page)
    await client.query("update pages set status=$2,deleted_at=$3 where id=$1", [
      page.id,
      page.status,
      page.deleted_at,
    ]);
  if (fandom)
    await client.query("update fandoms set visibility=$2 where id=$1", [
      fandom.id,
      fandom.visibility,
    ]);
  if (inserted.length)
    await client.query("delete from favorites where id=any($1::text[])", [
      inserted,
    ]);
  await client.end();
}
