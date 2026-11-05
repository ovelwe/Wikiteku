import "server-only";
import { and, eq } from "drizzle-orm";
import type { db } from "@/lib/db";
import { fandomMembers, fandoms } from "@/lib/db/schema";
import {
  canEditContent,
  canManageFandom,
  canReadFandom,
} from "@/lib/permissions";
import { PlatformFailure } from "@/lib/platform-copy";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Call after locking an existing article, before changing it or its design.
// Share locks keep visibility and membership stable until the write commits.
export async function mutationAccess(
  tx: Transaction,
  fandomId: string,
  userId: string,
  permission: "read" | "edit" | "manage",
  lockFandom: "share" | "update" = "share",
) {
  const [fandom] = await tx
    .select()
    .from(fandoms)
    .where(eq(fandoms.id, fandomId))
    .for(lockFandom);
  const [member] = await tx
    .select({ role: fandomMembers.role })
    .from(fandomMembers)
    .where(
      and(
        eq(fandomMembers.fandomId, fandomId),
        eq(fandomMembers.userId, userId),
      ),
    )
    .for("share");
  const role = member?.role ?? null;
  if (
    !fandom ||
    !(permission === "manage"
      ? canManageFandom(role)
      : permission === "edit"
        ? canEditContent(role)
        : canReadFandom(fandom.visibility, role))
  )
    throw new PlatformFailure("access");
  return { fandom, role };
}
