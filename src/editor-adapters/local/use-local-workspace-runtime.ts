import { createInMemoryEditorRuntime } from '@wizard-archive/editor/resources/in-memory-editor-runtime'
import { canonicalTargetsEqual } from '@wizard-archive/editor/resources/authored-destination'
import type { ResourceNavigation } from '@wizard-archive/editor/resources/editor-runtime-contract'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { CanonicalTarget } from '@wizard-archive/editor/resources/authored-destination-contract'
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
    const editable = canEdit && workspace.scope.projection === 'dm'
    const core = createInMemoryEditorRuntime({
      ...workspace,
      navigation: createLocalResourceNavigation(initialResourceId ?? null),
      canEdit: editable,
      permission: editable ? 'edit' : 'view',
    })
    return { ...core, start: () => {} }
  })
}

function createLocalResourceNavigation(initialResourceId: ResourceId | null): ResourceNavigation {
  let currentTarget: CanonicalTarget | null = initialResourceId
    ? { kind: 'resource', resourceId: initialResourceId }
    : null
  const listeners = new Set<() => void>()
  return {
    current: () => currentTarget,
    open: (target) => {
      if (
        currentTarget === null
          ? target === null
          : target !== null && canonicalTargetsEqual(target, currentTarget)
      ) {
        return
      }
      currentTarget = target
      for (const listener of listeners) listener()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
