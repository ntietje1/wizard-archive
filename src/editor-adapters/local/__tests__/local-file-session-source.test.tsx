import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { describe, expect, it, vi } from 'vite-plus/test'
import type { WizardEditorItemWithContent } from '@wizard-archive/editor/adapter'
import { WORKSPACE_MODE } from 'shared/workspace/workspace-mode'
import { SAMPLE_LOCAL_WORKSPACE } from '../sample-local-workspace'
import { createLocalWorkspaceRuntime } from '../local-workspace-runtime-adapter'
import { createLocalFileSystemSnapshot } from '../local-filesystem-snapshot'
import {
  createTestCanvasEmbeddedSessionPorts,
  createTestCanvasSessionPorts,
  createTestNoteHeadingSessionPorts,
  createTestNotePlaybackSessionPorts,
  createTestNoteSessionPorts,
  createTestNoteValueSessionPorts,
} from './helpers/session-sources'

type LocalFileItemWithContent = Extract<WizardEditorItemWithContent, { type: 'file' }>

describe('local demo filesystem file session source', () => {
  it('resolves seeded demo files from filesystem content', () => {
    const runtime = createLocalWorkspaceRuntime({
      canvasEmbedded: createTestCanvasEmbeddedSessionPorts(),
      canvasPreviewUpload: { status: 'unsupported' },
      canvasSession: createTestCanvasSessionPorts(),
      dispatch: vi.fn(),
      snapshot: createLocalFileSystemSnapshot(SAMPLE_LOCAL_WORKSPACE),
      workspaceMode: WORKSPACE_MODE.EDITOR,
      noteHeadings: createTestNoteHeadingSessionPorts(),
      notePlayback: createTestNotePlaybackSessionPorts(),
      noteSession: createTestNoteSessionPorts(),
      noteValues: createTestNoteValueSessionPorts(),
      openExternalUrl: vi.fn(),
      reportCreateItemError: vi.fn(),
      setNavigation: vi.fn(),
      setWorkspaceMode: vi.fn(),
    })
    const filesystem = runtime.filesystem
    const file = filesystem.catalog.getKnownItemById('file-handout' as ResourceId)
    if (!file || file.type !== 'file') {
      throw new Error('Expected the seeded demo file to exist in the filesystem catalog')
    }

    const resolvedFile = runtime.sessions.file.resolveFile(file as LocalFileItemWithContent)
    expect(resolvedFile).toMatchObject({
      allowDataUrl: true,
      allowObjectUrl: false,
      contentType: 'text/plain',
      downloadUrl: expect.stringMatching(/^data:text\/plain;charset=utf-8,/),
      name: 'blue-glass-invoice.txt',
      size: expect.any(Number),
    })
    expect(resolvedFile.size).toBeGreaterThan(0)
  })
})
