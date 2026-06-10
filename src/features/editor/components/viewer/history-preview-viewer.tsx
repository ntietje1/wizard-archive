import * as Y from 'yjs'
import { Loader2 } from 'lucide-react'
import {
  DEFAULT_SIDEBAR_ITEM_COLOR,
  normalizeSidebarItemColorOrDefault,
} from 'shared/sidebar-items/color'
import { HistoryPreviewBanner } from './history-preview-banner'
import type { SidebarItemId } from 'shared/common/ids'
import type { CustomBlock } from 'shared/editor-blocks/types'
import type { GameMapSnapshotData } from 'shared/game-maps/types'
import { CanvasPreviewEmbedNode } from '~/features/canvas/components/canvas-preview-embed-node'
import { CanvasReadOnlyPreview } from '~/features/canvas/components/canvas-read-only-preview'
import { RawNoteContentWithEmbeds } from '~/features/editor/components/raw-note-content-with-embeds'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import { PinMarker } from '~/features/editor/components/viewer/map/pin-marker'
import { resolvePinIcon } from '~/features/editor/components/viewer/map/pin-utils'
import { yDocToBlocks } from 'shared/editor-blocks/blocknote-yjs'
import { logger } from '~/shared/utils/logger'
import type {
  CanvasDocumentEdge,
  CanvasDocumentNode,
} from '~/features/canvas/domain/canvas-document'

type SnapshotReadResult<T> = { status: 'ready'; value: T } | { status: 'corrupted' }

export type GameMapSnapshotImageUrlState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; url: string }

export type HistoryPreviewSnapshot =
  | { kind: 'note-yjs'; noteId: SidebarItemId; data: ArrayBuffer }
  | { kind: 'canvas-yjs'; canvasId: SidebarItemId; data: ArrayBuffer }
  | {
      kind: 'game-map'
      snapshotData: GameMapSnapshotData | null
      imageUrlState: GameMapSnapshotImageUrlState
    }
  | { kind: 'unsupported' }

export type HistoryPreviewViewerState =
  | { status: 'loading'; entryTime: number | undefined }
  | { status: 'error'; entryTime: number | undefined }
  | { status: 'unavailable'; entryTime: number | undefined }
  | { status: 'ready'; entryTime: number | undefined; snapshot: HistoryPreviewSnapshot }

function readNoteYjsSnapshot(data: ArrayBuffer): SnapshotReadResult<Array<CustomBlock>> {
  const doc = new Y.Doc()
  try {
    Y.applyUpdate(doc, new Uint8Array(data))
    return { status: 'ready', value: yDocToBlocks(doc, 'document') }
  } catch (error) {
    logger.error('Failed to parse note snapshot:', error)
    return { status: 'corrupted' }
  } finally {
    doc.destroy()
  }
}

function readCanvasSnapshot(data: ArrayBuffer): SnapshotReadResult<{
  nodes: Array<CanvasDocumentNode>
  edges: Array<CanvasDocumentEdge>
}> {
  const doc = new Y.Doc()
  try {
    Y.applyUpdate(doc, new Uint8Array(data))

    const nodesMap = doc.getMap<CanvasDocumentNode>('nodes')
    const edgesMap = doc.getMap<CanvasDocumentEdge>('edges')

    return {
      status: 'ready',
      value: {
        nodes: Array.from(nodesMap.values()),
        edges: Array.from(edgesMap.values()),
      },
    }
  } catch (error) {
    logger.error('Failed to parse canvas snapshot:', error)
    return { status: 'corrupted' }
  } finally {
    doc.destroy()
  }
}

export function HistoryPreviewViewer({
  canEdit,
  onExit,
  onRestore,
  state,
}: {
  canEdit: boolean
  onExit: () => void
  onRestore: () => void
  state: HistoryPreviewViewerState
}) {
  if (state.status === 'loading') {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="flex flex-col h-full">
        <HistoryPreviewBanner
          canEdit={canEdit}
          entryTime={state.entryTime}
          onExit={onExit}
          onRestore={onRestore}
        />
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Failed to load history preview.</p>
        </div>
      </div>
    )
  }

  if (state.status === 'unavailable') {
    return (
      <div className="flex flex-col h-full">
        <HistoryPreviewBanner
          canEdit={canEdit}
          entryTime={state.entryTime}
          onExit={onExit}
          onRestore={onRestore}
        />
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Preview not available for this version.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <HistoryPreviewBanner
        canEdit={canEdit}
        entryTime={state.entryTime}
        onExit={onExit}
        onRestore={onRestore}
      />
      {state.snapshot.kind === 'note-yjs' && (
        <NoteYjsSnapshotPreview noteId={state.snapshot.noteId} data={state.snapshot.data} />
      )}
      {state.snapshot.kind === 'canvas-yjs' && (
        <CanvasSnapshotPreview canvasId={state.snapshot.canvasId} data={state.snapshot.data} />
      )}
      {state.snapshot.kind === 'game-map' && (
        <GameMapSnapshotPreview
          snapshotData={state.snapshot.snapshotData}
          imageUrlState={state.snapshot.imageUrlState}
        />
      )}
      {state.snapshot.kind === 'unsupported' && (
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">
            Preview not available for this snapshot type.
          </p>
        </div>
      )}
    </div>
  )
}

function NoteYjsSnapshotPreview({ noteId, data }: { noteId: SidebarItemId; data: ArrayBuffer }) {
  const result = readNoteYjsSnapshot(data)

  if (result.status === 'corrupted') {
    return <CorruptedSnapshotState />
  }

  return (
    <ScrollArea className="flex-1 min-h-0">
      <RawNoteContentWithEmbeds
        noteId={noteId}
        content={result.value}
        editable={false}
        className="mx-auto w-full max-w-3xl mt-2"
      />
    </ScrollArea>
  )
}

function CanvasSnapshotPreview({ canvasId, data }: { canvasId: SidebarItemId; data: ArrayBuffer }) {
  const result = readCanvasSnapshot(data)

  if (result.status === 'corrupted') {
    return <CorruptedSnapshotState />
  }

  return (
    <div className="flex-1 min-h-0">
      <CanvasReadOnlyPreview
        nodes={result.value.nodes}
        edges={result.value.edges}
        interactive
        embedRenderer={CanvasPreviewEmbedNode}
        sourceItemId={canvasId}
      />
    </div>
  )
}

function CorruptedSnapshotState() {
  return (
    <div className="flex-1 min-h-0 flex items-center justify-center text-muted-foreground">
      Snapshot data is corrupted.
    </div>
  )
}

function GameMapSnapshotPreview({
  imageUrlState,
  snapshotData,
}: {
  imageUrlState: GameMapSnapshotImageUrlState
  snapshotData: GameMapSnapshotData | null
}) {
  if (!snapshotData) {
    return <CorruptedSnapshotState />
  }

  if (!snapshotData.imageStorageId) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center text-muted-foreground">
        No map image in this version.
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 relative overflow-auto">
      {imageUrlState.status === 'ready' ? (
        <div className="relative">
          <img src={imageUrlState.url} alt="Map preview" className="max-w-full" />
          {snapshotData.pins.map((pin) => (
            <SnapshotPin key={`${pin.itemId}:${pin.x}:${pin.y}`} pin={pin} />
          ))}
        </div>
      ) : imageUrlState.status === 'loading' ? (
        <div className="flex items-center justify-center min-h-48">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex items-center justify-center min-h-48 text-muted-foreground">
          Failed to load map image.
        </div>
      )}
    </div>
  )
}

function SnapshotPin({ pin }: { pin: GameMapSnapshotData['pins'][number] }) {
  return (
    <div
      className="absolute"
      style={{
        left: `${pin.x}%`,
        top: `${pin.y}%`,
        transform: 'translate(-50%, -100%)',
        opacity: pin.visible ? 1 : 0.4,
      }}
    >
      <PinMarker
        color={normalizeSidebarItemColorOrDefault(pin.color, DEFAULT_SIDEBAR_ITEM_COLOR)}
        icon={resolvePinIcon(pin)}
      />
    </div>
  )
}
