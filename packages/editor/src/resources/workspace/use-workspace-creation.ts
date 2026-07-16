import { useEffect, useRef, useState } from 'react'
import type { ResourceId } from '../domain-id'
import type { ResourceNavigation } from '../editor-runtime-contract'
import type { WorkspaceCreationSettlement } from './resource-operations'

export function useWorkspaceCreation(navigation: ResourceNavigation, targetId: ResourceId | null) {
  const active = useRef<AbortController | null>(null)
  const [attempt, setAttempt] = useState<Readonly<{
    controller: AbortController
    targetId: ResourceId | null
  }> | null>(null)

  useEffect(() => {
    const unsubscribe = navigation.subscribe(() => active.current?.abort())
    return () => {
      unsubscribe()
      active.current?.abort()
      active.current = null
    }
  }, [navigation, targetId])

  const run = async (
    create: (signal: AbortSignal) => Promise<WorkspaceCreationSettlement>,
  ): Promise<WorkspaceCreationSettlement> => {
    active.current?.abort()
    const controller = new AbortController()
    const current = { controller, targetId }
    active.current = controller
    setAttempt(current)
    try {
      return await create(controller.signal)
    } finally {
      if (active.current === controller) {
        active.current = null
        setAttempt(null)
      }
    }
  }

  return {
    pending: attempt?.targetId === targetId,
    run,
  }
}
