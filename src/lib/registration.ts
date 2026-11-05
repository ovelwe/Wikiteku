import { z } from "zod";
import { usernameSchema } from "./validation";

export function registrationState(env: Record<string, string | undefined>) {
  const publicOpen =
    env.PUBLIC_REGISTRATION_ENABLED === "true" &&
    !!env.RESEND_API_KEY &&
    !!env.RESEND_EMAIL_DOMAIN &&
    /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(
      env.RESEND_EMAIL_DOMAIN,
    );
  return {
    publicOpen,
    open:
      publicOpen ||
      (env.NODE_ENV !== "production" &&
        env.ALLOW_LOCAL_REGISTRATION === "true"),
  };
}
export const signupInput = z.object({
  name: z.string().trim().min(2).max(80),
  username: usernameSchema,
  email: z
    .email()
    .max(254)
    .transform((value) => value.trim().toLowerCase()),
  password: z.string().min(10).max(128),
  website: z.literal("").optional(),
});
