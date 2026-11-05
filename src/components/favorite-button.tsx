"use client";
import { useFormStatus } from "react-dom";

export function FavoriteButton({
  saved,
  saveLabel,
  removeLabel,
  pendingLabel,
}: {
  saved: boolean;
  saveLabel: string;
  removeLabel: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className="button small favorite-button"
      type="submit"
      name="action"
      value={saved ? "remove" : "save"}
      disabled={pending}
      aria-label={saved ? removeLabel : saveLabel}
    >
      {pending ? pendingLabel : saved ? removeLabel : saveLabel}
    </button>
  );
}
