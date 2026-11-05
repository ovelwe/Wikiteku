"use server";
import { cookies } from "next/headers";

export async function setPreference(name: "locale" | "theme", value: string) {
  if (name !== "locale" && name !== "theme") return;
  if (name === "locale" && value !== "ru" && value !== "en") return;
  if (name === "theme" && value !== "light" && value !== "dark") return;
  (await cookies()).set(name, value, {
    path: "/",
    sameSite: "lax",
    maxAge: 31536000,
    secure: process.env.NODE_ENV === "production",
  });
}
