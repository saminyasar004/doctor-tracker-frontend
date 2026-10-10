import { createStart, createCsrfMiddleware } from "@tanstack/react-start";

/**
 * Start instance for the admin portal.
 *
 * All routes render client-side (`ssr: false`), so this only keeps the CSRF
 * middleware that TanStack Start installs automatically when `src/start.ts` is
 * absent - defining the file opts out, so it is re-added explicitly.
 */
export const startInstance = createStart(() => ({
  requestMiddleware: [
    createCsrfMiddleware({
      filter: (ctx) => ctx.handlerType === "serverFn",
    }),
  ],
}));
