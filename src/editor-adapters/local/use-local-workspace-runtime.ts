import { createInMemoryEditorRuntime } from '@wizard-archive/editor/resources/in-memory-editor-runtime'
import type { ResourceNavigation } from '@wizard-archive/editor/resources/editor-runtime-contract'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { LocalWorkspaceFixture } from './local-workspace-fixture'
import { createSampleLocalWorkspaceFixture } from './sample-local-workspace'
import { useCommittedRuntime } from '../committed-runtime'

export function useLocalWorkspaceRuntime({
  canEdit = true,
  initialResourceId,
  initialWorkspace,
}: {
  canEdit?: boolean
  initialResourceId?: ResourceId | null
  initialWorkspace?: LocalWorkspaceFixture
}) {
  return useCommittedRuntime(() => {
    const workspace = initialWorkspace ?? createSampleLocalWorkspaceFixture()
    const core = createInMemoryEditorRuntime({
      ...workspace,
      navigation: createLocalResourceNavigation(initialResourceId ?? null),
      canEdit: canEdit && workspace.scope.projection === 'dm',
    })
    return { ...core, start: () => {} }
  })
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
