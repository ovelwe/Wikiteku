import "server-only";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { resourceQuotas } from "@/lib/db/schema";

export async function sendVerificationMail(email: string, url: string) {
  const day = new Date().toISOString().slice(0, 10);
  const recipient = createHash("sha256")
    .update(email.toLowerCase())
    .digest("hex");
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`verification-mail:${day}`}))`,
    );
    for (const [key, maximum] of [
      [`verification-mail:global:${day}`, 90],
      [`verification-mail:${recipient}:${day}`, 3],
    ] as const) {
      const [usage] = await tx
        .select()
        .from(resourceQuotas)
        .where(eq(resourceQuotas.key, key));
      if ((usage?.count ?? 0) >= maximum)
        throw new Error("Verification email limit reached");
      await tx
        .insert(resourceQuotas)
        .values({ key, count: 1 })
        .onConflictDoUpdate({
          target: resourceQuotas.key,
          set: { count: sql`${resourceQuotas.count} + 1` },
        });
    }
  });
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send(
    {
      from: `Wikiteku <noreply@${process.env.RESEND_EMAIL_DOMAIN}>`,
      to: email,
      subject: "Подтверждение email / Verify your email · Wikiteku",
      text: `Подтвердите email для входа в Wikiteku. Ссылка действует 1 час. Если вы не создавали аккаунт, проигнорируйте письмо.\n\nVerify your email to sign in. This link expires in 1 hour. If you did not create an account, ignore this email.\n\n${url}`,
    },
    {
      signal: AbortSignal.timeout(10000),
      idempotencyKey: createHash("sha256").update(url).digest("hex"),
    },
  );
  if (error) throw new Error("Verification email could not be sent");
}
