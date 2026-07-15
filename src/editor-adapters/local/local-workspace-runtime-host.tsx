import type { ComponentProps } from 'react'
import { ResourceShell } from '@wizard-archive/editor/resources/resource-shell'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { LocalWorkspaceFixture } from './local-workspace-fixture'
import { useLocalWorkspaceRuntime } from './use-local-workspace-runtime'

type ResourceShellProps = ComponentProps<typeof ResourceShell>

type LocalWorkspaceRuntimeHostProps = Omit<ResourceShellProps, 'runtime'> & {
  canEdit?: boolean
  initialResourceId?: ResourceId | null
  initialWorkspace?: LocalWorkspaceFixture
}

export function LocalWorkspaceRuntimeHost({
  canEdit,
  initialResourceId,
  initialWorkspace,
  ...hostProps
}: LocalWorkspaceRuntimeHostProps) {
  const runtime = useLocalWorkspaceRuntime({
    canEdit,
    initialResourceId,
    initialWorkspace,
  })

  if (!runtime) return null

  return <ResourceShell {...hostProps} runtime={runtime} />
}
