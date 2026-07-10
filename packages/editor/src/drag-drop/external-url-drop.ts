import { deriveExternalEmbedName, parseEmbedTarget } from '../../../../shared/embeds/embedTargets'
import type { EmbedTarget } from '../../../../shared/embeds/embedTargets'
import { isInternalNativeDrag } from '@wizard-archive/ui/drag-drop/internal-native-drag'
import type { DropRejectionReason } from './rejections'

type ExternalUrlDropClassification =
  | { kind: 'ignored' }
  | { kind: 'candidate' }
  | { kind: 'accepted'; target: EmbedTarget }
  | { kind: 'rejected'; reason: DropRejectionReason }

export function classifyExternalUrlDrop(
  dataTransfer: DataTransfer | null | undefined,
  { readData = false }: { readData?: boolean } = {},
): ExternalUrlDropClassification {
  if (!dataTransfer || isInternalNativeDrag(dataTransfer)) return { kind: 'ignored' }
  const types = Array.from(dataTransfer.types)
  if (
    !types.includes('text/uri-list') &&
    !types.includes('text/html') &&
    !types.includes('text/plain')
  ) {
    return { kind: 'ignored' }
  }
  if (!readData) return { kind: 'candidate' }

  const url = getExternalDropUrl(dataTransfer).trim()
  if (!url) return { kind: 'rejected', reason: 'missing_data' }

  const target = parseEmbedTarget({
    kind: 'externalUrl',
    url,
    name: deriveExternalEmbedName(url),
  })
  return target ? { kind: 'accepted', target } : { kind: 'rejected', reason: 'unsupported_target' }
}

function getExternalDropUrl(dataTransfer: DataTransfer): string {
  const uriList = getFirstUriListUrl(dataTransfer.getData('text/uri-list'))
  if (uriList) return uriList

  const htmlUrl = getFirstHtmlUrl(dataTransfer.getData('text/html'))
  if (htmlUrl) return htmlUrl

  return dataTransfer.getData('text/plain')
}

function getFirstUriListUrl(rawUriList: string) {
  return (
    rawUriList
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0 && !line.startsWith('#')) ?? ''
  )
}

function getFirstHtmlUrl(rawHtml: string): string {
  if (!rawHtml.trim()) return ''

  const document = new DOMParser().parseFromString(rawHtml, 'text/html')
  return (
    document.querySelector('img[src]')?.getAttribute('src') ??
    document.querySelector('a[href]')?.getAttribute('href') ??
    ''
  )
}
