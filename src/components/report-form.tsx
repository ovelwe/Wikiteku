"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { moderationCopy } from "@/lib/moderation";

type Props = { locale: Locale } & (
  | { mode: "report"; pageId: string; revision: number }
  | {
      mode: "decision";
      reportId: string;
      revision: number;
      pageRevision: number;
      actions: ("dismiss" | "block" | "unblock")[];
    }
);
export function ReportForm(props: Props) {
  const t = moderationCopy[props.locale];
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [action, setAction] = useState(
    props.mode === "decision" ? props.actions[0] : "dismiss",
  );
  return (
    <form
      className="panel stack form-card"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const fields = new FormData(form);
        setPending(true);
        setError("");
        setSaved(false);
        try {
          const body =
            props.mode === "report"
              ? {
                  pageId: props.pageId,
                  revision: props.revision,
                  reason: fields.get("reason"),
                  details: fields.get("details"),
                }
              : {
                  reportId: props.reportId,
                  revision: props.revision,
                  pageRevision: props.pageRevision,
                  action,
                  note: fields.get("note"),
                };
          const response = await fetch("/api/reports", {
            method: props.mode === "report" ? "POST" : "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const result = await response.json();
          if (!response.ok) {
            setError(
              t.errors[result.error as keyof typeof t.errors] ??
                t.errors.unavailable,
            );
            return;
          }
          if (props.mode === "report") router.push("/reports");
          else {
            form.reset();
            setSaved(true);
          }
          router.refresh();
        } catch {
          setError(t.errors.unavailable);
        } finally {
          setPending(false);
        }
      }}
    >
      {props.mode === "report" ? (
        <>
          <p className="muted">{t.notice}</p>
          <label>
            {t.reason}
            <select name="reason" required>
              {Object.entries(t.reasons).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.details}
            <textarea
              name="details"
              required
              minLength={10}
              maxLength={3000}
              rows={6}
              aria-describedby="report-help"
            />
          </label>
          <small id="report-help" className="muted">
            {t.help}
          </small>
        </>
      ) : (
        <>
          <label>
            {t.result}
            <select
              value={action}
              onChange={(event) =>
                setAction(event.target.value as typeof action)
              }
            >
              {props.actions.map((value) => (
                <option key={value} value={value}>
                  {t[value]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.note}
            <textarea
              name="note"
              required
              minLength={10}
              maxLength={1000}
              rows={4}
              aria-describedby="report-help"
            />
          </label>
          <small id="report-help" className="muted">
            {t.noteHelp}
          </small>
          {action !== "dismiss" && (
            <label className="moderation-confirm">
              <input type="checkbox" required />
              {t.confirm}
            </label>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {saved && <p role="status">{t.saved}</p>}
      <button className="button primary" type="submit" disabled={pending}>
        {pending ? t.pending : props.mode === "report" ? t.send : t[action]}
      </button>
    </form>
  );
}
