import { useMemo } from 'react'
import * as Y from 'yjs'
import { BlockNoteEditor } from '@blocknote/core'
import { yDocToBlocks } from '@blocknote/core/yjs'
import { Background, ReactFlow, ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { api } from 'convex/_generated/api'
import { Loader2 } from 'lucide-react'
import { SNAPSHOT_TYPE } from 'convex/documentSnapshots/schema'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { editorSchema } from 'convex/notes/editorSpecs'
import { HistoryPreviewBanner } from './history-preview-banner'
import type { Id } from 'convex/_generated/dataModel'
import type { CustomBlock } from 'convex/notes/editorSpecs'
import type { Edge, Node } from '@xyflow/react'
import type { GameMapSnapshotData } from 'convex/gameMaps/types'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { canvasNodeTypes } from '~/features/canvas/components/nodes/canvas-node-registry'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { NoteContent } from '~/features/editor/components/note-content'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import { PinMarker } from '~/features/editor/components/viewer/map/pin-marker'
import { resolvePinColor, resolvePinIcon } from '~/features/editor/components/viewer/map/pin-utils'
import { logger } from '~/shared/utils/logger'

export function HistoryPreviewViewer({ entryId }: { entryId: Id<'editHistory'> }) {
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
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (snapshotQuery.error || historyEntry.error) {
    return (
      <div className="flex flex-col h-full">
        <HistoryPreviewBanner entryId={entryId} entryTime={entryTime} canEdit={canEdit} />
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Failed to load history preview.</p>
        </div>
      </div>
    )
  }

  if (!snapshotQuery.data) {
    return (
      <div className="flex flex-col h-full">
        <HistoryPreviewBanner entryId={entryId} entryTime={entryTime} canEdit={canEdit} />
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Preview not available for this version.</p>
        </div>
      </div>
    )
  }

  const snapshot = snapshotQuery.data

  return (
    <div className="flex flex-col h-full">
      <HistoryPreviewBanner entryId={entryId} entryTime={entryTime} canEdit={canEdit} />
      {snapshot.snapshotType === SNAPSHOT_TYPE.yjs_state &&
        snapshot.itemType === SIDEBAR_ITEM_TYPES.notes && (
          <NoteYjsSnapshotPreview data={snapshot.data} />
        )}
      {snapshot.snapshotType === SNAPSHOT_TYPE.yjs_state &&
        snapshot.itemType === SIDEBAR_ITEM_TYPES.canvases && (
          <CanvasSnapshotPreview data={snapshot.data} />
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

function NoteYjsSnapshotPreview({ data }: { data: ArrayBuffer }) {
  const blocks = useMemo(() => {
    const doc = new Y.Doc()
    try {
      Y.applyUpdate(doc, new Uint8Array(data))
      const editor = BlockNoteEditor.create({
        schema: editorSchema,
        _headless: true,
      })
      try {
        return yDocToBlocks(editor, doc, 'document') as Array<CustomBlock>
      } finally {
        editor._tiptapEditor.destroy()
      }
    } catch (error) {
      logger.error('Failed to parse note snapshot:', error)
      return [] as Array<CustomBlock>
    } finally {
      doc.destroy()
    }
  }, [data])

  return (
    <ScrollArea className="flex-1 min-h-0">
      <NoteContent content={blocks} editable={false} className="mx-auto w-full max-w-3xl mt-2" />
    </ScrollArea>
  )
}

function CanvasSnapshotPreview({ data }: { data: ArrayBuffer }) {
  const { nodes, edges } = useMemo(() => {
    const doc = new Y.Doc()
    try {
      Y.applyUpdate(doc, new Uint8Array(data))

      const nodesMap = doc.getMap<Node>('nodes')
      const edgesMap = doc.getMap<Edge>('edges')

      const parsedNodes = Array.from(nodesMap.values())
      const parsedEdges = Array.from(edgesMap.values())

      return { nodes: parsedNodes, edges: parsedEdges }
    } catch (error) {
      logger.error('Failed to parse canvas snapshot:', error)
      return { nodes: [] as Array<Node>, edges: [] as Array<Edge> }
    } finally {
      doc.destroy()
    }
  }, [data])

  return (
    <div className="flex-1 min-h-0">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={canvasNodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
          zoomOnScroll
          fitView
        >
          <Background />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}

function GameMapSnapshotPreview({ data }: { data: ArrayBuffer }) {
  const snapshotData = useMemo<GameMapSnapshotData | null>(() => {
    try {
      return JSON.parse(new TextDecoder().decode(data))
    } catch (error) {
      logger.error('Failed to parse game map snapshot data:', error)
      return null
    }
  }, [data])

  const imageUrl = useAuthQuery(
    api.storage.queries.getDownloadUrl,
    snapshotData?.imageStorageId
      ? { storageId: snapshotData.imageStorageId as Id<'_storage'> }
      : 'skip',
  )

  if (!snapshotData) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center text-muted-foreground">
        Snapshot data is corrupted.
      </div>
    )
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
          {snapshotData.pins.map((pin, i) => (
            <SnapshotPin key={i} pin={pin} />
          ))}
        </div>
      ) : imageUrl.isLoading ? (
        <div className="flex items-center justify-center min-h-48">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
      <PinMarker color={resolvePinColor(pin)} icon={resolvePinIcon(pin)} />
    </div>
  )
}
