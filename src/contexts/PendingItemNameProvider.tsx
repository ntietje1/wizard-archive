import { useMemo, useState } from 'react'
import { PendingItemNameContext } from '~/hooks/usePendingItemName'

export function PendingItemNameProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [pendingItemName, setPendingItemName] = useState('')

  const value = useMemo(
    () => ({ pendingItemName, setPendingItemName }),
    [pendingItemName],
  )

  return (
    <PendingItemNameContext.Provider value={value}>
      {children}
    </PendingItemNameContext.Provider>
  )
}
