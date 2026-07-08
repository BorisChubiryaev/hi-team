import { defineConfig } from "prisma/config";

// Конфиг Prisma (заменяет устаревший блок `prisma` в package.json).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
