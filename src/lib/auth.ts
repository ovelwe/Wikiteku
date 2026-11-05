import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { registrationState } from "@/lib/registration";
import { sendVerificationMail } from "@/server/verification-mail";

const registration = registrationState(process.env);

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: !registration.open,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    requireEmailVerification: registration.publicOpen,
    autoSignIn: !registration.publicOpen,
  },
  ...(registration.publicOpen
    ? {
        emailVerification: {
          sendOnSignUp: true,
          sendOnSignIn: true,
          autoSignInAfterVerification: false,
          expiresIn: 3600,
          sendVerificationEmail: async ({
            user,
            url,
          }: {
            user: { email: string };
            url: string;
          }) => {
            await sendVerificationMail(user.email, url);
          },
        },
      }
    : {}),
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 60,
    customRules: {
      "/sign-up/email": { window: 3600, max: 5 },
      "/sign-in/email": { window: 60, max: 10 },
      "/send-verification-email": { window: 3600, max: 3 },
    },
  },
  plugins: [username(), nextCookies()],
});
