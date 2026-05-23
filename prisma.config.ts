import { config } from "dotenv";
import path from "node:path";
import { defineConfig } from "prisma/config";

// Explicitly load .env since prisma.config.ts disables automatic .env loading
config({ path: path.resolve(__dirname, ".env") });

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: 'ts-node --compiler-options {"module":"CommonJS"} prisma/seed.ts',
  },
});
