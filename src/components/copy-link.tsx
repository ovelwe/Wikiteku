"use client";

import { useState } from "react";

export function CopyLink({ path }: { path: string }) {
  const [status, setStatus] = useState<
    "idle" | "copying" | "copied" | "manual"
  >("idle");
  const [url, setUrl] = useState("");

  async function copy() {
    const link = new URL(path, window.location.origin).href;
    setUrl(link);
    setStatus("copying");
    try {
      await navigator.clipboard.writeText(link);
      setStatus("copied");
    } catch {
      setStatus("manual");
    }
  }

  return (
    <div className="copy-link">
      <button
        type="button"
        className="button small"
        onClick={copy}
        disabled={status === "copying"}
      >
        {status === "copying" ? "Копируем…" : "Скопировать ссылку"}
      </button>
      <span role="status" className="copy-link-status">
        {status === "copied"
          ? "Ссылка скопирована"
          : status === "manual"
            ? "Выделите ссылку и скопируйте вручную."
            : ""}
      </span>
      {status === "manual" && (
        <input
          aria-label="Ссылка на страницу"
          readOnly
          value={url}
          onFocus={(event) => event.currentTarget.select()}
        />
      )}
    </div>
  );
}
