import { useEffect, useRef, useState } from 'react'
import { createInMemoryEditorRuntime } from '@wizard-archive/editor/resources/in-memory-editor-runtime'
import type { ResourceNavigation } from '@wizard-archive/editor/resources/editor-runtime-contract'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { LocalWorkspaceFixture } from './local-workspace-fixture'
import { createSampleLocalWorkspaceFixture } from './sample-local-workspace'

export function useLocalWorkspaceRuntime({
  canEdit = true,
  initialResourceId,
  initialWorkspace,
}: {
  canEdit?: boolean
  initialResourceId?: ResourceId | null
  initialWorkspace?: LocalWorkspaceFixture
}) {
  const [core] = useState(() => {
    const workspace = initialWorkspace ?? createSampleLocalWorkspaceFixture()
    return createInMemoryEditorRuntime({
      ...workspace,
      navigation: createLocalResourceNavigation(initialResourceId ?? null),
      canEdit: canEdit && workspace.scope.projection === 'dm',
    })
  })

  const disposal = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (disposal.current) clearTimeout(disposal.current)
    return () => {
      // Defer disposal so React's development cleanup/reconnect cycle can retain the same runtime.
      disposal.current = setTimeout(core.dispose)
    }
  }, [core])
  return core.runtime
}

function createLocalResourceNavigation(initialResourceId: ResourceId | null): ResourceNavigation {
  let currentResourceId = initialResourceId
  const listeners = new Set<() => void>()
  return {
    current: () => currentResourceId,
    open: (resourceId) => {
      if (resourceId === currentResourceId) return
      currentResourceId = resourceId
      for (const listener of listeners) listener()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
