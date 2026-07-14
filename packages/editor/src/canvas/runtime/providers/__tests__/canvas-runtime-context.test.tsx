import type { ResourceId } from '../../../../resources/domain-id'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vite-plus/test'

import { createCanvasRuntime } from '../../__tests__/canvas-runtime-test-utils'
import {
  CanvasRuntimeProvider,
  useCanvasCollaborationRuntime,
  useCanvasDocumentRuntime,
  useCanvasInteractionRuntime,
  useCanvasToolLocalOverlayRuntimeStore,
  useCanvasToolRuntimeStore,
  useCanvasViewportRuntime,
} from '../canvas-runtime'

describe('CanvasRuntimeProvider', () => {
  it('throws from grouped runtime hooks outside the provider', () => {
    expect(() => renderHook(() => useCanvasDocumentRuntime())).toThrow(
      'useCanvasDocumentRuntime must be used within CanvasRuntimeProvider',
    )
    expect(() => renderHook(() => useCanvasInteractionRuntime())).toThrow(
      'useCanvasInteractionRuntime must be used within CanvasRuntimeProvider',
    )
    expect(() => renderHook(() => useCanvasViewportRuntime())).toThrow(
      'useCanvasViewportRuntime must be used within CanvasRuntimeProvider',
    )
    expect(() => renderHook(() => useCanvasCollaborationRuntime())).toThrow(
      'useCanvasCollaborationRuntime must be used within CanvasRuntimeProvider',
    )
    expect(() => renderHook(() => useCanvasToolRuntimeStore())).toThrow(
      'useCanvasToolRuntimeStore must be used within CanvasRuntimeProvider',
    )
    expect(() => renderHook(() => useCanvasToolLocalOverlayRuntimeStore())).toThrow(
      'useCanvasToolLocalOverlayRuntimeStore must be used within CanvasRuntimeProvider',
    )
  })

  it('exposes services grouped by runtime concern', () => {
    const runtime = createCanvasRuntime()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CanvasRuntimeProvider {...runtime}>{children}</CanvasRuntimeProvider>
    )

    expect(renderHook(() => useCanvasDocumentRuntime(), { wrapper }).result.current).toEqual({
      canvasId: null,
      commands: runtime.commands,
      documentWriter: runtime.documentWriter,
      embedTargetOperations: undefined,
      history: runtime.history,
      isSidebarItemEmbedRichTextEditable: runtime.isSidebarItemEmbedRichTextEditable,
      noteDocumentSource: runtime.noteDocumentSource,
      noteEmbeddedNoteContentSource: runtime.noteEmbeddedNoteContentSource,
      noteEmbedTargetSource: runtime.noteEmbedTargetSource,
      noteLinkCreationSource: runtime.noteLinkCreationSource,
      noteLinkNavigationSource: runtime.noteLinkNavigationSource,
      noteLinkResolutionSource: runtime.noteLinkResolutionSource,
      notePlaybackSource: runtime.notePlaybackSource,
      notePermissionSource: runtime.notePermissionSource,
      noteSharingSource: runtime.noteSharingSource,
      noteValueReferences: runtime.noteValueReferences,
      noteValueStateSource: runtime.noteValueStateSource,
      noteWikiLinkSource: runtime.noteWikiLinkSource,
      provider: null,
    })
    expect(renderHook(() => useCanvasInteractionRuntime(), { wrapper }).result.current).toEqual({
      canEdit: runtime.canEdit,
      editSession: runtime.editSession,
      nodeActions: runtime.nodeActions,
      selection: runtime.selection,
    })
    expect(renderHook(() => useCanvasViewportRuntime(), { wrapper }).result.current).toEqual({
      domRuntime: runtime.domRuntime,
      viewportController: runtime.viewportController,
    })
    expect(renderHook(() => useCanvasCollaborationRuntime(), { wrapper }).result.current).toEqual({
      remoteNodeHighlights: runtime.remoteNodeHighlights,
      remoteEdgeHighlights: runtime.remoteEdgeHighlights,
    })
  })

  it('derives embed target operations from the note content source', () => {
    const uploadFile = () =>
      Promise.resolve({
        status: 'completed' as const,
        itemId: 'uploaded-file' as ResourceId,
      })
    const baseRuntime = createCanvasRuntime()
    const runtime = createCanvasRuntime({
      noteEmbedTargetSource: {
        ...baseRuntime.noteEmbedTargetSource,
        embedTargetOperations: { uploadFile },
      },
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CanvasRuntimeProvider {...runtime}>{children}</CanvasRuntimeProvider>
    )

    expect(
      renderHook(() => useCanvasDocumentRuntime(), { wrapper }).result.current
        .embedTargetOperations,
    ).toBe(runtime.noteEmbedTargetSource.embedTargetOperations)
  })

  it('keeps grouped service objects stable when provider inputs do not change', () => {
    const runtime = createCanvasRuntime()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CanvasRuntimeProvider {...runtime}>{children}</CanvasRuntimeProvider>
    )
    const { result: documentResult, rerender: rerenderDocument } = renderHook(
      () => useCanvasDocumentRuntime(),
      { wrapper },
    )
    const { result: interactionResult, rerender: rerenderInteraction } = renderHook(
      () => useCanvasInteractionRuntime(),
      { wrapper },
    )
    const { result: viewportResult, rerender: rerenderViewport } = renderHook(
      () => useCanvasViewportRuntime(),
      { wrapper },
    )
    const { result: collaborationResult, rerender: rerenderCollaboration } = renderHook(
      () => useCanvasCollaborationRuntime(),
      { wrapper },
    )

    const documentServices = documentResult.current
    const interactionServices = interactionResult.current
    const viewportServices = viewportResult.current
    const collaborationServices = collaborationResult.current

    rerenderDocument()
    rerenderInteraction()
    rerenderViewport()
    rerenderCollaboration()

    expect(documentResult.current).toBe(documentServices)
    expect(interactionResult.current).toBe(interactionServices)
    expect(viewportResult.current).toBe(viewportServices)
    expect(collaborationResult.current).toBe(collaborationServices)
  })
})
