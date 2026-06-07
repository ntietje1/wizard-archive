import { deriveExternalEmbedName, embedTargetSchema } from 'shared/embeds/embedTargets'
import type { EmbedTarget } from 'shared/embeds/embedTargets'
import type { Id } from 'convex/_generated/dataModel'

export function externalEmbedTargetFromUrl(rawUrl: string): EmbedTarget | null {
  const url = rawUrl.trim()
  const result = embedTargetSchema.safeParse({
    kind: 'externalUrl',
    url,
    name: deriveExternalEmbedName(url),
  })
  return result.success ? result.data : null
}

export function sidebarItemEmbedTarget(sidebarItemId: Id<'sidebarItems'>): EmbedTarget {
  return { kind: 'sidebarItem', sidebarItemId }
}

export function getSidebarItemIdFromDragData(
  data: Record<string | symbol, unknown>,
): Id<'sidebarItems'> | null {
  const id = data.sidebarItemId
  return typeof id === 'string' ? (id as Id<'sidebarItems'>) : null
}

export function getExternalUrlDropTarget(dataTransfer: DataTransfer | null): EmbedTarget | null {
  if (!dataTransfer) return null
  const uriList = getFirstUriListUrl(dataTransfer.getData('text/uri-list'))
  const plainText = dataTransfer.getData('text/plain')
  return externalEmbedTargetFromUrl(uriList || plainText)
}

function getFirstUriListUrl(rawUriList: string) {
  return (
    rawUriList
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0 && !line.startsWith('#')) ?? ''
  )
}
