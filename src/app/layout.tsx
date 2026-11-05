import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Preferences } from "@/components/preferences";
import { SignOut } from "@/components/sign-out";
import { communityCopy } from "@/lib/community";
import { copy, type Locale } from "@/lib/i18n";
import { moderationCopy } from "@/lib/moderation";
import { getLocale } from "@/server/community";
import { isPlatformModerator } from "@/server/moderation";
import { getSession } from "@/server/session";
import "@ovelwe/z-md/styles.css";
import "./globals.css";
import "./modern.css";
import "@/components/builder/fonts.css";
import "./craft.css";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(
      process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    ),
    title: { default: "Wikiteku", template: "%s · Wikiteku" },
    description:
      (await getLocale()) === "en"
        ? "A platform for fan-made encyclopedias"
        : "Платформа фанатских энциклопедий",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const jar = await cookies();
  const locale: Locale = jar.get("locale")?.value === "en" ? "en" : "ru";
  const theme = jar.get("theme")?.value === "light" ? "light" : "dark";
  const t = copy[locale];
  const community = communityCopy[locale];
  const session = await getSession();
  const moderation = moderationCopy[locale];
  const moderator = isPlatformModerator(session?.user.id);
  return (
    <html lang={locale} data-theme={theme} data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main-content">
          {locale === "en" ? "Skip to content" : "Перейти к содержимому"}
        </a>
        <header className="topbar">
          <div className="topbar-inner">
            <Link href="/" className="brand">
              <span className="brand-mark">W</span>
              <span>Wikiteku</span>
            </Link>
            <nav className="desktop-nav" aria-label={t.platformNav}>
              <Link href="/explore">{t.explore}</Link>
              {session && <Link href="/favorites">{community.favorites}</Link>}
              <Link href="/create">{t.create}</Link>
              <Link href={session ? "/settings" : "/register"}>
                {session ? t.settings : t.register}
              </Link>
              {session && <SignOut label={t.logout} />}
            </nav>
            <form action="/search" className="top-search">
              <input name="q" placeholder={t.search} aria-label={t.search} />
              <button type="submit" aria-label={t.find}>
                ⌕
              </button>
            </form>
            <div className="top-actions">
              <Preferences locale={locale} theme={theme} />
              {session ? (
                <Link
                  className="top-profile"
                  href={`/u/${session.user.username ?? session.user.id}`}
                >
                  {session.user.name}
                </Link>
              ) : (
                <Link className="top-profile" href="/login">
                  {t.login}
                </Link>
              )}
              <details className="mobile-menu">
                <summary aria-label={t.menu}>☰</summary>
                <div className="mobile-menu-panel">
                  <Link href="/">{t.home}</Link>
                  <Link href="/explore">{t.explore}</Link>
                  <Link href="/search">{t.search}</Link>
                  {session ? (
                    <>
                      <Link href="/favorites">{community.favorites}</Link>
                      <Link href="/activity">{community.activity}</Link>
                      <Link href="/reports">{moderation.mine}</Link>
                      {moderator && (
                        <Link href="/moderation">{moderation.queue}</Link>
                      )}
                      <Link href="/create">{t.create}</Link>
                      <Link href="/settings">{t.settings}</Link>
                      <SignOut label={t.logout} />
                    </>
                  ) : (
                    <>
                      <Link href="/login">{t.login}</Link>
                      <Link href="/register">{t.register}</Link>
                    </>
                  )}
                </div>
              </details>
            </div>
          </div>
        </header>
        <div className="site-layout">
          <nav className="sidebar" aria-label={t.navigation}>
            <Link href="/">
              <span>⌂</span>
              {t.home}
            </Link>
            <Link href="/explore">
              <span>▦</span>
              {t.explore}
            </Link>
            <Link href="/search">
              <span>⌕</span>
              {t.search}
            </Link>
            <div className="nav-divider" />
            {session ? (
              <>
                <Link href="/favorites">
                  <span>♡</span>
                  {community.favorites}
                </Link>
                <Link href="/activity">
                  <span>↗</span>
                  {community.activity}
                </Link>
                <Link href={`/u/${session.user.username ?? session.user.id}`}>
                  <span>◉</span>
                  {t.profile}
                </Link>
                <Link href="/reports">
                  <span>⚑</span>
                  {moderation.mine}
                </Link>
                {moderator && (
                  <Link href="/moderation">
                    <span>✓</span>
                    {moderation.queue}
                  </Link>
                )}
                <Link href="/create">
                  <span>＋</span>
                  {t.create}
                </Link>
                <Link href="/settings">
                  <span>⚙</span>
                  {t.settings}
                </Link>
                <SignOut label={t.logout} />
              </>
            ) : (
              <>
                <Link href="/login">
                  <span>→</span>
                  {t.login}
                </Link>
                <Link href="/register">
                  <span>＋</span>
                  {t.register}
                </Link>
              </>
            )}
          </nav>
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
