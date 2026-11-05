import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  designVersions,
  fandomDesigns,
  pageDesigns,
  pageDesignVersions,
} from "@/lib/db/schema";
export async function getDesign(fandomId: string) {
  const [design] = await db
    .select()
    .from(fandomDesigns)
    .where(eq(fandomDesigns.fandomId, fandomId))
    .limit(1);
  return design ?? null;
}
export async function getDesignHistory(fandomId: string) {
  return db
    .select({
      revision: designVersions.revision,
      document: designVersions.document,
      published: designVersions.published,
    })
    .from(designVersions)
    .where(eq(designVersions.fandomId, fandomId))
    .orderBy(desc(designVersions.revision))
    .limit(10);
}

export async function getPageDesign(pageId: string) {
  const [row] = await db
    .select()
    .from(pageDesigns)
    .where(eq(pageDesigns.pageId, pageId))
    .limit(1);
  return row ?? null;
}
export async function getPageDesignHistory(pageId: string) {
  return db
    .select({
      revision: pageDesignVersions.revision,
      document: pageDesignVersions.document,
      published: pageDesignVersions.published,
    })
    .from(pageDesignVersions)
    .where(eq(pageDesignVersions.pageId, pageId))
    .orderBy(desc(pageDesignVersions.revision))
    .limit(10);
}
