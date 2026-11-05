// Local integration checks. setup creates one explicitly synthetic article; verify retains it for browser review.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import pg from "pg";

const connection = new URL(process.env.DATABASE_URL);
assert(
  ["localhost", "127.0.0.1"].includes(connection.hostname) &&
    connection.pathname === "/wikiteku",
);
const client = new pg.Client({ connectionString: connection.toString() });
await client.connect();
const base = "http://localhost:3000";
const fixturePath = new URL(
  "../artifacts/translation-fixture.json",
  import.meta.url,
);
const markdown =
  '# Лунный архив\n\nЭто тестовая энциклопедия о путешествиях на Луну.\n\n## Герои\n\nЧитайте [[test-page|историю героя]] и [справочник](https://example.com/guide_(moon)).\n\n| Имя | Роль |\n| --- | --- |\n| Алиса | Исследователь |\n\n```js\nconst message = "Этот код не переводить";\n```\n\n> Здесь начинается новая история.\n';
const owner = await client
  .query('select id from "user" where email=$1', [
    "phase1-20261022@example.invalid",
  ])
  .then((r) => r.rows[0]);
const outsider = await client
  .query('select id from "user" where email=$1', [
    "outside-20261022@example.invalid",
  ])
  .then((r) => r.rows[0]);
const fandom = await client
  .query("select id,owner_id,visibility from fandoms where slug='phase1-test'")
  .then((r) => r.rows[0]);
assert(
  owner && outsider && fandom?.owner_id === owner.id,
  "Existing synthetic fixtures required",
);
async function login(email, password) {
  assert(password, "Set SMOKE_OWNER_PASSWORD and SMOKE_OUTSIDER_PASSWORD");
  const response = await fetch(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: base },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200);
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
}
let fixture;
let original;
let quota;
let quotaKey;
let visibilityChanged = false;
try {
  if (process.argv[2] === "setup") {
    const id = randomUUID();
    const slug = `translation-smoke-${id.slice(0, 8)}`;
    const title = "Проверка перевода";
    const summary =
      "Синтетическая статья для проверки перевода и сохранности разметки.";
    await client.query(
      "insert into pages(id,fandom_id,slug,title,summary,markdown,status,author_id,tags) values($1,$2,$3,$4,$5,$6,'published',$7,$8)",
      [
        id,
        fandom.id,
        slug,
        title,
        summary,
        markdown,
        owner.id,
        ["translation-smoke"],
      ],
    );
    await client.query(
      "insert into page_revisions(id,page_id,revision,title,markdown,editor_id,snapshot) values($1,$2,1,$3,$4,$5,$6)",
      [
        randomUUID(),
        id,
        title,
        markdown,
        owner.id,
        JSON.stringify({
          summary,
          tags: ["translation-smoke"],
          categories: [],
          cover: "",
        }),
      ],
    );
    await writeFile(fixturePath, JSON.stringify({ id, slug }, null, 2));
    console.log(
      `Created synthetic article: ${base}/f/phase1-test/pages/${id}/translation`,
    );
  } else {
    fixture = JSON.parse(await readFile(fixturePath, "utf8"));
    original = (
      await client.query(
        "select * from pages where id=$1 and fandom_id=$2 and author_id=$3 and tags @> ARRAY['translation-smoke']::text[]",
        [fixture.id, fandom.id, owner.id],
      )
    ).rows[0];
    assert(
      original && original.markdown === markdown,
      "Only the newly created synthetic article can be tested",
    );
    const cookie = await login(
      "phase1-20261022@example.invalid",
      process.env.SMOKE_OWNER_PASSWORD,
    );
    const outsideCookie = await login(
      "outside-20261022@example.invalid",
      process.env.SMOKE_OUTSIDER_PASSWORD,
    );
    const endpoint = `${base}/api/fandoms/phase1-test/pages/${fixture.id}/translation`;
    const view = `${base}/f/phase1-test/pages/${fixture.id}/translation`;
    const body = { source: "ru", target: "en", revision: original.revision };
    const request = (method, payload, auth = cookie, origin = base) =>
      fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json", origin, cookie: auth },
        body: JSON.stringify(payload),
      });
    const cached = (
      await client.query(
        "select * from article_translations where page_id=$1 and source_revision=$2 and status='ready'",
        [fixture.id, original.revision],
      )
    ).rows[0];
    assert(
      cached?.content,
      "Generate the translation in the browser before verify",
    );
    assert(
      cached.content.markdown.includes(
        'const message = "Этот код не переводить";',
      ),
    );
    assert(
      cached.content.markdown.includes("https://example.com/guide_(moon)"),
    );
    assert(cached.content.markdown.includes("[[test-page|"));
    assert.equal((await request("POST", body, "")).status, 401);
    assert.equal(
      (await request("POST", body, cookie, "https://evil.example")).status,
      403,
    );
    assert.equal(
      (await request("POST", { ...body, target: "ru" })).status,
      400,
    );
    assert.equal(
      (await request("POST", { ...body, revision: original.revision + 1 }))
        .status,
      409,
    );
    const quotaBefore = (
      await client.query(
        "select key,count from resource_quotas where key like 'translation:%' order by key",
      )
    ).rows;
    assert.equal((await request("POST", body)).status, 200);
    assert.deepEqual(
      (
        await client.query(
          "select key,count from resource_quotas where key like 'translation:%' order by key",
        )
      ).rows,
      quotaBefore,
      "Cache hit consumed quota",
    );
    await client.query("update fandoms set visibility='private' where id=$1", [
      fandom.id,
    ]);
    visibilityChanged = true;
    assert.equal((await fetch(view, { headers: { cookie } })).status, 200);
    assert.equal(
      (await fetch(view, { headers: { cookie: outsideCookie } })).status,
      404,
    );
    assert.equal((await fetch(view)).status, 404);
    assert.equal((await request("POST", body, outsideCookie)).status, 404);
    await client.query("update fandoms set visibility=$2 where id=$1", [
      fandom.id,
      fandom.visibility,
    ]);
    visibilityChanged = false;
    assert.equal(
      (
        await request(
          "PATCH",
          { ...body, version: 0, content: cached.content },
          outsideCookie,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await request("PATCH", {
          ...body,
          version: 0,
          content: {
            ...cached.content,
            markdown: cached.content.markdown.replace(
              "https://example.com/guide_(moon)",
              "https://evil.example",
            ),
          },
        })
      ).status,
      400,
    );
    const prior =
      (
        await client.query(
          "select version from translation_corrections where translation_id=$1",
          [cached.id],
        )
      ).rows[0]?.version ?? 0;
    const correction = { ...cached.content, title: "Moon archive — reviewed" };
    const concurrent = await Promise.all([
      request("PATCH", { ...body, version: prior, content: correction }),
      request("PATCH", { ...body, version: prior, content: correction }),
    ]);
    assert.deepEqual(
      concurrent.map((r) => r.status).sort(),
      [200, 409],
      "Concurrent correction did not conflict",
    );
    assert(
      (await (await fetch(view, { headers: { cookie } })).text()).includes(
        "Moon archive — reviewed",
      ),
    );
    assert.deepEqual(
      (
        await client.query(
          "select content from article_translations where id=$1",
          [cached.id],
        )
      ).rows[0].content,
      cached.content,
      "Machine version was overwritten",
    );
    await client.query("update pages set revision=revision+1 where id=$1", [
      fixture.id,
    ]);
    assert(
      !(await (await fetch(view, { headers: { cookie } })).text()).includes(
        "Moon archive — reviewed",
      ),
      "Old revision correction leaked into new revision",
    );
    const day = new Date().toISOString().slice(0, 10);
    quotaKey = `translation:requests:${day}:${owner.id}`;
    quota = (
      await client.query("select count from resource_quotas where key=$1", [
        quotaKey,
      ])
    ).rows[0];
    await client.query(
      "insert into resource_quotas(key,count) values($1,10) on conflict(key) do update set count=10",
      [quotaKey],
    );
    assert.equal(
      (await request("POST", { ...body, revision: original.revision + 1 }))
        .status,
      429,
    );
    await client.query("update pages set status='draft' where id=$1", [
      fixture.id,
    ]);
    assert.equal((await request("POST", body)).status, 404);
    await client.query(
      "update pages set status='published',deleted_at=now() where id=$1",
      [fixture.id],
    );
    assert.equal((await fetch(view, { headers: { cookie } })).status, 404);
    assert.equal(
      (
        await client.query("select markdown from pages where id=$1", [
          fixture.id,
        ])
      ).rows[0].markdown,
      markdown,
    );
    console.log(
      "PASS: original/code/links preserved; authentication; origin; cache without quota; languages; stale revision; editor rights; structure checks; correction conflicts; machine version retained; quota; draft/archive.",
    );
  }
} finally {
  if (visibilityChanged)
    await client.query("update fandoms set visibility=$2 where id=$1", [
      fandom.id,
      fandom.visibility,
    ]);
  if (quotaKey) {
    if (quota)
      await client.query("update resource_quotas set count=$2 where key=$1", [
        quotaKey,
        quota.count,
      ]);
    else
      await client.query("delete from resource_quotas where key=$1", [
        quotaKey,
      ]);
  }
  if (original)
    await client.query(
      "update pages set revision=$2,status=$3,deleted_at=$4 where id=$1",
      [fixture.id, original.revision, original.status, original.deleted_at],
    );
  await client.end();
}
