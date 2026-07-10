const LOCAL_STORAGE_CHANGE_EVENT = 'localStorageChange'

type PersistedStorageChange = {
  key: string
  newValue: string | null
  source?: symbol
}

const isBrowser = typeof window !== 'undefined'

export function readPersistedJson<T>(
  key: string,
  fallback: T,
  parse: (value: unknown) => T | null,
): T {
  if (!isBrowser) return fallback

  try {
    const rawValue = window.localStorage.getItem(key)
    if (!rawValue) return fallback
    return parsePersistedJson(rawValue, fallback, parse)
  } catch (error) {
    console.debug(error)
    return fallback
  }
}

export function parsePersistedJson<T>(
  rawValue: string,
  fallback: T,
  parse: (value: unknown) => T | null,
): T {
  return parse(JSON.parse(rawValue)) ?? fallback
}

export function writePersistedJson<T>(
  key: string,
  value: T,
  options: { deferNotification?: boolean; source?: symbol } = {},
): void {
  if (!isBrowser) return

  try {
    const newValue = JSON.stringify(value)
    window.localStorage.setItem(key, newValue)
    notifyPersistedStorageChange({ key, newValue, source: options.source }, options)
  } catch (error) {
    console.debug(error)
  }
}

export function subscribeToPersistedStorage(
  key: string,
  onChange: (newValue: string | null) => void,
  options: { ignoreSource?: symbol } = {},
): () => void {
  if (!isBrowser) return () => {}

  const handleStorageChange = (event: StorageEvent | CustomEvent<PersistedStorageChange>) => {
    if (event instanceof StorageEvent) {
      if (event.key === key) {
        onChange(event.newValue)
      }
      return
    }

    if (event.detail.key === key && event.detail.source !== options.ignoreSource) {
      onChange(event.detail.newValue)
    }
  }

  window.addEventListener('storage', handleStorageChange as EventListener)
  window.addEventListener(LOCAL_STORAGE_CHANGE_EVENT, handleStorageChange as EventListener)

  return () => {
    window.removeEventListener('storage', handleStorageChange as EventListener)
    window.removeEventListener(LOCAL_STORAGE_CHANGE_EVENT, handleStorageChange as EventListener)
  }
}

function notifyPersistedStorageChange(
  detail: PersistedStorageChange,
  { deferNotification = false }: { deferNotification?: boolean },
) {
  const dispatch = () => {
    window.dispatchEvent(new CustomEvent(LOCAL_STORAGE_CHANGE_EVENT, { detail }))
  }

  if (deferNotification) {
    queueMicrotask(dispatch)
    return
  }

  dispatch()
}
