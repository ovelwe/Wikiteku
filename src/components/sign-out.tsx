"use client";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOut({ label }: { label: string }) {
  const router = useRouter();
  return (
    <button
      className="link-button"
      type="button"
      onClick={async () => {
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
    >
      {label}
    </button>
  );
}
