import * as Y from 'yjs'
import { api } from 'convex/_generated/api'
import { Loader2 } from 'lucide-react'
import { SNAPSHOT_TYPE } from 'shared/document-snapshots/types'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import {
  DEFAULT_SIDEBAR_ITEM_COLOR,
  normalizeSidebarItemColorOrDefault,
} from 'shared/sidebar-items/color'
import { HistoryPreviewBanner } from './history-preview-banner'
import type { Id } from 'convex/_generated/dataModel'
import type { CustomBlock } from 'shared/editor-blocks/types'
import type { GameMapSnapshotData } from 'shared/game-maps/types'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { CanvasPreviewEmbedNode } from '~/features/canvas/components/canvas-preview-embed-node'
import { CanvasReadOnlyPreview } from '~/features/canvas/components/canvas-read-only-preview'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
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

function readGameMapSnapshot(data: ArrayBuffer): GameMapSnapshotData | null {
  try {
    return JSON.parse(new TextDecoder().decode(data))
  } catch (error) {
    logger.error('Failed to parse game map snapshot data:', error)
    return null
  }
}

export function HistoryPreviewViewer({
  itemId,
  entryId,
}: {
  itemId: Id<'sidebarItems'>
  entryId: Id<'editHistory'>
}) {
  const snapshotQuery = useCampaignQuery(api.documentSnapshots.queries.getSnapshotForHistoryEntry, {
    editHistoryId: entryId,
  })
  const { canEdit } = useEditorMode()

  const historyEntry = useCampaignQuery(api.editHistory.queries.getHistoryEntry, {
    editHistoryId: entryId,
  })

  const entryTime = historyEntry.data?._creationTime

  if (snapshotQuery.isLoading || historyEntry.isLoading) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (snapshotQuery.error || historyEntry.error) {
    return (
      <div className="flex flex-col h-full">
        <HistoryPreviewBanner
          itemId={itemId}
          entryId={entryId}
          entryTime={entryTime}
          canEdit={canEdit}
        />
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Failed to load history preview.</p>
        </div>
      </div>
    )
  }

  if (!snapshotQuery.data) {
    return (
      <div className="flex flex-col h-full">
        <HistoryPreviewBanner
          itemId={itemId}
          entryId={entryId}
          entryTime={entryTime}
          canEdit={canEdit}
        />
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Preview not available for this version.</p>
        </div>
      </div>
    )
  }

  const snapshot = snapshotQuery.data

  return (
    <div className="flex flex-col h-full">
      <HistoryPreviewBanner
        itemId={itemId}
        entryId={entryId}
        entryTime={entryTime}
        canEdit={canEdit}
      />
      {snapshot.snapshotType === SNAPSHOT_TYPE.yjs_state &&
        snapshot.itemType === SIDEBAR_ITEM_TYPES.notes && (
          <NoteYjsSnapshotPreview noteId={snapshot.itemId} data={snapshot.data} />
        )}
      {snapshot.snapshotType === SNAPSHOT_TYPE.yjs_state &&
        snapshot.itemType === SIDEBAR_ITEM_TYPES.canvases && (
          <CanvasSnapshotPreview canvasId={snapshot.itemId} data={snapshot.data} />
        )}
      {snapshot.snapshotType === SNAPSHOT_TYPE.game_map && (
        <GameMapSnapshotPreview data={snapshot.data} />
      )}
      {snapshot.snapshotType !== SNAPSHOT_TYPE.yjs_state &&
        snapshot.snapshotType !== SNAPSHOT_TYPE.game_map && (
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Preview not available for this snapshot type.
            </p>
          </div>
        )}
    </div>
  )
}

function NoteYjsSnapshotPreview({
  noteId,
  data,
}: {
  noteId: Id<'sidebarItems'>
  data: ArrayBuffer
}) {
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

function CanvasSnapshotPreview({
  canvasId,
  data,
}: {
  canvasId: Id<'sidebarItems'>
  data: ArrayBuffer
}) {
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

function GameMapSnapshotPreview({ data }: { data: ArrayBuffer }) {
  const snapshotData = readGameMapSnapshot(data)

  const imageUrl = useAuthQuery(
    api.storage.queries.getDownloadUrl,
    snapshotData?.imageStorageId
      ? { storageId: snapshotData.imageStorageId as Id<'_storage'> }
      : 'skip',
  )

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
      {imageUrl.data ? (
        <div className="relative">
          <img src={imageUrl.data} alt="Map preview" className="max-w-full" />
          {snapshotData.pins.map((pin) => (
            <SnapshotPin key={`${pin.itemId}:${pin.x}:${pin.y}`} pin={pin} />
          ))}
        </div>
      ) : imageUrl.isLoading ? (
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
