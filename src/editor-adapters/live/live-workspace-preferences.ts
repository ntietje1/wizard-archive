import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type {
  WizardEditorSortDirection,
  WizardEditorSortOrder,
} from '@wizard-archive/editor/adapter'
import type { WorkspaceMode } from 'shared/workspace/workspace-mode'
import type { Id } from 'convex/_generated/dataModel'

export interface LiveWorkspacePreferences {
  sortOrder: WizardEditorSortOrder
  sortDirection: WizardEditorSortDirection
  editorMode: WorkspaceMode
}

export function liveWorkspacePreferencesQuery(workspaceRecordId: Id<'campaigns'>) {
  return convexQuery(api.editors.queries.getCurrentEditor, {
    campaignId: workspaceRecordId,
  })
}
