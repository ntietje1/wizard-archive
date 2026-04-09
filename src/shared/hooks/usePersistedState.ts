import { useEffect, useState } from 'react'
import { logger } from '~/shared/utils/logger'

const isBrowser = typeof window !== 'undefined'

function usePersistedState<T>(
  key: string | null,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue)

  useEffect(() => {
    if (!isBrowser) return
    if (!key) return
    try {
      const item = window.localStorage.getItem(key)
      if (item) {
        const parsedValue = JSON.parse(item)
        setStoredValue(parsedValue)
      }
    } catch (error) {
      logger.debug(error)
    }
  }, [key])

  const setValue = (value: T | ((prev: T) => T)) => {
    if (!key) return
    try {
      setStoredValue((prev) => {
        const valueToStore = value instanceof Function ? (value as (prev: T) => T)(prev) : value
        if (isBrowser) {
          window.localStorage.setItem(key, JSON.stringify(valueToStore))
          queueMicrotask(() => {
            window.dispatchEvent(
              new CustomEvent('localStorageChange', {
                detail: { key, newValue: JSON.stringify(valueToStore) },
              }),
            )
          })
        }
        return valueToStore
      })
    } catch (error) {
      logger.debug(error)
    }
  }

  useEffect(() => {
    if (!isBrowser) return
    if (!key) return
    const handleStorageChange = (event: StorageEvent | CustomEvent) => {
      if (event instanceof StorageEvent) {
        // Handle cross-tab/window storage events
        if (event.key === key) {
          try {
            setStoredValue(event.newValue ? JSON.parse(event.newValue) : initialValue)
          } catch (error) {
            logger.debug(error)
          }
        }
      } else {
        // Handle same-window custom events
        const customEvent = event as CustomEvent<{
          key: string
          newValue: string
        }>
        if (customEvent.detail.key === key) {
          try {
            setStoredValue(JSON.parse(customEvent.detail.newValue))
          } catch (error) {
            logger.debug(error)
          }
        }
      }
    }

    window.addEventListener('storage', handleStorageChange as EventListener)
    window.addEventListener('localStorageChange', handleStorageChange as EventListener)
    return () => {
      window.removeEventListener('storage', handleStorageChange as EventListener)
      window.removeEventListener('localStorageChange', handleStorageChange as EventListener)
    }
  }, [key, initialValue, setStoredValue])

  return [storedValue, setValue]
}

export default usePersistedState
