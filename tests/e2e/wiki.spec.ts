import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus) {
    console.log("Browser failure URL:", page.url());
    console.log(
      "Visible content:",
      (
        await page
          .locator("main")
          .textContent()
          .catch(() => "")
      )?.slice(0, 4000),
    );
  }
});

test("login, create, publish, edit and reload through the browser", async ({
  page,
  browser,
}) => {
  const base = new URL(process.env.SMOKE_BASE_URL ?? "http://localhost:3000");
  expect(["localhost", "127.0.0.1"]).toContain(base.hostname);
  const password = process.env.SMOKE_CI_PASSWORD;
  expect(password).toBeTruthy();
  const slug = `browser-${randomUUID().slice(0, 8)}`;
  await page.goto("/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill("ci-owner@example.invalid");
  await page.getByLabel("Пароль", { exact: true }).fill(password ?? "");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(`${base.origin}/`);
  await page.goto("/create");
  await page
    .getByLabel("Название", { exact: true })
    .fill("Браузерная проверка");
  await page.getByLabel(/^Адрес фандома/).fill(slug);
  await page
    .getByLabel("Описание", { exact: true })
    .fill("Синтетическая проверка интерфейса в Chromium.");
  await page
    .getByRole("button", { name: "Создать фандом", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/f/${slug}$`));
  await page.goto(`/f/${slug}/pages/new`);
  await page
    .getByRole("textbox", { name: "Заголовок", exact: true })
    .fill("Статья Chromium");
  await page.getByLabel("Адрес", { exact: true }).fill("browser-article");
  await page
    .getByRole("textbox", { name: "Текст Markdown", exact: true })
    .fill("# Сохранённый текст\n\nПервая версия.");
  await page
    .getByRole("combobox", { name: "Статус", exact: true })
    .selectOption("published");
  await page
    .getByRole("button", { name: "Сохранить статью", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/f/${slug}/wiki/browser-article$`));
  await expect(
    page.getByRole("heading", { name: "Сохранённый текст", exact: true }),
  ).toBeVisible();
  await page.locator(".wiki-tools-menu summary").click();
  await page.getByRole("link", { name: "Редактировать", exact: true }).click();
  await expect(page).toHaveURL(/\/pages\/[^/]+\/edit$/);
  const editURL = page.url();
  await page
    .getByRole("textbox", { name: "Текст Markdown", exact: true })
    .fill("# Сохранённый текст\n\nВторая версия Chromium.");
  await page
    .getByRole("button", { name: "Сохранить изменения", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/f/${slug}/wiki/browser-article$`));
  await page.reload();
  await expect(
    page.getByText("Вторая версия Chromium.", { exact: true }),
  ).toBeVisible();
  // The header and body must share one themed canvas after publishing a custom layout.
  await page.locator(".wiki-tools-menu summary").click();
  await page.getByRole("link", { name: /Оформление статьи/ }).click();
  await page.locator('input[name="article.titleSize"]:visible').fill("36");
  await page.locator('input[name="article.titleSize"]:visible').blur();
  await page
    .locator('input[name="article.byline"][value=\'{"value":"hide"}\']:visible')
    .locator("..")
    .click();
  await page
    .getByRole("combobox", { name: "Шрифт заголовков", exact: true })
    .selectOption({ label: "Press Start 2P · Пиксельный" });
  await page
    .locator('input[name="backgroundImage"]:visible')
    .fill("https://fixture.example/small.png");
  await page.locator('input[name="backgroundImage"]:visible').blur();
  const preview = page.frameLocator("iframe");
  await expect(preview.locator(".wiki-byline")).toHaveCount(0);
  const source = await page
    .getByText("Разделитель", { exact: true })
    .first()
    .boundingBox();
  const target = await preview
    .locator("[data-puck-dropzone]")
    .first()
    .boundingBox();
  expect(source).toBeTruthy();
  expect(target).toBeTruthy();
  if (!source || !target) throw new Error("Studio drag targets missing");
  await page.mouse.move(
    source.x + source.width / 2,
    source.y + source.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    target.x + target.width / 2,
    target.y + target.height - 10,
    { steps: 30 },
  );
  await page.waitForTimeout(400);
  await page.mouse.up();
  await expect(preview.locator(".canvas-divider")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Сохранить черновик", exact: true })
    .click();
  await expect(page.locator(".studio-status")).toContainText(
    "Черновик 1 сохранён",
  );
  await page.reload();
  await expect(
    page.locator('input[name="article.titleSize"]:visible'),
  ).toHaveValue("36");
  await expect(
    page.frameLocator("iframe").locator(".canvas-divider"),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await expect(page.locator(".studio-status")).toContainText(
    "Версия 2 опубликована",
  );
  await page.goto(`/f/${slug}/wiki/browser-article`);
  await expect(page.locator(".wiki-header h1")).toHaveCSS("font-size", "36px");
  await expect(page.locator(".wiki-byline")).toHaveCount(0);
  await expect(page.locator(".world-backdrop")).toHaveCount(1);
  await expect(page.locator(".world-backdrop")).toHaveCSS(
    "background-repeat",
    "no-repeat",
  );
  await expect(page.locator(".fandom-canvas")).toHaveCount(1);
  await expect(page.locator(".fandom-canvas")).toHaveCSS(
    "background-image",
    "none",
  );
  expect(
    parseFloat(
      await page
        .locator(".article-markdown h1")
        .evaluate((el) => getComputedStyle(el).fontSize),
    ),
  ).toBeLessThanOrEqual(38);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  const anonymous = await browser.newContext({ baseURL: base.origin });
  try {
    const guest = await anonymous.newPage();
    await guest.goto(editURL);
    await expect(guest).toHaveURL(`${base.origin}/login`);
  } finally {
    await anonymous.close();
  }
});

test("mobile login has labels and keyboard skip navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Перейти к содержимому", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
