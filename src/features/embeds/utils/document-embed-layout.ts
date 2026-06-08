import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import type { EmbedTarget } from 'shared/embeds/embedTargets'
import type { AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'
import {
  getIntrinsicAspectRatio,
  inferEmbedMediaKindFromContentType,
  inferEmbedMediaKindFromUrl,
} from './embed-media'

export const DOCUMENT_EMBED_ASPECT_RATIO_WIDTH = 612
export const DOCUMENT_EMBED_ASPECT_RATIO_HEIGHT = 792
const DOCUMENT_EMBED_ASPECT_RATIO = getIntrinsicAspectRatio(
  DOCUMENT_EMBED_ASPECT_RATIO_WIDTH,
  DOCUMENT_EMBED_ASPECT_RATIO_HEIGHT,
)!

export function getDocumentEmbedAspectRatioForTarget(target: EmbedTarget) {
  return target.kind === 'externalUrl' && inferEmbedMediaKindFromUrl(target.url) === 'pdf'
    ? DOCUMENT_EMBED_ASPECT_RATIO
    : null
}

function getDocumentEmbedAspectRatioForSidebarItem(item: AnySidebarItemWithContent | undefined) {
  if (!item) return null
  if (item.type === SIDEBAR_ITEM_TYPES.notes) return DOCUMENT_EMBED_ASPECT_RATIO
  if (item.type === SIDEBAR_ITEM_TYPES.canvases) return DOCUMENT_EMBED_ASPECT_RATIO
  if (
    item.type === SIDEBAR_ITEM_TYPES.files &&
    inferEmbedMediaKindFromContentType(item.contentType) === 'pdf'
  ) {
    return DOCUMENT_EMBED_ASPECT_RATIO
  }

  return null
}

export function getDefaultDocumentEmbedAspectRatio({
  target,
  item,
}: {
  target: EmbedTarget
  item?: AnySidebarItemWithContent
}) {
  return (
    getDocumentEmbedAspectRatioForTarget(target) ?? getDocumentEmbedAspectRatioForSidebarItem(item)
  )
}
