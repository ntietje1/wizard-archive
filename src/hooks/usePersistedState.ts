import { useState, useEffect, useCallback } from 'react'

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
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key) {
        try {
          setStoredValue(
            event.newValue ? JSON.parse(event.newValue) : initialValue,
          )
        } catch (error) {
          console.log(error)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [key, initialValue])

  return [storedValue, setValue]
}

export default usePersistedState
