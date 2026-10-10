import { createStart, createCsrfMiddleware } from "@tanstack/react-start";

/**
 * Start instance for the admin portal.
 *
 * **SPA mode.** Every route renders client-side (`ssr: false`), so the production
 * build emits a static `dist/client/index.html` instead of expecting a Node
 * server to render the shell. That is what makes the output deployable to a
 * static host (Netlify, Cloudflare Pages, S3, nginx) - with a Node server the
 * build contains no HTML at all and any direct hit on `/` returns 404.
 *
 * **CSRF.** Start installs this automatically when `src/start.ts` is absent;
 * defining the file opts out, so it is re-added explicitly.
 */
export const startInstance = createStart(() => ({
  spa: {
    enabled: true,
  },
  requestMiddleware: [
    createCsrfMiddleware({
      filter: (ctx) => ctx.handlerType === "serverFn",
    }),
  ],
}));
