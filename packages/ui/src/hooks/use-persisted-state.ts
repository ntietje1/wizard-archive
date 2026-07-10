import { useEffect, useRef, useState } from 'react'
import {
  parsePersistedJson,
  readPersistedJson,
  subscribeToPersistedStorage,
  writePersistedJson,
} from '@wizard-archive/ui/storage/persisted-storage'

const isBrowser = typeof window !== 'undefined'

function usePersistedState<T>(
  key: string | null,
  initialValue: T,
  parse: (value: unknown) => T | null,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue)
  const storedValueRef = useRef(storedValue)
  storedValueRef.current = storedValue
  const initialValueRef = useRef(initialValue)
  initialValueRef.current = initialValue
  const storageSourceRef = useRef(Symbol('persisted-state'))

  useEffect(() => {
    if (!isBrowser) return
    if (!key) return
    const nextValue = readPersistedJson(key, initialValueRef.current, parse)
    storedValueRef.current = nextValue
    setStoredValue(nextValue)
  }, [key, parse])

  const setValue = (value: T | ((prev: T) => T)) => {
    if (!key) return
    try {
      const valueToStore =
        value instanceof Function ? (value as (prev: T) => T)(storedValueRef.current) : value
      storedValueRef.current = valueToStore
      setStoredValue(valueToStore)
      if (isBrowser) {
        writePersistedJson(key, valueToStore, {
          deferNotification: true,
          source: storageSourceRef.current,
        })
      }
    } catch (error) {
      console.debug(error)
    }
  }

  useEffect(() => {
    if (!isBrowser) return
    if (!key) return

    return subscribeToPersistedStorage(
      key,
      (newValue) => {
        try {
          const nextValue = newValue
            ? parsePersistedJson(newValue, initialValueRef.current, parse)
            : initialValueRef.current
          storedValueRef.current = nextValue
          setStoredValue(nextValue)
        } catch (error) {
          console.debug(error)
          storedValueRef.current = initialValueRef.current
          setStoredValue(initialValueRef.current)
        }
      },
      { ignoreSource: storageSourceRef.current },
    )
  }, [key, parse, setStoredValue])

  return [storedValue, setValue]
}

export default usePersistedState
