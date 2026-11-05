"use server";
import { and, count, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { favoriteLimit, favoriteMutation } from "@/lib/community";
import { db } from "@/lib/db";
import { fandoms, favorites } from "@/lib/db/schema";
import { canReadFandom } from "@/lib/permissions";
import { getMemberRole } from "@/server/fandoms";
import { mutationAccess } from "@/server/mutation-access";
import { requireUser } from "@/server/session";

export async function changeFavorite(fandomId: string, form: FormData) {
  const current = await requireUser();
  const parsed = favoriteMutation.safeParse({
    fandomId,
    action: form.get("action"),
  });
  if (!parsed.success) redirect("/favorites?error=denied");
  const [fandom] = await db
    .select()
    .from(fandoms)
    .where(eq(fandoms.id, fandomId))
    .limit(1);
  const own = and(
    eq(favorites.userId, current.id),
    eq(favorites.fandomId, fandomId),
  );
  if (parsed.data.action === "remove") {
    // Removal is allowed even if the community became inaccessible.
    await db.delete(favorites).where(own);
  } else {
    if (
      !fandom ||
      !canReadFandom(
        fandom.visibility,
        await getMemberRole(fandomId, current.id),
      )
    )
      redirect("/favorites?error=denied");
    const added = await db.transaction(async (tx) => {
      await mutationAccess(tx, fandomId, current.id, "read");
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`favorites:${current.id}`}))`,
      );
      const [existing] = await tx
        .select({ id: favorites.id })
        .from(favorites)
        .where(own)
        .limit(1);
      if (existing) return true;
      const [total] = await tx
        .select({ value: count() })
        .from(favorites)
        .where(eq(favorites.userId, current.id));
      if (total.value >= favoriteLimit) return false;
      await tx
        .insert(favorites)
        .values({ id: crypto.randomUUID(), userId: current.id, fandomId });
      return true;
    });
    if (!added) redirect("/favorites?error=limit");
  }
  revalidatePath("/favorites");
  revalidatePath("/activity");
  if (fandom) revalidatePath(`/f/${fandom.slug}`);
}
