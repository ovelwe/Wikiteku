import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "../src/lib/db/schema";
import { mutationAccess } from "../src/server/mutation-access";

vi.mock("server-only", () => ({}));
const enabled = process.env.RUN_DATABASE_TESTS === "true";
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const database = drizzle(pool, { schema });
const owner = randomUUID();
const editor = randomUUID();
const fandom = randomUUID();
let databaseVerified = false;

describe.skipIf(!enabled)("transactional permissions on PostgreSQL", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "");
    if (
      !["localhost", "127.0.0.1"].includes(url.hostname) ||
      !/^\/wikiteku_ci(?:_|$)/.test(url.pathname)
    )
      throw new Error(
        "Database tests require an isolated local wikiteku_ci database",
      );
    databaseVerified = true;
    await pool.query(
      'insert into "user"(id,name,email) values($1,$1,$2),($3,$3,$4)',
      [owner, `${owner}@example.invalid`, editor, `${editor}@example.invalid`],
    );
    await database.insert(schema.fandoms).values({
      id: fandom,
      ownerId: owner,
      slug: fandom,
      title: "CI",
      description: "CI only",
      category: "other",
      visibility: "private",
    });
    await database.insert(schema.fandomMembers).values([
      { id: randomUUID(), fandomId: fandom, userId: owner, role: "owner" },
      { id: randomUUID(), fandomId: fandom, userId: editor, role: "editor" },
    ]);
  });
  afterAll(async () => {
    if (!databaseVerified) return;
    await pool.query("delete from fandoms where id=$1", [fandom]);
    await pool.query('delete from "user" where id=any($1::text[])', [
      [owner, editor],
    ]);
  });
  it("rejects absent members and reader writes, preserves owner management", async () => {
    await expect(
      database.transaction((tx) =>
        mutationAccess(tx, fandom, randomUUID(), "read"),
      ),
    ).rejects.toMatchObject({ code: "access" });
    await expect(
      database.transaction((tx) =>
        mutationAccess(tx, fandom, editor, "manage"),
      ),
    ).rejects.toMatchObject({ code: "access" });
    await expect(
      database.transaction((tx) => mutationAccess(tx, fandom, owner, "manage")),
    ).resolves.toMatchObject({ role: "owner" });
  });
  it("waits for an in-flight revocation and rechecks the committed role", async () => {
    const connection = await pool.connect();
    try {
      await connection.query("begin");
      await connection.query(
        "update fandom_members set role='reader' where fandom_id=$1 and user_id=$2",
        [fandom, editor],
      );
      // This check starts while the old committed role is still editor.
      const result = database
        .transaction((tx) => mutationAccess(tx, fandom, editor, "edit"))
        .then(
          () => "allowed",
          () => "denied",
        );
      await connection.query("commit");
      expect(await result).toBe("denied");
    } finally {
      await connection.query("rollback");
      connection.release();
    }
  });
});
afterAll(async () => pool.end());
