import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Connection is established only when a query runs; this keeps builds independent of a live DB.
const url =
  process.env.DATABASE_URL ??
  "postgres://wikiteku:wikiteku@localhost:5432/wikiteku";

const globalPool = globalThis as typeof globalThis & { __wikitekuPool?: Pool };
export const pool =
  globalPool.__wikitekuPool ??
  new Pool({
    connectionString: url,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    statement_timeout: 15000,
  });
if (process.env.NODE_ENV !== "production") globalPool.__wikitekuPool = pool;
export const db = drizzle(pool, { schema });
