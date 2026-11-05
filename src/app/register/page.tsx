import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { platformCopy } from "@/lib/platform-copy";
import { registrationState } from "@/lib/registration";
import { getLocale } from "@/server/community";
export async function generateMetadata() {
  return { title: platformCopy[await getLocale()].registerTitle };
}
export default async function Register() {
  const locale = await getLocale();
  const t = platformCopy[locale];
  const registration = registrationState(process.env);
  return (
    <div className="auth-page">
      <Link className="auth-back" href="/">
        {t.backHome}
      </Link>
      <section className="auth-panel">
        <div className="auth-heading">
          <h1>{t.createAccount}</h1>
          <p className="muted">{t.registerIntro}</p>
        </div>
        <AuthForm
          locale={locale}
          mode="register"
          registrationOpen={registration.open}
          verificationRequired={registration.publicOpen}
        />
        <p className="auth-switch">
          {t.hasAccount} <Link href="/login">{t.login}</Link>
        </p>
      </section>
      <Link className="auth-browse" href="/explore">
        {t.browse}
      </Link>
    </div>
  );
}
