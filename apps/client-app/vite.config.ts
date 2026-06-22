import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import { z } from "zod";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

const envSchema = z.object({
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  CLIENT_APP_PORT: z.coerce.number().int().min(1).max(65_535).default(5173),
});

export default defineConfig(({ mode }) => {
  const env = envSchema.parse(loadEnv(mode, repoRoot, ""));
  const localHost = "127.0.0.1";
  const apiTarget = `http://${localHost}:${env.API_PORT}`;

  return {
    envDir: repoRoot,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "@yomika/shared": fileURLToPath(
          new URL("../../packages/shared/src/index.ts", import.meta.url),
        ),
      },
    },
    server: {
      host: localHost,
      port: env.CLIENT_APP_PORT,
      proxy: {
        "/api/graphql": {
          target: apiTarget,
          changeOrigin: true,
          rewrite: () => "/graphql/client",
        },
        "/api/uploads": {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/uploads/, "/uploads"),
        },
        "/media": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
