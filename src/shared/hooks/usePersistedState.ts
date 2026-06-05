import { useEffect, useRef, useState } from 'react'
import { logger } from '~/shared/utils/logger'
import {
  readPersistedJson,
  subscribeToPersistedStorage,
  writePersistedJson,
} from '~/shared/storage/persisted-storage'

const isBrowser = typeof window !== 'undefined'

function usePersistedState<T>(
  key: string | null,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue)
  const initialValueRef = useRef(initialValue)
  initialValueRef.current = initialValue

  useEffect(() => {
    if (!isBrowser) return
    if (!key) return
    setStoredValue(readPersistedJson(key, initialValueRef.current))
  }, [key])

  const setValue = (value: T | ((prev: T) => T)) => {
    if (!key) return
    try {
      setStoredValue((prev) => {
        const valueToStore = value instanceof Function ? (value as (prev: T) => T)(prev) : value
        if (isBrowser) {
          writePersistedJson(key, valueToStore, { deferNotification: true })
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

    return subscribeToPersistedStorage(key, (newValue) => {
      try {
        setStoredValue(newValue ? JSON.parse(newValue) : initialValueRef.current)
      } catch (error) {
        logger.debug(error)
      }
    })
  }, [key, setStoredValue])

  return [storedValue, setValue]
}

export default usePersistedState
