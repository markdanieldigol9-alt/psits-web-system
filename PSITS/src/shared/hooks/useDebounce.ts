import { useState, useEffect } from 'react';

/**
 * Hook to debounce any rapidly changing value (e.g. search inputs).
 * Optimizes performance by reducing re-renders and unnecessary computations.
 */
export function useDebounce<T>(value: T, delay: number = 250): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      window.clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
