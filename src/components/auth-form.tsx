"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import type { Locale } from "@/lib/i18n";
import { authError, platformCopy, platformError } from "@/lib/platform-copy";

export function AuthForm({
  mode,
  registrationOpen,
  verificationRequired,
  locale,
}: {
  mode: "login" | "register";
  registrationOpen?: boolean;
  verificationRequired?: boolean;
  locale: Locale;
}) {
  const t = platformCopy[locale];
  const router = useRouter();
  const [error, setError] = useState<{
    code?: string;
    status?: number;
    network?: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    try {
      const result =
        mode === "login"
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({
              email,
              password,
              name: String(form.get("name")),
              username: String(form.get("username")),
              fetchOptions: {
                body: { website: String(form.get("website") ?? "") },
              },
            });
      if (result.error)
        setError({ code: result.error.code, status: result.error.status });
      else {
        if (mode === "register" && verificationRequired) {
          setVerificationSent(true);
          return;
        }
        router.push(mode === "register" ? "/settings" : "/");
        router.refresh();
      }
    } catch {
      setError({ network: true });
    } finally {
      setBusy(false);
    }
  }
  if (mode === "register" && !registrationOpen)
    return <div className="notice">{t.registrationClosed}</div>;
  if (verificationSent)
    return (
      <p className="notice" role="status">
        {locale === "en"
          ? "Check your email and follow the confirmation link, then log in. The link expires in 1 hour."
          : "Откройте письмо и подтвердите email, затем войдите. Ссылка действует 1 час."}
      </p>
    );
  return (
    <form
      className="stack form-card auth-form"
      onSubmit={submit}
      aria-busy={busy}
    >
      {mode === "register" && (
        <>
          <div hidden style={{ display: "none" }} aria-hidden="true">
            <label>
              {locale === "en" ? "Website" : "Сайт"}
              <input
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
              />
            </label>
          </div>
          <label>
            {t.name}
            <input
              name="name"
              minLength={2}
              maxLength={80}
              required
              autoComplete="name"
            />
          </label>
          <label>
            {t.username}
            <input
              name="username"
              pattern="[a-zA-Z0-9_]{3,24}"
              minLength={3}
              maxLength={24}
              required
              autoComplete="username"
            />
          </label>
        </>
      )}
      <label>
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
      </label>
      <div className="password-field">
        <label htmlFor="auth-password">{t.password}</label>
        <div className="password-input">
          <input
            id="auth-password"
            name="password"
            type={showPassword ? "text" : "password"}
            minLength={mode === "register" ? 10 : 8}
            maxLength={mode === "register" ? 128 : undefined}
            required
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
          />
          <button
            type="button"
            className="password-toggle"
            aria-controls="auth-password"
            aria-pressed={showPassword}
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? t.hide : t.show}
          </button>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error.network
            ? platformError("network", locale)
            : authError(error.code, locale, error.status)}
        </p>
      )}
      <button className="button primary" disabled={busy} type="submit">
        {busy ? t.waiting : mode === "login" ? t.login : t.register}
      </button>
    </form>
  );
}
