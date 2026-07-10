import { vi } from 'vite-plus/test'
import { WORKSPACE_MODE } from 'shared/workspace/workspace-mode'
import type {
  WizardEditorNavigationState,
  WizardEditorRuntime,
} from '@wizard-archive/editor/adapter'
import type { LocalWorkspaceState } from '../../local-workspace-model'
import { createLocalWorkspaceRuntime as createLocalWorkspaceRuntimeBase } from '../../local-workspace-runtime-adapter'
import {
  createLocalFileSystemSnapshot,
  createLocalWorkspaceInitialNavigation,
} from '../../local-filesystem-snapshot'
import {
  createTestCanvasEmbeddedSessionPorts,
  createTestCanvasSessionPorts,
  createTestNoteHeadingSessionPorts,
  createTestNotePlaybackSessionPorts,
  createTestNoteSessionPorts,
  createTestNoteValueSessionPorts,
} from './session-sources'

export function createLocalRuntimeFileSystem(options: LocalRuntimeTestOptions) {
  return createTestRuntimeFileSystem(createLocalWorkspaceRuntime(options))
}

export function createLocalWorkspaceRuntime(options: LocalRuntimeTestOptions): WizardEditorRuntime {
  const { navigation, setNavigation, workspace, ...adapterOptions } = options
  return createLocalWorkspaceRuntimeBase({
    canvasEmbedded: createTestCanvasEmbeddedSessionPorts(),
    canvasPreviewUpload: { status: 'unsupported' },
    canvasSession: createTestCanvasSessionPorts(),
    snapshot: createLocalFileSystemSnapshot(
      workspace,
      navigation ?? createLocalWorkspaceInitialNavigation(workspace),
    ),
    workspaceMode: WORKSPACE_MODE.EDITOR,
    noteHeadings: createTestNoteHeadingSessionPorts(),
    notePlayback: createTestNotePlaybackSessionPorts(),
    noteSession: createTestNoteSessionPorts(),
    noteValues: createTestNoteValueSessionPorts(),
    openExternalUrl: vi.fn(),
    reportCreateItemError: vi.fn(),
    setNavigation: setNavigation ?? vi.fn(),
    setWorkspaceMode: vi.fn(),
    ...adapterOptions,
  })
}

function createTestRuntimeFileSystem(runtime: WizardEditorRuntime) {
  return {
    ...runtime.resources,
    operations: runtime.commands.operations,
    search: runtime.search.items,
    download: runtime.io.download,
    history: runtime.history,
    sharing: runtime.sharing,
  }
}

export type LocalRuntimeTestOptions = Omit<
  Parameters<typeof createLocalWorkspaceRuntimeBase>[0],
  | 'canvasSession'
  | 'canvasEmbedded'
  | 'canvasPreviewUpload'
  | 'snapshot'
  | 'workspaceMode'
  | 'noteHeadings'
  | 'notePlayback'
  | 'noteSession'
  | 'noteValues'
  | 'openExternalUrl'
  | 'reportCreateItemError'
  | 'setNavigation'
  | 'setWorkspaceMode'
> & {
  navigation?: WizardEditorNavigationState
  setNavigation?: (navigation: WizardEditorNavigationState) => void
  workspace: LocalWorkspaceState
} & Partial<
    Pick<
      Parameters<typeof createLocalWorkspaceRuntimeBase>[0],
      | 'canvasSession'
      | 'canvasEmbedded'
      | 'canvasPreviewUpload'
      | 'noteHeadings'
      | 'notePlayback'
      | 'noteSession'
      | 'noteValues'
      | 'openExternalUrl'
      | 'reportCreateItemError'
      | 'workspaceMode'
      | 'setWorkspaceMode'
    >
  >
