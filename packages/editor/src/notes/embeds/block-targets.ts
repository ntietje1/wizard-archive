import {
  deriveExternalEmbedName,
  normalizeEmbedTarget,
} from '../../../../../shared/embeds/embedTargets'
import type { Props } from '@blocknote/core'
import type { EmbedTarget } from '../../../../../shared/embeds/embedTargets'
import type { embedBlockConfig } from '../document/schema-factory'

export type NoteEmbedBlockProps = Partial<Props<typeof embedBlockConfig.propSchema>>

export const DEFAULT_NOTE_EMBED_PREVIEW_WIDTH = 480

export function embedTargetFromBlockProps(props: NoteEmbedBlockProps): EmbedTarget {
  const legacyProps = props as Record<string, unknown> & {
    sidebarItemId?: unknown
    targetKind?: unknown
  }
  if (props.targetKind === 'resource') {
    return normalizeEmbedTarget({
      kind: 'resource',
      resourceId: props.resourceId,
    })
  }
  if (legacyProps.targetKind === 'sidebarItem') {
    return normalizeEmbedTarget({
      kind: 'sidebarItem',
      sidebarItemId: legacyProps.sidebarItemId,
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
    case 'resource':
      return {
        targetKind: 'resource' as const,
        resourceId: target.resourceId,
      }
    case 'externalUrl':
      return {
        targetKind: 'externalUrl' as const,
        url: target.url,
        ...(target.name ? { name: target.name } : {}),
      }
    default: {
      const exhaustive: never = target
      throw new Error(`Unsupported embed target kind: ${JSON.stringify(exhaustive)}`)
    }
  }
}

function normalizeExternalName(name: string | null | undefined, url: string | undefined) {
  const trimmed = typeof name === 'string' ? name.trim() : ''
  if (trimmed) return trimmed
  return url ? deriveExternalEmbedName(url) : null
}
