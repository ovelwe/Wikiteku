"use client";
import { useRouter } from "next/navigation";
import { setPreference } from "@/app/preferences-actions";
import { copy, type Locale } from "@/lib/i18n";

export function Preferences({
  locale,
  theme,
}: {
  locale: Locale;
  theme: "light" | "dark";
}) {
  const router = useRouter();
  const t = copy[locale];
  async function set(name: "locale" | "theme", value: string) {
    await setPreference(name, value);
    if (name === "theme") document.documentElement.dataset.theme = value;
    router.refresh();
  }
  return (
    <div className="preferences">
      <button
        type="button"
        onClick={() => set("theme", theme === "light" ? "dark" : "light")}
        aria-label={theme === "light" ? t.dark : t.light}
        title={theme === "light" ? t.dark : t.light}
      >
        {theme === "light" ? "◐" : "☼"}
      </button>
      <button
        type="button"
        onClick={() => set("locale", locale === "ru" ? "en" : "ru")}
        aria-label={
          locale === "ru" ? "RU · Сменить язык" : "EN · Change language"
        }
        title={locale === "ru" ? "Сменить язык" : "Change language"}
      >
        {locale.toUpperCase()}
      </button>
    </div>
  );
}
