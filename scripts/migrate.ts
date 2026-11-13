import { readdir, readFile } from "node:fs/promises";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url)
  throw new Error("Configurar DATABASE_URL antes de aplicar migraciones");
const sql = postgres(url, { max: 1, prepare: false });
try {
  const files = (await readdir("db/migrations"))
    .filter((name) => /^\d{3}_[a-z_]+\.sql$/.test(name))
    .sort();
  for (const name of files) {
    await sql.unsafe(await readFile("db/migrations/" + name, "utf8"));
    console.log("Migración aplicada", name);
  }
} finally {
  await sql.end({ timeout: 5 });
}
