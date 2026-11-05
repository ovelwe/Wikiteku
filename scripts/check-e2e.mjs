import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import pg from "pg";

const url = new URL(process.env.DATABASE_URL ?? "");
assert(
  [
    "localhost",
    "127.0.0.1",
    ...(process.env.CI === "true" ? ["postgres"] : []),
  ].includes(url.hostname) && /^\/wikiteku_ci(?:_|$)/.test(url.pathname),
  "Isolated local CI database only",
);
const base = new URL(process.env.SMOKE_BASE_URL ?? "http://localhost:3000");
assert(["localhost", "127.0.0.1"].includes(base.hostname));
const password = process.env.SMOKE_CI_PASSWORD;
assert(password?.length >= 16, "Set SMOKE_CI_PASSWORD");
const client = new pg.Client({ connectionString: url.href });
await client.connect();
const actors = ["owner", "outsider"];
async function request(path, cookie = "", init = {}) {
  return fetch(new URL(path, base), {
    ...init,
    redirect: "manual",
    headers: { cookie, origin: base.origin, ...init.headers },
    signal: AbortSignal.timeout(20000),
  });
}
async function login(actor) {
  const response = await request("/api/auth/sign-in/email", "", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: `ci-${actor}@example.invalid`, password }),
  });
  assert.equal(response.status, 200, "Real Better Auth login");
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
}
const decode = (value) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
function attribute(tag, name) {
  return decode(new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(tag)?.[1] ?? "");
}
async function action(path, cookie, marker, values) {
  const page = await request(path, cookie);
  assert.equal(page.status, 200, path);
  const html = await page.text();
  const form = [...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)]
    .map((match) => match[0])
    .find((form) => form.includes(marker));
  assert(form, `Server form not found: ${path}`);
  const data = new FormData();
  for (const [tag] of form.matchAll(/<input\b[^>]*>/g)) {
    const name = attribute(tag, "name");
    if (name.startsWith("$ACTION_")) data.append(name, attribute(tag, "value"));
  }
  assert(data.size || [...data].length, "Server Action envelope missing");
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  const response = await request(path, cookie, { method: "POST", body: data });
  assert([303, 307].includes(response.status), `${path}: ${response.status}`);
  const location = response.headers.get("location");
  assert(
    location && !location.includes("error="),
    `Action failed: ${location}`,
  );
  return location;
}
try {
  if (process.argv.includes("--setup")) {
    assert.equal(
      (await client.query('select count(*)::int as n from "user"')).rows[0].n,
      0,
      "Setup requires an empty CI database; existing data is never replaced",
    );
    const hash = await hashPassword(password);
    for (const actor of actors) {
      const id = `ci-${actor}`;
      await client.query(
        'insert into "user"(id,name,email,email_verified,username) values($1,$2,$3,true,$4)',
        [id, `CI ${actor}`, `ci-${actor}@example.invalid`, `ci_${actor}`],
      );
      await client.query(
        "insert into account(id,account_id,provider_id,user_id,password) values($1,$2,$3,$2,$4)",
        [randomUUID(), id, "credential", hash],
      );
    }
    console.log(
      "CI-only accounts provisioned with Better Auth password hashing",
    );
  }
  const owner = await login("owner");
  const outsider = await login("outsider");
  const slug = `ci-${randomUUID().slice(0, 8)}`;
  await action("/create", owner, 'name="description"', {
    title: "CI энциклопедия",
    slug,
    description: "Синтетическая проверка полного серверного сценария",
    category: "other",
    language: "ru",
    visibility: "public",
    tags: "Лор, CI",
  });
  const fandom = (
    await client.query(
      "select id from fandoms where slug=$1 and owner_id='ci-owner'",
      [slug],
    )
  ).rows[0];
  assert(fandom, "Creation must persist in PostgreSQL");
  const markdown =
    "# CI статья\n\nТекст проверки.\n\n[bad](javascript:alert(1))\n\n<script>window.bad=true</script>";
  await action(`/f/${slug}/pages/new`, owner, 'name="markdown"', {
    title: "CI статья",
    slug: "ci-article",
    summary: "Первая версия",
    markdown,
    tags: "Лор",
    categories: "Проверка",
    cover: "",
    status: "published",
  });
  let article = (
    await client.query("select * from pages where fandom_id=$1", [fandom.id])
  ).rows[0];
  assert.equal(article.revision, 1);
  const edit = `/f/${slug}/pages/${article.id}/edit`;
  assert(
    [303, 307].includes((await request(edit, outsider)).status),
    "Outsider editor rejected",
  );
  const href = `/f/${slug}/wiki/ci-article`;
  const response = await request(href);
  assert.equal(response.status, 200);
  assert(
    !(await response.text()).includes('href="javascript:'),
    "Executable link rendered",
  );
  await action(edit, owner, 'name="markdown"', {
    title: "CI статья",
    slug: "ci-article",
    summary: "Вторая версия",
    markdown: `${markdown}\n\nСохранено.`,
    tags: "Лор",
    categories: "Проверка",
    cover: "",
    status: "published",
    revision: "1",
  });
  article = (
    await client.query("select * from pages where id=$1", [article.id])
  ).rows[0];
  assert.equal(article.revision, 2);
  assert(article.markdown.endsWith("Сохранено."));
  assert(
    (await (await request(href)).text()).includes("Вторая версия"),
    "Reload lost saved content",
  );
  assert.equal(
    (
      await client.query(
        "select count(*)::int as n from page_revisions where page_id=$1",
        [article.id],
      )
    ).rows[0].n,
    2,
  );

  const report = await request("/api/reports", outsider, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      pageId: article.id,
      revision: 2,
      reason: "other",
      details: "Синтетическое обращение CI",
    }),
  });
  assert.equal(report.status, 200);
  assert(
    (await (await request("/reports", outsider)).text()).includes(
      "Синтетическое обращение CI",
    ),
  );
  assert(
    !(await (await request("/reports", owner)).text()).includes(
      "Синтетическое обращение CI",
    ),
  );
  assert.equal((await request("/moderation", owner)).status, 404);
  await action(`/f/${slug}/settings`, owner, 'name="visibility"', {
    title: "CI энциклопедия",
    description: "Синтетическая проверка полного серверного сценария",
    category: "other",
    language: "ru",
    visibility: "private",
    tags: "Лор, CI",
  });
  assert.equal((await request(href)).status, 404);
  assert.equal((await request(href, outsider)).status, 404);
  assert.equal((await request(href, owner)).status, 200);
  assert(!(await (await request("/sitemap.xml")).text()).includes(slug));
  const logout = await request("/api/auth/sign-out", owner, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  assert.equal(logout.status, 200);
  assert(
    [303, 307].includes((await request("/settings", owner)).status),
    "Revoked session still accepted",
  );
  console.log(
    "PASS: real login, Server Actions create/edit, persistence/revisions, untrusted Markdown, outsider denial, report privacy, private visibility, logout",
  );
} finally {
  await client.end();
}
