import { useState, useEffect, useCallback } from 'react'
import { getConfigStore, getDeployTarget } from '@/services/configStore'

export function useConfigKV<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((current: T) => T)) => void, () => void] {
  const [value, setValue] = useState<T>(defaultValue)
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    let mounted = true
    const store = getConfigStore()

    store.getOrSetDefault(key, defaultValue).then((storedValue) => {
      if (mounted) {
        setValue(storedValue as T)
        setIsInitialized(true)
      }
    }).catch((error) => {
      console.error(`[useConfigKV] Error loading key "${key}":`, error)
      if (mounted) {
        setValue(defaultValue)
        setIsInitialized(true)
      }
    })

    return () => {
      mounted = false
    }
  }, [key])

  const setValueWrapper = useCallback(
    (newValue: T | ((current: T) => T)) => {
      setValue((currentValue) => {
        const valueToSet = typeof newValue === 'function' 
          ? (newValue as (current: T) => T)(currentValue)
          : newValue

        const store = getConfigStore()
        store.set(key, valueToSet).catch((error) => {
          console.error(`[useConfigKV] Error saving key "${key}":`, error)
        })

        return valueToSet
      })
    },
    [key]
  )

  const deleteValue = useCallback(() => {
    const store = getConfigStore()
    store.delete(key).then(() => {
      setValue(defaultValue)
    }).catch((error) => {
      console.error(`[useConfigKV] Error deleting key "${key}":`, error)
    })
  }, [key, defaultValue])

  return [value, setValueWrapper, deleteValue]
}
