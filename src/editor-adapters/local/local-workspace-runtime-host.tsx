import type { ComponentProps } from 'react'
import { WizardEditor } from '@wizard-archive/editor'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { LocalWorkspaceFixture } from './local-workspace-fixture'
import { useLocalWorkspaceRuntime } from './use-local-workspace-runtime'

type WizardEditorComponentProps = ComponentProps<typeof WizardEditor>

type LocalWorkspaceRuntimeHostProps = Omit<WizardEditorComponentProps, 'runtime'> & {
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

  return <WizardEditor {...hostProps} runtime={runtime} />
}
