/* Tiny dev-facing logger. Swap for Sentry breadcrumbs in production. */
const stamp = () => new Date().toISOString().slice(11, 23);

export const logger = {
  debug: (tag: string, ...args: unknown[]) => console.log(`[${stamp()}] ${tag}`, ...args),
  info: (tag: string, ...args: unknown[]) => console.info(`[${stamp()}] ${tag}`, ...args),
  warn: (tag: string, ...args: unknown[]) => console.warn(`[${stamp()}] ${tag}`, ...args),
  error: (tag: string, ...args: unknown[]) => console.error(`[${stamp()}] ${tag}`, ...args),
};
