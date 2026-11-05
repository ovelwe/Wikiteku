// Read-only page checks and rejected requests against the local synthetic account.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const base = "http://localhost:3000";
const fixture = JSON.parse(
  await readFile(
    new URL("../artifacts/moderation-fixture.json", import.meta.url),
    "utf8",
  ),
);
assert(
  fixture.slug.startsWith("moderation-smoke-") &&
    process.env.SMOKE_OWNER_PASSWORD,
);
const login = await fetch(`${base}/api/auth/sign-in/email`, {
  method: "POST",
  headers: { origin: base, "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "phase1-20261022@example.invalid",
    password: process.env.SMOKE_OWNER_PASSWORD,
  }),
});
assert.equal(login.status, 200);
const session = login.headers
  .getSetCookie()
  .map((v) => v.split(";")[0])
  .join("; ");
const cases = [
  ["/login", "С возвращением", "Welcome back"],
  ["/register", "Создать аккаунт", "Create account"],
  ["/create", "Адрес фандома", "Fandom address"],
  ["/settings", "Настройки профиля", "Profile settings"],
  ["/f/phase1-test/settings", "Управление фандомом", "Manage fandom"],
  ["/f/phase1-test/pages/new", "Новая статья", "New article"],
  [
    `/f/phase1-test/pages/${fixture.id}/edit`,
    "Текст Markdown",
    "Markdown text",
  ],
  [`/f/phase1-test/pages/${fixture.id}/history`, "История", "History"],
  ["/f/phase1-test/library", "Энциклопедия", "Encyclopedia"],
  ["/f/phase1-test/library?trash=1", "Корзина", "Trash"],
  ["/f/phase1-test/media", "Медиатека", "Media library"],
  ["/explore", "Каталог фандомов", "Fandom directory"],
  [
    "/search?q=localization-no-result",
    "Статьи не найдены",
    "No articles found",
  ],
  ["/u/phase1test", "Изменить профиль", "Edit profile"],
  [`/f/phase1-test/wiki/${fixture.slug}`, "Последняя правка", "Last edit"],
];
for (const locale of ["ru", "en"]) {
  const cookie = `${session}; locale=${locale}`;
  for (const [path, ru, en] of cases) {
    const response = await fetch(`${base}${path}`, {
      headers: { cookie },
      redirect: "manual",
    });
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert(html.includes(`lang="${locale}"`), `${path}: lang`);
    assert(
      html.includes(locale === "en" ? en : ru),
      `${path}: localized label`,
    );
    assert(!html.includes(">labels."), `${path}: accidental literal label`);
  }
  const error = await fetch(`${base}/create?error=addressTaken`, {
    headers: { cookie },
  }).then((r) => r.text());
  assert(
    error.includes(
      locale === "en"
        ? "This address is already taken."
        : "Такой адрес уже занят",
    ),
  );
  const unknown = await fetch(`${base}/settings?error=PRIVATE_ERROR_SENTINEL`, {
    headers: { cookie },
  }).then((r) => r.text());
  assert(
    unknown.includes(
      locale === "en"
        ? "Could not save changes."
        : "Не удалось сохранить изменения",
    ),
  );
  assert(!unknown.includes('role="alert">PRIVATE_ERROR_SENTINEL'));
  const missing = await fetch(`${base}/missing-localization-test`, {
    headers: { cookie },
  });
  assert.equal(missing.status, 404);
  assert(
    (await missing.text()).includes(
      locale === "en" ? "Page not found" : "Страница не найдена",
    ),
  );
  const body = new FormData();
  body.set(
    "file",
    new Blob(["not an image"], { type: "image/png" }),
    "invalid.png",
  );
  const upload = await fetch(`${base}/api/fandoms/phase1-test/media`, {
    method: "POST",
    headers: { cookie, origin: base },
    body,
  });
  assert.equal(upload.status, 400);
  assert.deepEqual(await upload.json(), {
    code: "imageFailed",
    error:
      locale === "en"
        ? "Could not process the image."
        : "Не удалось обработать изображение",
  });
}
// The synthetic owner must not retain the temporary moderation grant from the previous smoke test.
assert.equal(
  (await fetch(`${base}/moderation`, { headers: { cookie: session } })).status,
  404,
);
assert.equal(
  (
    await fetch(`${base}/api/reports`, {
      method: "PATCH",
      headers: {
        cookie: session,
        origin: base,
        "Content-Type": "application/json",
      },
      body: "{}",
    })
  ).status,
  403,
);
console.log(
  "PASS: 15 pages in RU/EN, localized validation and media errors, safe unknown-error fallback, 404 page, and temporary moderation privileges removed.",
);
