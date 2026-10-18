import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "prisma/config";

const packageDirectory = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = resolve(packageDirectory, "../../.env");

try {
  const rootEnv = readFileSync(rootEnvPath, "utf8");
  for (const line of rootEnv.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?\s*$/);
    if (!match || process.env[match[1]]) continue;
    let value = (match[2] ?? "").trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "");
    }
    process.env[match[1]] = value;
  }
} catch {
  // A shell-provided DATABASE_URL works without a root .env file.
}

export default defineConfig({
  schema: "schema.prisma",
  migrations: {
    path: "migrations",
    seed: "tsx seed/index.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
