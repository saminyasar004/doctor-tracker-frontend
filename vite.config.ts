import { defineConfig, type PluginOption } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Vite configuration for the Doctor Tracker admin portal.
 *
 * Plugin order matters:
 *  1. `tanstackStart` - file-system router, server functions and the Start runtime
 *  2. `tailwindcss`    - Tailwind v4 CSS pipeline
 *  3. `react`          - React fast refresh / JSX transform
 */
const plugins: PluginOption[] = [tanstackStart(), tailwindcss(), react()];

export default defineConfig({
  plugins,
  resolve: {
    // `@/*` comes from tsconfig.json paths (Vite 8 resolves those natively).
    tsconfigPaths: true,
    // A single copy of React avoids "invalid hook call" when the router, the
    // query client and the components resolve to different instances.
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    ignoreOutdatedRequests: true,
  },
  server: {
    port: Number(process.env["PORT"] ?? 3000),
    strictPort: false,
  },
  preview: {
    port: Number(process.env["PORT"] ?? 3000),
  },
  build: {
    // The API runs on a separate origin; keep the bundle free of backend URLs.
    target: "es2022",
  },
});
