import { useEffect, useState } from 'react'

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  const validatedDelay = Number.isFinite(Number(delay)) ? Math.max(0, Number(delay)) : 0

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), validatedDelay)
    return () => clearTimeout(timer)
  }, [value, validatedDelay])

  return debounced
}
