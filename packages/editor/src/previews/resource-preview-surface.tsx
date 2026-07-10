import { RESOURCE_TYPES } from '../workspace/items-persistence-contract'
import type { AnyItem, AnyItemWithContent } from '../workspace/items'
import { CanvasThumbnailPreview } from '../canvas/preview/canvas-thumbnail-preview'
import { FilePreview } from '../files/viewer/file-preview'
import { FileMediaEmbedContent } from '../files/viewer/file-media-embed-content'
import { FolderListContentSimple } from '../folders/preview/folder-list-content-simple'
import { MapImagePreview } from '../game-maps/viewer/map-image-preview'
import { throwUnhandledResourceItem } from '../workspace/sidebar/utils/unhandled-resource-item'
import type { EmbedMediaLayoutReporter } from '../embeds/utils/media'
import type { ReactNode } from 'react'

const EMPTY_FOLDER_CHILDREN: Array<AnyItem> = []

type ResourcePreviewRenderInput =
  | {
      kind: 'note'
      item: Extract<AnyItemWithContent, { type: typeof RESOURCE_TYPES.notes }>
      allowInnerScroll: boolean
    }
  | {
      kind: 'canvas'
      item: Extract<AnyItemWithContent, { type: typeof RESOURCE_TYPES.canvases }>
      fillAvailableHeight: boolean
    }
  | {
      kind: 'map'
      item: Extract<AnyItemWithContent, { type: typeof RESOURCE_TYPES.gameMaps }>
      onMediaLayout?: EmbedMediaLayoutReporter
    }

export type ResourcePreviewRenderer = (input: ResourcePreviewRenderInput) => ReactNode | undefined

export function ResourcePreviewSurface({
  item,
  allowInnerScroll = true,
  fillAvailableHeight = false,
  folderChildren = EMPTY_FOLDER_CHILDREN,
  mode = 'preview',
  onMediaLayout,
  renderPreview,
}: {
  item: AnyItemWithContent
  allowInnerScroll?: boolean
  fillAvailableHeight?: boolean
  folderChildren?: Array<AnyItem>
  mode?: 'preview' | 'embed'
  onMediaLayout?: EmbedMediaLayoutReporter
  renderPreview?: ResourcePreviewRenderer
}) {
  switch (item.type) {
    case RESOURCE_TYPES.notes: {
      const customNotePreview = renderPreview?.({
        kind: 'note',
        item,
        allowInnerScroll,
      })
      if (customNotePreview !== undefined) return customNotePreview

      return <div>Note preview unavailable</div>
    }
    case RESOURCE_TYPES.folders:
      return <FolderListContentSimple items={folderChildren} />
    case RESOURCE_TYPES.gameMaps: {
      const customMapPreview = renderPreview?.({
        kind: 'map',
        item,
        onMediaLayout,
      })
      if (customMapPreview !== undefined) return customMapPreview
      return <MapImagePreview imageUrl={item.imageUrl} />
    }
    case RESOURCE_TYPES.files:
      if (mode === 'embed') {
        return (
          <FileMediaEmbedContent
            downloadUrl={item.downloadUrl}
            contentType={item.contentType}
            previewUrl={item.previewUrl}
            name={item.name}
            allowInnerScroll={allowInnerScroll}
            onMediaLayout={onMediaLayout}
          />
        )
      }

      return (
        <FilePreview
          downloadUrl={item.downloadUrl}
          contentType={item.contentType}
          fileName={item.name}
          previewUrl={item.previewUrl}
          alt={item.name}
        />
      )
    case RESOURCE_TYPES.canvases: {
      const customCanvasPreview = renderPreview?.({
        kind: 'canvas',
        item,
        fillAvailableHeight,
      })
      if (customCanvasPreview !== undefined) return customCanvasPreview
      return (
        <CanvasThumbnailPreview
          previewUrl={item.previewUrl}
          alt={item.name}
          objectFit={fillAvailableHeight ? 'cover' : 'contain'}
        />
      )
    }
    default:
      return throwUnhandledResourceItem(
        item,
        (unhandledItem) =>
          `Unsupported resource item type "${unhandledItem.type ?? 'unknown'}" for "${
            unhandledItem.id ?? 'unknown'
          }"`,
      )
  }
}
