import { useCallback, useEffect, useState } from 'react'

const isBrowser = typeof window !== 'undefined'

function usePersistedState<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue)

  useEffect(() => {
    if (!isBrowser) return
    try {
      const item = window.localStorage.getItem(key)
      if (item) {
        const parsedValue = JSON.parse(item)
        setStoredValue(parsedValue)
      }
    } catch (error) {
      console.log(error)
    }
  }, [key])

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        setStoredValue((prev) => {
          const valueToStore =
            value instanceof Function ? (value as (prev: T) => T)(prev) : value
          if (isBrowser) {
            window.localStorage.setItem(key, JSON.stringify(valueToStore))
            // Dispatch custom event for same-window updates (deferred to avoid setState during render)
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
        console.log(error)
      }
    },
    [key],
  )

  useEffect(() => {
    if (!isBrowser) return
    const handleStorageChange = (event: StorageEvent | CustomEvent) => {
      if (event instanceof StorageEvent) {
        // Handle cross-tab/window storage events
        if (event.key === key) {
          try {
            setStoredValue(
              event.newValue ? JSON.parse(event.newValue) : initialValue,
            )
          } catch (error) {
            console.log(error)
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
            console.log(error)
          }
        }
      }
    }

    window.addEventListener('storage', handleStorageChange as EventListener)
    window.addEventListener(
      'localStorageChange',
      handleStorageChange as EventListener,
    )
    return () => {
      window.removeEventListener(
        'storage',
        handleStorageChange as EventListener,
      )
      window.removeEventListener(
        'localStorageChange',
        handleStorageChange as EventListener,
      )
    }
  }, [key, initialValue, setStoredValue])

  return [storedValue, setValue]
}

export default usePersistedState
