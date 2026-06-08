import { deriveExternalEmbedName, normalizeEmbedTarget } from 'shared/embeds/embedTargets'
import type { EmbedTarget } from 'shared/embeds/embedTargets'

export type NoteEmbedBlockProps = {
  targetKind?: 'empty' | 'sidebarItem' | 'externalUrl'
  sidebarItemId?: string
  url?: string
  name?: string | null
  backgroundColor?: string
  textAlignment?: 'left' | 'center' | 'right' | 'justify'
  previewWidth?: number
  previewAspectRatio?: number
}

export const DEFAULT_NOTE_EMBED_PREVIEW_WIDTH = 480

export function embedTargetFromBlockProps(props: NoteEmbedBlockProps): EmbedTarget {
  if (props.targetKind === 'sidebarItem') {
    return normalizeEmbedTarget({
      kind: 'sidebarItem',
      sidebarItemId: props.sidebarItemId,
    })
  }

  if (props.targetKind === 'externalUrl') {
    return normalizeEmbedTarget({
      kind: 'externalUrl',
      url: props.url,
      name: normalizeExternalName(props.name, props.url),
    })
  }

  return { kind: 'empty' }
}

export function blockPropsFromEmbedTarget(target: EmbedTarget) {
  switch (target.kind) {
    case 'empty':
      return {
        targetKind: 'empty' as const,
      }
    case 'sidebarItem':
      return {
        targetKind: 'sidebarItem' as const,
        sidebarItemId: target.sidebarItemId,
      }
    case 'externalUrl':
      return {
        targetKind: 'externalUrl' as const,
        url: target.url,
        ...(target.name ? { name: target.name } : {}),
      }
  }
}

export function blockPropsFromEmbedTargetWithDefaultPreview(target: EmbedTarget) {
  if (target.kind === 'empty') return blockPropsFromEmbedTarget(target)

  return {
    previewWidth: DEFAULT_NOTE_EMBED_PREVIEW_WIDTH,
    ...blockPropsFromEmbedTarget(target),
  }
}

function normalizeExternalName(name: string | null | undefined, url: string | undefined) {
  const trimmed = typeof name === 'string' ? name.trim() : ''
  if (trimmed) return trimmed
  return url ? deriveExternalEmbedName(url) : null
}
