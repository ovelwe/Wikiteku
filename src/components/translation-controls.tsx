"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import {
  type TranslatedContent,
  type TranslationError,
  translationCopy,
} from "@/lib/translation";

type Props = {
  endpoint: string;
  source: Locale;
  target: Locale;
  revision: number;
  locale: Locale;
};
function useTranslationMutation(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TranslationError | null>(null);
  const [saved, setSaved] = useState(false);
  async function submit(
    method: "POST" | "PATCH",
    correction?: { version: number; content: TranslatedContent },
  ) {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch(props.endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: props.source,
          target: props.target,
          revision: props.revision,
          ...correction,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(
          body.error in translationCopy[props.locale].errors
            ? body.error
            : "unavailable",
        );
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("unavailable");
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, saved, submit };
}
export function TranslationRequest(props: Props) {
  const t = translationCopy[props.locale];
  const { busy, error, submit } = useTranslationMutation(props);
  return (
    <div className="stack">
      <p className="muted">{t.notice}</p>
      <div>
        <button
          className="button primary"
          type="button"
          disabled={busy}
          onClick={() => submit("POST")}
        >
          {busy ? t.pending : t.translate}
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error === "structure" ? t.machineStructure : t.errors[error]}
        </p>
      )}
    </div>
  );
}
export function TranslationCorrection(
  props: Props & { content: TranslatedContent; version: number },
) {
  const t = translationCopy[props.locale];
  const { busy, error, saved, submit } = useTranslationMutation(props);
  return (
    <details className="panel translation-editor">
      <summary>{t.edit}</summary>
      <p className="muted">{t.editHint}</p>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void submit("PATCH", {
            version: props.version,
            content: {
              title: String(form.get("title")),
              summary: String(form.get("summary")),
              markdown: String(form.get("markdown")),
            },
          });
        }}
      >
        <label>
          {t.titleField}
          <input
            name="title"
            defaultValue={props.content.title}
            required
            maxLength={500}
          />
        </label>
        <label>
          {t.summaryField}
          <textarea
            name="summary"
            defaultValue={props.content.summary}
            rows={2}
            maxLength={2000}
          />
        </label>
        <label>
          {t.markdownField}
          <textarea
            name="markdown"
            defaultValue={props.content.markdown}
            rows={14}
            maxLength={100000}
          />
        </label>
        <div>
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? t.saving : t.save}
          </button>
        </div>
        {error && (
          <p role="alert" className="error">
            {t.errors[error]}
          </p>
        )}
        {saved && <p role="status">{t.saved}</p>}
      </form>
    </details>
  );
}
