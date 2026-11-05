import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { platformCopy } from "@/lib/platform-copy";
import { getLocale } from "@/server/community";
export async function generateMetadata() {
  return { title: platformCopy[await getLocale()].loginTitle };
}
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string; error?: string }>;
}) {
  const locale = await getLocale();
  const t = platformCopy[locale];
  const query = await searchParams;
  return (
    <div className="auth-page">
      <Link className="auth-back" href="/">
        {t.backHome}
      </Link>
      <section className="auth-panel">
        <div className="auth-heading">
          <h1>{t.welcome}</h1>
          <p className="muted">{t.loginIntro}</p>
        </div>
        {query.error && (
          <p className="error" role="alert">
            {locale === "en"
              ? "This confirmation link is invalid or expired. Try logging in to request a new email."
              : "Ссылка подтверждения неверна или устарела. Попробуйте войти, чтобы получить новое письмо."}
          </p>
        )}
        {query.verified === "1" && !query.error && (
          <p className="notice" role="status">
            {locale === "en"
              ? "Email confirmed. You can now log in."
              : "Email подтверждён. Теперь можно войти."}
          </p>
        )}
        <AuthForm locale={locale} mode="login" />
        <p className="auth-switch">
          {t.noAccount} <Link href="/register">{t.register}</Link>
        </p>
      </section>
      <Link className="auth-browse" href="/explore">
        {t.browse}
      </Link>
    </div>
  );
}
