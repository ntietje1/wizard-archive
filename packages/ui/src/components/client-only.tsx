import { useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'

const subscribe = () => () => {}
const getClientSnapshot = () => true
const getServerSnapshot = () => false

export function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode
  fallback?: ReactNode
}) {
  const isClient = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)
  return isClient ? children : fallback
}
