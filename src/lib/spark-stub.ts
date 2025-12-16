/**
 * Stub file for @github/spark
 * 
 * This file serves as a placeholder to prevent build errors when @github/spark
 * is imported but not actually needed. All spark functionality has been removed
 * and replaced with local implementations.
 */

export function useConfigKV<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  throw new Error('useConfigKV from @github/spark is deprecated. Use the local useConfigKV from @/hooks/use-config-kv instead.')
}

export function useSparkKV<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  throw new Error('useSparkKV from @github/spark is deprecated. Use the local useConfigKV from @/hooks/use-config-kv instead.')
}

// Stub for any other spark imports that might be referenced
export default {}
