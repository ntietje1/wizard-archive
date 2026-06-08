import { useEffect, useRef, useState } from 'react'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import type { EmbedTarget } from 'shared/embeds/embedTargets'
import type { PendingRichEmbedActivationRef } from './use-rich-embed-lifecycle'
import { normalizeEmbedNodeData } from './embed-node-data'
import {
  useCanvasDocumentRuntime,
  useCanvasInteractionRuntime,
  useCanvasViewportRuntime,
} from '../../runtime/providers/canvas-runtime'
import { ResizableNodeWrapper } from '../shared/resizable-node-wrapper'
import { CANVAS_NODE_MIN_SIZE } from '../shared/canvas-node-resize-constants'
import type { EmbedNodeData } from './embed-node-data'
import { EmbedNoteContent } from './embed-note-content'
import { CanvasFloatingFormattingToolbar } from '../shared/canvas-floating-formatting-toolbar'
import { registerCanvasRichTextFormattingSession } from '../shared/canvas-rich-text-formatting-session'
import { useCanvasEditableNodeSession } from '../shared/use-canvas-editable-node-session'
import type { AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'
import { useSidebarItemById } from '~/features/sidebar/hooks/useSidebarItemById'
import { useSidebarItemAvailabilityState } from '~/features/sidebar/hooks/useSidebarItemAvailabilityState'
import { cn } from '~/features/shadcn/lib/utils'
import { CanvasNodeConnectionHandles } from '../shared/canvas-node-connection-handles'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import {
  getCanvasNodeDefaultTextColor,
  getCanvasNodeSurfaceStyle,
  getCanvasNodeTextStyle,
} from '../shared/canvas-node-surface-style'
import { SidebarItemPreviewContent } from '~/features/previews/components/sidebar-item-preview-content'
import { EmbeddedCanvasContent } from './embedded-canvas-content'
import { EmbeddedMapContent } from './embedded-map-content'
import { useIsInteractiveCanvasRenderMode } from '../../runtime/providers/use-canvas-render-mode'
import { useCanvasEngine } from '../../react/canvas-engine-context-value'
import { useCanvasViewportZoom } from '../../react/use-canvas-engine'
import type { CanvasNodeComponentProps } from '../canvas-node-types'
import type { CanvasDocumentWriter } from '../../tools/canvas-tool-types'
import { EmbedContent } from '~/features/embeds/components/embed-content'
import { useEmbedDropTarget } from '~/features/embeds/hooks/use-embed-drop-target'
import { useEditableEmbedTargetControls } from '~/features/embeds/hooks/use-editable-embed-target-controls'
import type { EmbedMediaLayout } from '~/features/embeds/utils/embed-media'
import { Button } from '~/features/shadcn/components/button'
import { Input } from '~/features/shadcn/components/input'
import type { Id } from 'convex/_generated/dataModel'
import type { ReactNode, RefObject } from 'react'

const EMBED_FLOATING_LABEL_GAP_PX = 6
const EMBED_FLOATING_LABEL_LINE_HEIGHT_PX = 16

function persistEmbedTextColor(
  patchNodeData: CanvasDocumentWriter['patchNodeData'],
  id: string,
  textColor: string,
) {
  patchNodeData(new Map([[id, { textColor }]]))
}

export function EmbedNode({ id, data, dragging }: CanvasNodeComponentProps<EmbedNodeData>) {
  const canvasEngine = useCanvasEngine()
  const normalizedData = normalizeEmbedNodeData(data)
  const interactiveRenderMode = useIsInteractiveCanvasRenderMode()
  const target = normalizedData.target
  const sidebarItemId =
    target.kind === 'sidebarItem' ? (target.sidebarItemId as Id<'sidebarItems'>) : null
  const contentQuery = useSidebarItemById(sidebarItemId)
  const itemState = useSidebarItemAvailabilityState({
    lookup: { kind: 'id', id: sidebarItemId },
    readableItem: contentQuery.data,
    readableItemLoading: contentQuery.isLoading,
    readableItemError: contentQuery.error,
    canView: contentQuery.data !== undefined,
    subject: 'item',
    fallbackLabel: 'Embedded item',
  })
  const contentItem = itemState.status === 'available' ? itemState.item : undefined
  const [editor, setEditor] = useState<CustomBlockNoteEditor | null>(null)
  const { canvasId, documentWriter, provider } = useCanvasDocumentRuntime()
  const { patchNodeData } = documentWriter
  const { domRuntime } = useCanvasViewportRuntime()
  const { canEdit, editSession } = useCanvasInteractionRuntime()
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const [mediaLayout, setMediaLayout] = useState<EmbedMediaLayout | null>(null)
  const editableSession = useCanvasEditableNodeSession({
    id,
    canEdit: canEdit && interactiveRenderMode,
    editing: editSession.editingEmbedId === id,
    setEditing: (editing) => editSession.setEditingEmbedId(editing ? id : null),
  })
  const isEditing = editableSession.editable && contentItem?.type === SIDEBAR_ITEM_TYPES.notes
  const noteEditor = contentItem?.type === SIDEBAR_ITEM_TYPES.notes ? editor : null
  const showsFormattingToolbar = isEditing && noteEditor !== null
  const defaultTextColor = getCanvasNodeDefaultTextColor(normalizedData)

  const zoom = useCanvasViewportZoom()
  const label = getEmbedFloatingLabel(target, itemState.label)
  const isUnavailable =
    target.kind === 'sidebarItem' &&
    itemState.status !== 'available' &&
    itemState.status !== 'loading'
  const showFloatingLabel = !showsFormattingToolbar
  const isEditableEmbed = canEdit && interactiveRenderMode
  const lastStoredAspectRatioRef = useRef<number | null>(normalizedData.lockedAspectRatio ?? null)
  const setEmbedMediaLayout = (layout: EmbedMediaLayout) => {
    setMediaLayout(layout)
    const lockedAspectRatio = getEmbedMediaAspectRatio(layout)
    if (lastStoredAspectRatioRef.current !== lockedAspectRatio) {
      lastStoredAspectRatioRef.current = lockedAspectRatio
      patchNodeData(new Map([[id, { lockedAspectRatio }]]))
    }

    if (layout.kind === 'fixedHeight') {
      const node = canvasEngine.getSnapshot().nodeLookup.get(id)?.node
      if (node && node.height !== layout.height) {
        documentWriter.resizeNode(
          id,
          node.width ?? CANVAS_NODE_MIN_SIZE,
          layout.height,
          node.position,
        )
      }
    }
  }
  const setTarget = async (nextTarget: EmbedTarget) => {
    patchNodeData(new Map([[id, { target: nextTarget }]]))
    await provider?.flushUpdates()
  }
  const renderSidebarItem = (item: AnySidebarItemWithContent) => (
    <EmbedRichContent
      nodeId={id}
      contentItem={item}
      isEditing={isEditing}
      isExclusivelySelected={editableSession.isExclusivelySelected}
      interactiveRenderMode={interactiveRenderMode}
      onActivated={editableSession.handleActivated}
      onEditorChange={setEditor}
      pendingActivationRef={editableSession.pendingActivationRef}
      textColor={normalizedData.textColor}
    />
  )

  useEffect(() => domRuntime.registerNodeSurfaceElement(id, surfaceRef.current), [domRuntime, id])

  useEffect(() => {
    if (!showsFormattingToolbar || !noteEditor) {
      return
    }

    return registerCanvasRichTextFormattingSession({
      nodeId: id,
      editor: noteEditor,
      defaultTextColor,
      setDefaultTextColor: (textColor) => {
        persistEmbedTextColor(patchNodeData, id, textColor)
      },
    })
  }, [defaultTextColor, id, noteEditor, patchNodeData, showsFormattingToolbar])

  return (
    <ResizableNodeWrapper
      id={id}
      nodeType="embed"
      dragging={!!dragging}
      minWidth={CANVAS_NODE_MIN_SIZE}
      minHeight={getEmbedResizeMinHeight(mediaLayout)}
      lockedAspectRatio={getLockedAspectRatio(target, contentItem, mediaLayout, normalizedData)}
      resizeAxes={mediaLayout?.kind === 'fixedHeight' ? 'horizontal' : 'both'}
      editing={showsFormattingToolbar}
      chrome={
        <>
          <CanvasFloatingFormattingToolbar
            defaultTextColor={defaultTextColor}
            editor={noteEditor}
            onDefaultTextColorChange={(textColor) => {
              persistEmbedTextColor(patchNodeData, id, textColor)
            }}
            visible={showsFormattingToolbar}
          />
          <CanvasNodeConnectionHandles />
          {showFloatingLabel && (
            <EmbedFloatingLabel label={label} missing={isUnavailable} zoom={zoom} />
          )}
        </>
      }
    >
      <div
        ref={surfaceRef}
        className={cn(
          'relative h-full w-full overflow-hidden rounded-lg',
          isEditing ? 'select-text' : 'select-none',
        )}
        style={{
          ...getCanvasNodeSurfaceStyle(normalizedData),
          ...getCanvasNodeTextStyle(normalizedData),
        }}
        onDoubleClick={(event) => {
          if (!interactiveRenderMode || contentItem?.type !== SIDEBAR_ITEM_TYPES.notes) {
            return
          }

          event.preventDefault()
          event.stopPropagation()
          editableSession.handleDoubleClick(event)
        }}
      >
        <div className="h-full w-full min-h-0 min-w-0">
          {isEditableEmbed ? (
            <EditableCanvasEmbedContent
              rootRef={surfaceRef}
              sourceCanvasId={canvasId}
              target={target}
              setTarget={setTarget}
              onMediaLayout={setEmbedMediaLayout}
              renderSidebarItem={renderSidebarItem}
            />
          ) : (
            <EmbedContent
              target={target}
              sourceItemId={canvasId}
              mode="readonly"
              onMediaLayout={setEmbedMediaLayout}
              renderSidebarItem={renderSidebarItem}
            />
          )}
        </div>
      </div>
    </ResizableNodeWrapper>
  )
}

function EditableCanvasEmbedContent({
  rootRef,
  sourceCanvasId,
  target,
  setTarget,
  onMediaLayout,
  renderSidebarItem,
}: {
  rootRef: RefObject<HTMLElement | null>
  sourceCanvasId: Id<'sidebarItems'> | null
  target: EmbedTarget
  setTarget: (target: EmbedTarget) => Promise<void>
  onMediaLayout: (layout: EmbedMediaLayout) => void
  renderSidebarItem: (item: AnySidebarItemWithContent) => ReactNode
}) {
  const embedControls = useEditableEmbedTargetControls({ setTarget })

  useEmbedDropTarget({
    ref: rootRef,
    enabled: true,
    sourceItemId: sourceCanvasId,
    setTarget: embedControls.setTargetAndCloseDraft,
    uploadFile: embedControls.uploadFile,
  })

  return (
    <>
      <EmbedContent
        target={target}
        sourceItemId={sourceCanvasId}
        mode="editable"
        onUpload={embedControls.openFilePicker}
        onLinkExternal={embedControls.openLinkDraft}
        onMediaLayout={onMediaLayout}
        renderSidebarItem={renderSidebarItem}
      />
      <input
        ref={embedControls.fileInputRef}
        type="file"
        aria-label="Embed file upload"
        className="hidden"
        onChange={embedControls.handleFileInputChange}
      />
      {embedControls.isUploading || embedControls.uploadError ? (
        <div className="absolute inset-x-2 bottom-2 z-20 rounded-md border border-border bg-background/95 px-3 py-2 text-sm shadow-sm">
          {embedControls.uploadError ? (
            <span className="text-destructive">{embedControls.uploadError}</span>
          ) : (
            <span className="text-muted-foreground">Uploading...</span>
          )}
        </div>
      ) : null}
      {embedControls.linkDraftOpen ? (
        <form
          className="absolute inset-x-2 bottom-2 z-20 flex gap-2 rounded-md border border-border bg-background/95 p-2 shadow-sm"
          action={embedControls.submitLinkDraft}
        >
          <Input
            value={embedControls.linkDraft}
            aria-label="External file URL"
            placeholder="https://example.com/file.pdf"
            onChange={(event) => {
              embedControls.setLinkDraftValue(event.target.value)
            }}
          />
          <Button type="submit" size="sm">
            Link
          </Button>
          {embedControls.linkError ? (
            <span className="self-center whitespace-nowrap text-sm text-destructive">
              {embedControls.linkError}
            </span>
          ) : null}
        </form>
      ) : null}
    </>
  )
}

function EmbedFloatingLabel({
  label,
  missing,
  zoom,
}: {
  label: string
  missing: boolean
  zoom: number
}) {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1

  return (
    <div
      data-testid="embed-node-floating-label-frame"
      className="pointer-events-none absolute left-0 top-0 z-20 w-full select-none"
      style={{
        height: EMBED_FLOATING_LABEL_LINE_HEIGHT_PX / safeZoom,
        transform: `translateY(calc(-100% - ${EMBED_FLOATING_LABEL_GAP_PX / safeZoom}px))`,
      }}
    >
      <span
        data-testid="embed-node-floating-label"
        className="absolute bottom-0 left-0 block truncate text-xs font-medium text-muted-foreground"
        style={{
          lineHeight: `${EMBED_FLOATING_LABEL_LINE_HEIGHT_PX}px`,
          transform: `scale(${1 / safeZoom})`,
          transformOrigin: 'left bottom',
          width: `${safeZoom * 100}%`,
        }}
      >
        {missing ? `Warning: ${label}` : label}
      </span>
    </div>
  )
}

function EmbedRichContent({
  nodeId,
  contentItem,
  isEditing,
  isExclusivelySelected,
  interactiveRenderMode,
  onActivated,
  onEditorChange,
  pendingActivationRef,
  textColor,
}: {
  nodeId: string
  contentItem: AnySidebarItemWithContent
  isEditing: boolean
  isExclusivelySelected: boolean
  interactiveRenderMode: boolean
  onActivated: () => void
  onEditorChange: (editor: CustomBlockNoteEditor | null) => void
  pendingActivationRef: PendingRichEmbedActivationRef
  textColor: string | null
}): React.ReactElement | null {
  if (contentItem.type === SIDEBAR_ITEM_TYPES.notes) {
    return (
      <EmbedNoteContent
        note={contentItem}
        editable={isEditing}
        isExclusivelySelected={isExclusivelySelected}
        onActivated={onActivated}
        onCanvasEditorChange={onEditorChange}
        pendingActivationRef={pendingActivationRef}
        textColor={textColor}
      />
    )
  }

  if (contentItem.type === SIDEBAR_ITEM_TYPES.canvases) {
    return interactiveRenderMode ? (
      <EmbeddedCanvasContent
        nodeId={nodeId}
        canvasId={contentItem._id}
        previewUrl={contentItem.previewUrl}
        alt={contentItem.name}
      />
    ) : (
      <SidebarItemPreviewContent item={contentItem} />
    )
  }

  if (contentItem.type === SIDEBAR_ITEM_TYPES.gameMaps) {
    return interactiveRenderMode ? (
      <EmbeddedMapContent nodeId={nodeId} map={contentItem} />
    ) : (
      <SidebarItemPreviewContent item={contentItem} />
    )
  }

  if (contentItem.type === SIDEBAR_ITEM_TYPES.files) {
    return <SidebarItemPreviewContent item={contentItem} />
  }

  const hasScrollableContent = contentItem.type === SIDEBAR_ITEM_TYPES.folders

  return (
    <div
      className={cn(
        'h-full overflow-hidden',
        hasScrollableContent && interactiveRenderMode && isExclusivelySelected && 'nowheel',
      )}
    >
      <SidebarItemPreviewContent item={contentItem} />
    </div>
  )
}

function getEmbedFloatingLabel(target: EmbedNodeData['target'], sidebarItemLabel: string) {
  if (target.kind === 'externalUrl') return target.name ?? target.url
  if (target.kind === 'empty') return 'Empty embed'
  return sidebarItemLabel
}

function getLockedAspectRatio(
  target: EmbedNodeData['target'],
  contentItem: AnySidebarItemWithContent | undefined,
  mediaLayout: EmbedMediaLayout | null,
  normalizedData: EmbedNodeData,
) {
  if (mediaLayout?.kind === 'fixedHeight') {
    return undefined
  }

  const lockedAspectRatio =
    getEmbedMediaAspectRatio(mediaLayout) ?? normalizedData.lockedAspectRatio
  if (typeof lockedAspectRatio !== 'number') {
    return undefined
  }

  if (target.kind === 'externalUrl') {
    return lockedAspectRatio
  }

  if (contentItem?.type === SIDEBAR_ITEM_TYPES.gameMaps) {
    return lockedAspectRatio
  }

  if (contentItem?.type === SIDEBAR_ITEM_TYPES.files) {
    return lockedAspectRatio
  }

  return undefined
}

function getEmbedMediaAspectRatio(mediaLayout: EmbedMediaLayout | null) {
  if (
    mediaLayout?.kind === 'intrinsicAspectRatio' &&
    typeof mediaLayout.aspectRatio === 'number' &&
    Number.isFinite(mediaLayout.aspectRatio) &&
    mediaLayout.aspectRatio > 0
  ) {
    return mediaLayout.aspectRatio
  }

  return null
}

function getEmbedResizeMinHeight(mediaLayout: EmbedMediaLayout | null) {
  return mediaLayout?.kind === 'fixedHeight' ? mediaLayout.height : CANVAS_NODE_MIN_SIZE
}
