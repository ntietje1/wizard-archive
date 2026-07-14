import type { ComponentProps } from 'react'
import { WizardEditor, createBrowserWizardEditorViewStateStores } from '@wizard-archive/editor'
import type { WizardEditorViewStateStores } from '@wizard-archive/editor'
import type { WizardEditorNoteCollaborationPlayback } from '@wizard-archive/editor/adapter'
import { openBrowserExternalUrl } from '~/editor-adapters/browser/open-browser-external-url'
import { handleError } from '~/shared/utils/logger'
import type { LocalWorkspaceState } from './local-workspace-model'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { useLocalWorkspaceRuntime } from './use-local-workspace-runtime'
import type {
  LocalWorkspaceErrorReporter,
  LocalWorkspaceExternalUrlNavigation,
  LocalWorkspaceSeparateItemNavigation,
} from './local-workspace-runtime-adapter'

type WizardEditorComponentProps = ComponentProps<typeof WizardEditor>

type LocalWorkspaceRuntimeHostProps = Omit<
  WizardEditorComponentProps,
  'runtime' | 'viewStateStores'
> & {
  canEdit?: boolean
  collaborationPlayback?: WizardEditorNoteCollaborationPlayback
  initialItemId?: ResourceId | null
  initialWorkspace?: LocalWorkspaceState
  openExternalUrl?: LocalWorkspaceExternalUrlNavigation
  openSeparateItem?: LocalWorkspaceSeparateItemNavigation
  reportCreateItemError?: LocalWorkspaceErrorReporter
  viewStateStores?: WizardEditorViewStateStores
}

export function LocalWorkspaceRuntimeHost({
  canEdit,
  collaborationPlayback,
  initialItemId,
  initialWorkspace,
  openExternalUrl = openBrowserExternalUrl,
  openSeparateItem,
  reportCreateItemError = handleError,
  viewStateStores,
  ...hostProps
}: LocalWorkspaceRuntimeHostProps) {
  const runtime = useLocalWorkspaceRuntime({
    canEdit,
    collaborationPlayback,
    initialItemId,
    initialWorkspace,
    openExternalUrl,
    openSeparateItem,
    reportCreateItemError,
  })

  return (
    <WizardEditor
      {...hostProps}
      runtime={runtime}
      viewStateStores={
        viewStateStores ??
        createBrowserWizardEditorViewStateStores({ namespace: runtime.workspace.instanceId })
      }
    />
  )
}
