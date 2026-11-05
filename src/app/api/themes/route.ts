import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { themeSchema } from "@/lib/builder";
import { db } from "@/lib/db";
import { userThemes } from "@/lib/db/schema";
import { BodyTooLarge, boundedBody, sameOrigin } from "@/server/request";
import { getSession } from "@/server/session";

const schema = z
  .object({ name: z.string().trim().min(1).max(60), theme: themeSchema })
  .strict();
export async function GET() {
  const session = await getSession();
  if (!session)
    return Response.json({ error: "Войдите в аккаунт" }, { status: 401 });
  const themes = await db
    .select({ name: userThemes.name, theme: userThemes.theme })
    .from(userThemes)
    .where(eq(userThemes.userId, session.user.id))
    .limit(30);
  return Response.json({ themes });
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Недопустимый источник" }, { status: 403 });
  const session = await getSession();
  if (!session)
    return Response.json({ error: "Войдите в аккаунт" }, { status: 401 });
  let json: unknown;
  try {
    json = JSON.parse(
      new TextDecoder().decode(await boundedBody(request, 12000)),
    );
  } catch (error) {
    if (error instanceof BodyTooLarge)
      return Response.json({ error: "Тема слишком большая" }, { status: 413 });
    return Response.json({ error: "Некорректный JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success)
    return Response.json(
      { error: "Проверьте название и цвета темы (#RRGGBB)." },
      { status: 400 },
    );
  const result = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${session.user.id}))`,
    );
    const existing = await tx
      .select({ name: userThemes.name })
      .from(userThemes)
      .where(eq(userThemes.userId, session.user.id));
    if (
      existing.length >= 30 &&
      !existing.some((t) => t.name === parsed.data.name)
    )
      return false;
    await tx
      .insert(userThemes)
      .values({
        id: crypto.randomUUID(),
        userId: session.user.id,
        ...parsed.data,
      })
      .onConflictDoUpdate({
        target: [userThemes.userId, userThemes.name],
        set: { theme: parsed.data.theme, updatedAt: new Date() },
      });
    return true;
  });
  return result
    ? Response.json({ saved: true })
    : Response.json(
        {
          error:
            "Достигнут лимит 30 тем. Сохраните под существующим названием.",
        },
        { status: 409 },
      );
}
