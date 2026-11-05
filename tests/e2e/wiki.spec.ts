import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

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
    .getByLabel("Текст Markdown", { exact: true })
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
  await page.getByRole("link", { name: "Редактировать", exact: true }).click();
  const editURL = page.url();
  await page
    .getByLabel("Текст Markdown", { exact: true })
    .fill("# Сохранённый текст\n\nВторая версия Chromium.");
  await page
    .getByRole("button", { name: "Сохранить изменения", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByText("Вторая версия Chromium.", { exact: true }),
  ).toBeVisible();
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
