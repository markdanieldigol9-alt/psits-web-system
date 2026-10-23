import { lazy, type ComponentType } from 'react';

/**
 * Enhanced lazy loader with automatic chunk reload recovery.
 *
 * When a new deployment is pushed to production (e.g. Vercel), old build chunk hashes
 * are purged and replaced with new ones. Active users navigating to an unloaded route
 * will trigger a "Failed to fetch dynamically imported module" error.
 *
 * This wrapper intercepts that chunk load error, automatically reloads the page with
 * a cache-busting timestamp so the user seamlessly loads the latest version, while
 * keeping the React Suspense fallback active during the refresh.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T } | { [key: string]: any }>,
  name?: string
) {
  return lazy(async () => {
    const key = `psits_retry_${name || 'chunk'}`;
    const hasRetried = sessionStorage.getItem(key);

    try {
      const module = await factory();
      // Clear retry marker on successful module resolution
      sessionStorage.removeItem(key);
      if (module && typeof module === 'object' && 'default' in module) {
        return { default: module.default };
      }
      if (name && module && (module as any)[name]) {
        return { default: (module as any)[name] };
      }
      // Fallback: take the first component export
      const fallback = Object.values(module || {})[0] as T;
      return { default: fallback };
    } catch (error: any) {
      const msg = String(error?.message || error || '');
      const isChunkLoadFailed =
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('error loading dynamically imported module') ||
        error?.name === 'ChunkLoadError' ||
        msg.includes('Loading chunk') ||
        msg.includes('dynamically imported module');

      if (isChunkLoadFailed && !hasRetried) {
        sessionStorage.setItem(key, 'true');
        // Force browser to fetch the latest index.html and asset manifest from server
        const url = new URL(window.location.href);
        url.searchParams.set('_v', Date.now().toString());
        window.location.replace(url.toString());
        // Return an unresolved promise to keep React Suspense active until reload completes
        return new Promise<{ default: T }>(() => {});
      }

      // If already retried or genuine runtime exception, clear marker and throw
      sessionStorage.removeItem(key);
      throw error;
    }
  });
}
