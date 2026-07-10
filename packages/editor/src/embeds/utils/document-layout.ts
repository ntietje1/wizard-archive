import { RESOURCE_TYPES } from '../../workspace/items-persistence-contract'
import type { AnyItemWithContent } from '../../workspace/items'
import { inferExternalEmbedMediaKind } from '../../../../../shared/embeds/embedTargets'
import type { EmbedTarget } from '../../../../../shared/embeds/embedTargets'
import { getIntrinsicAspectRatio, inferEmbedMediaKindFromContentType } from './media'

export const DOCUMENT_EMBED_ASPECT_RATIO_WIDTH = 612
export const DOCUMENT_EMBED_ASPECT_RATIO_HEIGHT = 792
const documentEmbedAspectRatio = getIntrinsicAspectRatio(
  DOCUMENT_EMBED_ASPECT_RATIO_WIDTH,
  DOCUMENT_EMBED_ASPECT_RATIO_HEIGHT,
)
if (documentEmbedAspectRatio === null) {
  throw new Error('Invalid document embed aspect ratio constants')
}
const DOCUMENT_EMBED_ASPECT_RATIO = documentEmbedAspectRatio

export function getDocumentEmbedAspectRatioForTarget(target: EmbedTarget) {
  return target.kind === 'externalUrl' && inferExternalEmbedMediaKind(target.url) === 'pdf'
    ? DOCUMENT_EMBED_ASPECT_RATIO
    : null
}

function getDocumentEmbedAspectRatioForSidebarItem(item: AnyItemWithContent | undefined) {
  if (!item) return null
  if (item.type === RESOURCE_TYPES.notes) return DOCUMENT_EMBED_ASPECT_RATIO
  if (item.type === RESOURCE_TYPES.canvases) return DOCUMENT_EMBED_ASPECT_RATIO
  if (
    item.type === RESOURCE_TYPES.files &&
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
  item?: AnyItemWithContent
}) {
  return (
    getDocumentEmbedAspectRatioForTarget(target) ?? getDocumentEmbedAspectRatioForSidebarItem(item)
  )
}
