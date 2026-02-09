import { useState } from 'react'
import { PendingItemNameContext } from '~/hooks/usePendingItemName'

export function PendingItemNameProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [pendingItemName, setPendingItemName] = useState('')

  return (
    <PendingItemNameContext value={{ pendingItemName, setPendingItemName }}>
      {children}
    </PendingItemNameContext>
  )
}
