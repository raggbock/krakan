import { useRef, useEffect } from 'react';

export const noop = () => {};

/**
 * Hook for saving some previous value
 * @param {*} value - Any value
 * @returns {*} - Previous value
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}

/**
 * Convert an Error to a regular object
 * @param {Error} error - An error
 * @returns {Object} - Converted object with code and message properties
 */
export function errorToObject(error: { code?: string; message?: string } | null | undefined) {
  return {
    code: error?.code,
    message: error?.message,
  };
}

/**
 *
 * @param {} func
 * @param {*} wait
 * @param {*} immediate
 * @returns
 */
export function debounce<TArgs extends unknown[]>(
  func: (...args: TArgs) => void,
  wait: number,
  immediate?: boolean,
) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: TArgs) => {
    const later = () => {
      timeout = null;
      if (!immediate) {
        func(...args);
      }
    };
    const callNow = immediate && !timeout;
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
    if (callNow) {
      func(...args);
    }
  };
}
