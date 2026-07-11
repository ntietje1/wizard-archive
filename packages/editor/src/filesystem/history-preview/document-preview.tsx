import * as Y from 'yjs'
import { useRef } from 'react'
import { Loader2 } from 'lucide-react'
import {
  DEFAULT_SIDEBAR_ITEM_COLOR,
  normalizeSidebarItemColorOrDefault,
} from '../../workspace/items/appearance'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import type { GameMapSnapshotData } from '../../game-maps/document-contract'
import type { HistoryPreviewImageUrlState, HistoryPreviewSnapshot } from '../history-types'
import { CanvasReadOnlyPreview } from '../../canvas/preview/read-only-preview'
import { StaticNoteContent } from '../../notes/static-content'
import {
  standaloneEmbeddedNoteContentSource,
  standaloneNoteEmbedTargetSource,
  standaloneNoteLinkNavigationSource,
  standaloneNoteLinkResolutionSource,
  standaloneNoteValueReferences,
  standaloneNoteValueStateSource,
} from '../../notes/standalone-note-content-sources'
import { ScrollArea } from '@wizard-archive/ui/shadcn/components/scroll-area'
import { PinMarker } from '../../game-maps/viewer/pin-marker'
import { resolvePinIcon } from '../../game-maps/viewer/pin-utils'
import { readNoteYDocContent } from '../../notes/imported-text'
import type { PreviewFallbackReason } from '../../previews/fallback-policy'
import { getPreviewFallbackCopy } from '../../previews/fallback-policy'
import type { CanvasDocumentEdge, CanvasDocumentNode } from '../../canvas/document-contract'
import { readCanvasDocumentContent } from '../../canvas/document-contract'
import type { NoteBlock } from '../../notes/document/model'

type SnapshotReadResult<T> = { status: 'ready'; value: T } | { status: 'corrupted' }
type SnapshotReadCache<T> = {
  data: ArrayBuffer
  result: SnapshotReadResult<T>
}

function readNoteYjsSnapshot(data: ArrayBuffer): SnapshotReadResult<Array<NoteBlock>> {
  const doc = new Y.Doc()
  try {
    Y.applyUpdate(doc, new Uint8Array(data))
    return { status: 'ready', value: readNoteYDocContent(doc) }
  } catch (error) {
    console.error('Failed to parse note snapshot:', error)
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
    return { status: 'ready', value: readCanvasDocumentContent(doc) }
  } catch (error) {
    console.error('Failed to parse canvas snapshot:', error)
    return { status: 'corrupted' }
  } finally {
    doc.destroy()
  }
}

function useSnapshotReadResult<T>(
  data: ArrayBuffer,
  readSnapshot: (data: ArrayBuffer) => SnapshotReadResult<T>,
): SnapshotReadResult<T> {
  const cacheRef = useRef<SnapshotReadCache<T> | null>(null)

  if (cacheRef.current?.data !== data) {
    cacheRef.current = { data, result: readSnapshot(data) }
  }

  return cacheRef.current.result
}

export function HistoryDocumentPreview({ snapshot }: { snapshot: HistoryPreviewSnapshot }) {
  if (snapshot.kind === 'note-yjs') {
    return <NoteYjsSnapshotPreview noteId={snapshot.noteId} data={snapshot.data} />
  }
  if (snapshot.kind === 'canvas-yjs') {
    return <CanvasSnapshotPreview canvasId={snapshot.canvasId} data={snapshot.data} />
  }
  if (snapshot.kind === 'game-map') {
    return (
      <GameMapSnapshotPreview
        snapshotData={snapshot.snapshotData}
        imageUrlState={snapshot.imageUrlState}
      />
    )
  }
  if (snapshot.kind === 'unsupported') {
    return <HistoryPreviewFallback reason="unsupportedSnapshot" />
  }
  return assertNeverHistoryPreviewSnapshot(snapshot)
}

function NoteYjsSnapshotPreview({ data, noteId }: { data: ArrayBuffer; noteId: SidebarItemId }) {
  const result = useSnapshotReadResult(data, readNoteYjsSnapshot)

  if (result.status === 'corrupted') {
    return <CorruptedSnapshotState />
  }

  return (
    <ScrollArea className="flex-1 min-h-0">
      <StaticNoteContent
        noteId={noteId}
        content={result.value}
        className="mx-auto w-full max-w-3xl mt-2"
        embeddedNoteContentSource={standaloneEmbeddedNoteContentSource}
        embedTargetSource={standaloneNoteEmbedTargetSource}
        linkNavigationSource={standaloneNoteLinkNavigationSource}
        linkResolutionSource={standaloneNoteLinkResolutionSource}
        noteValueReferences={standaloneNoteValueReferences}
        noteValueStateSource={standaloneNoteValueStateSource}
      />
    </ScrollArea>
  )
}

function CanvasSnapshotPreview({ canvasId, data }: { canvasId: SidebarItemId; data: ArrayBuffer }) {
  const result = useSnapshotReadResult(data, readCanvasSnapshot)

  if (result.status === 'corrupted') {
    return <CorruptedSnapshotState />
  }

  return (
    <div className="flex-1 min-h-0">
      <CanvasReadOnlyPreview
        nodes={result.value.nodes}
        edges={result.value.edges}
        interactive
        sourceItemId={canvasId}
      />
    </div>
  )
}

function CorruptedSnapshotState() {
  return <HistoryPreviewFallback reason="corruptedSnapshot" />
}

function GameMapSnapshotPreview({
  imageUrlState,
  snapshotData,
}: {
  imageUrlState: HistoryPreviewImageUrlState
  snapshotData: GameMapSnapshotData
}) {
  if (!snapshotData.imageAssetId) {
    return <HistoryPreviewFallback reason="noMapImage" />
  }

  return (
    <div className="flex-1 min-h-0 relative overflow-auto">
      <GameMapImagePreview imageUrlState={imageUrlState} snapshotData={snapshotData} />
    </div>
  )
}

function GameMapImagePreview({
  imageUrlState,
  snapshotData,
}: {
  imageUrlState: HistoryPreviewImageUrlState
  snapshotData: GameMapSnapshotData
}) {
  switch (imageUrlState.status) {
    case 'ready':
      return (
        <div className="relative">
          <img src={imageUrlState.url} alt="Map preview" className="max-w-full" />
          {snapshotData.pins.map((pin) => (
            <SnapshotPin key={`${pin.itemId}:${pin.x}:${pin.y}`} pin={pin} />
          ))}
        </div>
      )
    case 'idle':
      return (
        <div className="flex items-center justify-center min-h-48">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
          <span className="sr-only">
            {getPreviewFallbackCopy({ surface: 'history', reason: 'mapImageLoading' })}
          </span>
        </div>
      )
    case 'error':
      return <HistoryPreviewFallback className="min-h-48" reason="mapImageError" />
    default:
      return assertNeverHistoryPreviewImageUrlState(imageUrlState)
  }
}

function assertNeverHistoryPreviewImageUrlState(state: never): never {
  throw new Error(`Unhandled history preview image state: ${JSON.stringify(state)}`)
}

function assertNeverHistoryPreviewSnapshot(snapshot: never): never {
  throw new Error(`Unhandled history preview snapshot: ${JSON.stringify(snapshot)}`)
}

function HistoryPreviewFallback({
  className = 'flex-1 min-h-0',
  reason,
}: {
  className?: string
  reason: PreviewFallbackReason
}) {
  return (
    <div className={`${className} flex items-center justify-center text-muted-foreground`}>
      {getPreviewFallbackCopy({ surface: 'history', reason })}
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
