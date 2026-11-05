import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import * as schema from "../src/lib/db/schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const database = drizzle(pool, { schema });
const email = `verify-${randomUUID()}@example.invalid`;
let databaseVerified = false;
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "real email verification on PostgreSQL",
  () => {
    it("withholds a session until the signed email link is verified", async () => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      expect(["localhost", "127.0.0.1"]).toContain(url.hostname);
      expect(url.pathname).toMatch(/^\/wikiteku_ci(?:_|$)/);
      databaseVerified = true;
      let link = "";
      // Only the mail transport is captured; accounts, passwords and sessions use real Better Auth/PostgreSQL.
      const auth = betterAuth({
        baseURL: "http://localhost:3000",
        secret: "ci-only-email-verification-0123456789abcdef",
        database: drizzleAdapter(database, { provider: "pg", schema }),
        emailAndPassword: {
          enabled: true,
          requireEmailVerification: true,
          autoSignIn: false,
        },
        emailVerification: {
          sendOnSignUp: true,
          expiresIn: 3600,
          autoSignInAfterVerification: false,
          sendVerificationEmail: async ({ url }) => {
            link = url;
          },
        },
        plugins: [username()],
      });
      const password = "CiVerificationOnly-012345!";
      await auth.api.signUpEmail({
        body: {
          email,
          name: "Verify CI",
          username: `verify_${randomUUID().slice(0, 8)}`,
          password,
        },
      });
      expect(link).toContain("/verify-email?token=");
      await expect(
        auth.api.signInEmail({ body: { email, password } }),
      ).rejects.toMatchObject({ body: { code: "EMAIL_NOT_VERIFIED" } });
      const token = new URL(link).searchParams.get("token");
      expect(token).toBeTruthy();
      await expect(
        auth.api.verifyEmail({ query: { token: "invalid-token" } }),
      ).rejects.toBeDefined();
      await auth.api.verifyEmail({ query: { token: token ?? "" } });
      const session = await auth.api.signInEmail({ body: { email, password } });
      expect(session.user.emailVerified).toBe(true);
      expect(session.token).toBeTruthy();
      const row = await pool.query(
        'select email_verified from "user" where email=$1',
        [email],
      );
      expect(row.rows[0].email_verified).toBe(true);
    });
    afterAll(async () => {
      if (!databaseVerified) return;
      await pool.query('delete from "user" where email=$1', [email]);
    });
  },
);
afterAll(async () => pool.end());
