"use client";
import { useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { MarkdownRenderer } from "@/lib/markdown";
import { platformCopy, platformError } from "@/lib/platform-copy";

export function WikiEditor({
  fandomSlug,
  initial,
  locale,
}: {
  fandomSlug: string;
  initial: string;
  locale: Locale;
}) {
  const t = platformCopy[locale];
  const [value, setValue] = useState(initial);
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  function insert(text: string) {
    const el = textarea.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? start;
    setValue(value.slice(0, start) + text + value.slice(end));
  }
  async function upload(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("alt", file.name);
      const r = await fetch(`/api/fandoms/${fandomSlug}/media`, {
        method: "POST",
        body,
      });
      const result = await r.json();
      if (!r.ok) {
        setMessage(result.code ?? "imageFailed");
        return;
      }
      setValue((old) => `${old}\n\n![${t.imageDescription}](${result.url})\n`);
      setMessage("uploaded");
    } catch {
      setMessage("network");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="wiki-editor stack">
      <div className="wiki-tools">
        <button type="button" onClick={() => insert(t.insertHeading)}>
          {t.heading}
        </button>
        <button type="button" onClick={() => insert(t.insertBold)}>
          {t.bold}
        </button>
        <button type="button" onClick={() => insert(t.insertLink)}>
          {t.wikiLink}
        </button>
        <button type="button" onClick={() => insert(t.insertTable)}>
          {t.table}
        </button>
        <button
          type="button"
          aria-pressed={preview}
          onClick={() => setPreview(!preview)}
        >
          {preview ? t.hidePreview : t.preview}
        </button>
      </div>
      <label>
        {t.markdown}
        <textarea
          ref={textarea}
          name="markdown"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={18}
          maxLength={100000}
          required
        />
      </label>
      <label>
        {t.upload} <small>{t.uploadHelp}</small>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={(e) => upload(e.target.files?.[0])}
        />
      </label>
      <a href={`/f/${fandomSlug}/media`} target="_blank" rel="noreferrer">
        {t.openMedia}
      </a>
      <p role="status">
        {busy
          ? t.uploading
          : message === "uploaded"
            ? t.uploaded
            : message
              ? platformError(message, locale, "imageFailed")
              : ""}
      </p>
      {preview && (
        <div className="panel wiki-preview">
          <MarkdownRenderer
            markdown={value}
            fandomSlug={fandomSlug}
            toc
            tocLabel={t.contents}
          />
        </div>
      )}
    </section>
  );
}
