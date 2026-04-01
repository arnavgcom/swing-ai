import "./env";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@swing-ai/shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const TIMESTAMP_WITHOUT_TIMEZONE_OID = 1114;

pg.types.setTypeParser(
  TIMESTAMP_WITHOUT_TIMEZONE_OID,
  (value: string) => new Date(`${value.replace(" ", "T")}Z`),
);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on("connect", (client) => {
  client.query("SET TIME ZONE 'UTC'").catch(() => {});
});

export const db = drizzle(pool, { schema });
