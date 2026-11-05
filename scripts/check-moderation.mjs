// Local-only synthetic fixture; retains reports and their audit trail for browser review.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import pg from "pg";

const connection = new URL(process.env.DATABASE_URL);
assert(
  ["localhost", "127.0.0.1"].includes(connection.hostname) &&
    connection.pathname === "/wikiteku",
);
const db = new pg.Client({ connectionString: connection.toString() });
await db.connect();
const base = "http://localhost:3000";
const path = new URL("../artifacts/moderation-fixture.json", import.meta.url);
const owner = (
  await db.query('select id from "user" where email=$1', [
    "phase1-20261022@example.invalid",
  ])
).rows[0];
const outsider = (
  await db.query('select id from "user" where email=$1', [
    "outside-20261022@example.invalid",
  ])
).rows[0];
const fandom = (
  await db.query(
    "select id,owner_id,visibility from fandoms where slug='phase1-test'",
  )
).rows[0];
assert(
  owner &&
    outsider &&
    fandom?.owner_id === owner.id &&
    fandom.visibility === "public",
);
let fixture;
let restoreQuota;
let quotaKey;
try {
  if (process.argv[2] === "setup") {
    const id = randomUUID();
    const slug = `moderation-smoke-${id.slice(0, 8)}`;
    const title = "Проверка модерации";
    const markdown =
      "# Архив экспедиции\n\nСинтетическая статья для проверки жалоб.\n\n## Запись наблюдателя\n\nЭтот текст сохраняется при блокировке и восстановлении.\n";
    await db.query(
      "insert into pages(id,fandom_id,slug,title,summary,markdown,status,author_id,tags) values($1,$2,$3,$4,$5,$6,'published',$7,$8)",
      [
        id,
        fandom.id,
        slug,
        title,
        "Тестовый материал: жалоба, проверка, решение и журнал.",
        markdown,
        owner.id,
        [slug],
      ],
    );
    await db.query(
      "insert into page_revisions(id,page_id,revision,title,markdown,editor_id) values($1,$2,1,$3,$4,$5)",
      [randomUUID(), id, title, markdown, owner.id],
    );
    await writeFile(path, JSON.stringify({ id, slug, moderatorId: owner.id }));
    console.log("Synthetic moderation fixture created.");
  } else {
    fixture = JSON.parse(await readFile(path, "utf8"));
    assert(fixture.slug.startsWith("moderation-smoke-"));
    const original = (
      await db.query("select * from pages where id=$1 and slug=$2", [
        fixture.id,
        fixture.slug,
      ])
    ).rows[0];
    assert(original?.author_id === owner.id && !original.blocked_at);
    async function login(email, password) {
      assert(password);
      const r = await fetch(`${base}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { origin: base, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      assert.equal(r.status, 200);
      return r.headers
        .getSetCookie()
        .map((v) => v.split(";")[0])
        .join("; ");
    }
    const moderator = await login(
      "phase1-20261022@example.invalid",
      process.env.SMOKE_OWNER_PASSWORD,
    );
    const reader = await login(
      "outside-20261022@example.invalid",
      process.env.SMOKE_OUTSIDER_PASSWORD,
    );
    async function mutate(cookie, body, method = "POST", origin = base) {
      return fetch(`${base}/api/reports`, {
        method,
        headers: { cookie, origin, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    const input = {
      pageId: fixture.id,
      revision: original.revision,
      reason: "other",
      details: `Проверка видимости жалобы ${fixture.slug}.`,
    };
    const get = (url, cookie = "") =>
      fetch(`${base}${url}`, { headers: { cookie }, redirect: "manual" });
    assert.equal((await mutate("", input)).status, 401);
    assert.equal(
      (await mutate(reader, input, "POST", "https://example.invalid")).status,
      403,
    );
    assert.equal(
      (await mutate(reader, { ...input, details: "x" })).status,
      400,
    );
    assert.equal(
      (await mutate(reader, { ...input, revision: 999999 })).status,
      409,
    );
    try {
      await db.query("update pages set status='draft' where id=$1", [
        fixture.id,
      ]);
      assert.equal((await mutate(reader, input)).status, 404);
      await db.query(
        "update pages set status='published', deleted_at=now() where id=$1",
        [fixture.id],
      );
      assert.equal((await mutate(reader, input)).status, 404);
      await db.query("update pages set deleted_at=null where id=$1", [
        fixture.id,
      ]);
      await db.query("update fandoms set visibility='private' where id=$1", [
        fandom.id,
      ]);
      assert.equal((await mutate(reader, input)).status, 404);
      assert.equal(
        (await get(`/f/phase1-test/pages/${fixture.id}/report`, reader)).status,
        404,
      );
    } finally {
      await db.query("update pages set status=$2, deleted_at=$3 where id=$1", [
        fixture.id,
        original.status,
        original.deleted_at,
      ]);
      await db.query("update fandoms set visibility=$2 where id=$1", [
        fandom.id,
        fandom.visibility,
      ]);
    }
    quotaKey = `reports:${outsider.id}:${new Date().toISOString().slice(0, 10)}`;
    restoreQuota =
      (
        await db.query("select count from resource_quotas where key=$1", [
          quotaKey,
        ])
      ).rows[0]?.count ?? null;
    await db.query(
      "insert into resource_quotas(key,count) values($1,10) on conflict(key) do update set count=10",
      [quotaKey],
    );
    assert.equal((await mutate(reader, input)).status, 429);
    await db.query("update resource_quotas set count=0 where key=$1", [
      quotaKey,
    ]);
    const results = await Promise.all([
      mutate(reader, input),
      mutate(reader, input),
    ]);
    assert(results.every((r) => r.status === 200));
    const open = (
      await db.query(
        "select * from reports where page_id=$1 and reporter_id=$2 and status='open'",
        [fixture.id, outsider.id],
      )
    ).rows;
    assert.equal(open.length, 1);
    assert.equal(
      (
        await db.query("select count from resource_quotas where key=$1", [
          quotaKey,
        ])
      ).rows[0].count,
      1,
    );
    assert.equal(open[0].snapshot.markdown, original.markdown);
    fixture.reportId = open[0].id;
    await writeFile(path, JSON.stringify(fixture));
    assert(
      (await (await get("/reports", reader)).text()).includes(input.details),
    );
    assert(
      !(await (await get("/reports", moderator)).text()).includes(
        input.details,
      ),
    );
    assert.equal(
      (await get(`/moderation/${fixture.reportId}`, reader)).status,
      404,
    );
    assert.equal(
      (await get(`/moderation/${fixture.reportId}`, moderator)).status,
      200,
    );
    const decision = {
      reportId: fixture.reportId,
      action: "block",
      revision: original.moderation_revision,
      pageRevision: original.revision,
      note: "Синтетическая проверка блокировки и журнала.",
    };
    assert.equal((await mutate(reader, decision, "PATCH")).status, 403);
    assert.equal(
      (await mutate(moderator, { ...decision, pageRevision: 999999 }, "PATCH"))
        .status,
      409,
    );
    const outcomes = await Promise.all([
      mutate(moderator, decision, "PATCH"),
      mutate(moderator, decision, "PATCH"),
    ]);
    assert.deepEqual(outcomes.map((r) => r.status).sort(), [200, 409]);
    const article = `/f/phase1-test/wiki/${fixture.slug}`;
    assert.equal((await get(article)).status, 404);
    assert.equal((await get(article, moderator)).status, 404);
    assert.equal(
      (await get(`/f/phase1-test/pages/${fixture.id}/translation`, reader))
        .status,
      404,
    );
    assert.equal(
      (await get(`/f/phase1-test/pages/${fixture.id}/report`, reader)).status,
      404,
    );
    assert.equal((await mutate(reader, input)).status, 404);
    for (const url of [
      `/search?q=${fixture.slug}`,
      "/sitemap.xml",
      "/",
      "/f/phase1-test",
      "/f/phase1-test/library",
      "/u/phase1test",
    ]) {
      assert(
        !(await (await get(url)).text()).includes(article),
        `Blocked article leaked at ${url}`,
      );
    }
    assert(
      !(await (await get("/activity", moderator)).text()).includes(article),
    );
    assert(
      (
        await (
          await get(`/f/phase1-test/pages/${fixture.id}/edit`, moderator)
        ).text()
      ).includes("Статья скрыта модератором"),
    );
    const blocked = (
      await db.query("select * from pages where id=$1", [fixture.id])
    ).rows[0];
    assert(blocked.blocked_at);
    assert.equal(blocked.markdown, original.markdown);
    assert.equal(blocked.revision, original.revision);
    assert.equal(
      (await mutate(moderator, { ...decision, action: "unblock" }, "PATCH"))
        .status,
      409,
    );
    assert.equal(
      (
        await mutate(
          moderator,
          {
            ...decision,
            action: "unblock",
            revision: blocked.moderation_revision,
            note: "Проверка завершена, доступ к тестовой статье восстановлен.",
          },
          "PATCH",
        )
      ).status,
      200,
    );
    assert.equal((await get(article)).status, 200);
    const events = (
      await db.query(
        "select action from moderation_events where report_id=$1 order by moderation_revision",
        [fixture.reportId],
      )
    ).rows;
    assert.deepEqual(
      events.map((e) => e.action),
      ["block", "unblock"],
    );
    assert(
      (await (await get("/reports", `${reader}; locale=en`)).text()).includes(
        "My reports",
      ),
    );
    console.log(
      "PASS: validation, origin, login, quota, duplicate submission, report privacy, moderator authorization, concurrent decisions, stale revisions, public hiding, unchanged content, unblock, audit and EN.",
    );
  }
} finally {
  if (quotaKey) {
    if (restoreQuota === null)
      await db.query("delete from resource_quotas where key=$1", [quotaKey]);
    else
      await db.query("update resource_quotas set count=$2 where key=$1", [
        quotaKey,
        restoreQuota,
      ]);
  }
  await db.end();
}
