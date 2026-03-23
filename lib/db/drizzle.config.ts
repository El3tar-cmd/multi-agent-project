import { defineConfig } from "drizzle-kit";
import path from "path";

const dbPath = process.env.SQLITE_PATH || path.join(process.cwd(), "data", "platform.db");

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: dbPath,
  },
});
