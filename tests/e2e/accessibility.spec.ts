import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const theme of ["dark", "light"]) {
  for (const path of ["/", "/login", "/explore", "/register"]) {
    test(`WCAG A/AA: ${theme} ${path}`, async ({ page, context }) => {
      await context.addCookies([
        {
          name: "theme",
          value: theme,
          url: process.env.SMOKE_BASE_URL ?? "http://localhost:3000",
        },
      ]);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(path);
      const scan = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(scan.violations).toEqual([]);
    });
  }
}
