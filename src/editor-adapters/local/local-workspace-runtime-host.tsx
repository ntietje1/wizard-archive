import type { ComponentProps } from 'react'
import { WizardEditor } from '@wizard-archive/editor'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { LocalWorkspaceFixture } from './local-workspace-fixture'
import { useLocalWorkspaceRuntime } from './use-local-workspace-runtime'

type WizardEditorComponentProps = ComponentProps<typeof WizardEditor>

type LocalWorkspaceRuntimeHostProps = Omit<WizardEditorComponentProps, 'runtime'> & {
  canEdit?: boolean
  initialItemId?: ResourceId | null
  initialWorkspace?: LocalWorkspaceFixture
}

export function LocalWorkspaceRuntimeHost({
  canEdit,
  initialItemId,
  initialWorkspace,
  ...hostProps
}: LocalWorkspaceRuntimeHostProps) {
  const runtime = useLocalWorkspaceRuntime({
    canEdit,
    initialItemId,
    initialWorkspace,
  })

  return <WizardEditor {...hostProps} runtime={runtime} />
}
