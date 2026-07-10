import { useId, useReducer, useState } from 'react'
import { WORKSPACE_MODE } from 'shared/workspace/workspace-mode'
import type { WorkspaceMode } from 'shared/workspace/workspace-mode'
import type { WizardEditorNoteCollaborationPlayback } from '@wizard-archive/editor/adapter'
import {
  localWorkspaceReducer,
  requireLocalCanvasPayload,
  withValidLocalViewAsPlayerSelection,
} from './local-workspace-model'
import type { LocalWorkspaceState } from './local-workspace-model'
import { createLocalWorkspaceRuntime } from './local-workspace-runtime-adapter'
import { canMutateLocalWorkspace } from './local-workspace-capabilities'
import type {
  LocalWorkspaceErrorReporter,
  LocalWorkspaceExternalUrlNavigation,
  LocalWorkspaceSeparateItemNavigation,
} from './local-workspace-runtime-adapter'
import {
  createLocalFileSystemSnapshot,
  createLocalWorkspaceInitialNavigation,
} from './local-filesystem-snapshot'
import {
  useInMemoryCanvasEmbeddedSessionSource,
  useInMemoryCanvasSessionSource,
} from './in-memory-canvas-session-source'
import {
  useInMemoryNoteHeadingSessionPorts,
  useInMemoryNotePlaybackSessionPorts,
  useInMemoryNoteSessionSource,
  useInMemoryNoteValueSessionPorts,
} from './in-memory-note-session-source'
import { SAMPLE_LOCAL_WORKSPACE } from './sample-local-workspace'

export function useLocalWorkspaceRuntime({
  canEdit = true,
  collaborationPlayback,
  initialItemId,
  initialWorkspace,
  openExternalUrl,
  openSeparateItem,
  reportCreateItemError,
}: {
  canEdit?: boolean
  collaborationPlayback?: WizardEditorNoteCollaborationPlayback
  initialItemId?: string | null
  initialWorkspace?: LocalWorkspaceState
  openExternalUrl: LocalWorkspaceExternalUrlNavigation
  openSeparateItem?: LocalWorkspaceSeparateItemNavigation
  reportCreateItemError: LocalWorkspaceErrorReporter
}) {
  const runtimeInstanceId = useId()
  const [initialState] = useState(() =>
    withValidLocalViewAsPlayerSelection(initialWorkspace ?? SAMPLE_LOCAL_WORKSPACE),
  )
  const [navigation, setNavigation] = useState(() =>
    createLocalWorkspaceInitialNavigation(initialState, initialItemId),
  )
  const [workspace, dispatch] = useReducer(localWorkspaceReducer, initialState)
  const [selectedViewAsPlayerId, setSelectedViewAsPlayerId] = useState(
    initialState.selectedViewAsPlayerId,
  )
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(WORKSPACE_MODE.EDITOR)
  const runtimeWorkspace = withValidLocalViewAsPlayerSelection(
    selectedViewAsPlayerId === workspace.selectedViewAsPlayerId
      ? workspace
      : { ...workspace, selectedViewAsPlayerId },
  )
  const canMutateWorkspace = canMutateLocalWorkspace({
    canEdit,
    selectedViewAsPlayerId: runtimeWorkspace.selectedViewAsPlayerId,
  })
  const snapshot = createLocalFileSystemSnapshot(runtimeWorkspace, navigation)
  const canvasSession = useInMemoryCanvasSessionSource({
    canEdit: canMutateWorkspace,
    getCanvasPayload: (canvasId) => {
      const payload = requireLocalCanvasPayload(runtimeWorkspace, String(canvasId))
      return {
        edges: payload.edges,
        nodes: payload.nodes,
      }
    },
    onCanvasContentChange: ({ canvasId, payload }) => {
      dispatch({ type: 'replaceCanvasPayload', itemId: String(canvasId), payload })
    },
    user: workspace.localUser,
    workspaceId: workspace.workspaceId,
  })
  const canvasEmbedded = useInMemoryCanvasEmbeddedSessionSource({
    getEmbeddedCanvasPayload: (canvasId) => {
      const payload = requireLocalCanvasPayload(runtimeWorkspace, String(canvasId))
      return {
        edges: payload.edges,
        nodes: payload.nodes,
      }
    },
  })
  const noteSession = useInMemoryNoteSessionSource({
    onNoteContentChange: ({ body, noteId }) => {
      dispatch({ type: 'replaceNoteBody', itemId: String(noteId), body })
    },
    user: runtimeWorkspace.localUser,
  })
  const noteHeadings = useInMemoryNoteHeadingSessionPorts()
  const notePlayback = useInMemoryNotePlaybackSessionPorts({ collaborationPlayback })
  const noteValues = useInMemoryNoteValueSessionPorts()
  return createLocalWorkspaceRuntime({
    canEdit,
    canvasEmbedded,
    canvasPreviewUpload: { status: 'unsupported' },
    canvasSession,
    dispatch,
    runtimeInstanceId,
    snapshot,
    workspaceMode,
    noteHeadings,
    notePlayback,
    noteSession,
    noteValues,
    openExternalUrl,
    openSeparateItem,
    reportCreateItemError,
    setNavigation,
    setSelectedViewAsPlayerId,
    setWorkspaceMode,
  })
}
