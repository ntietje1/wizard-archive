import { Decoration } from '@tiptap/pm/view'
import type { ParsedWikiLinkFields } from 'shared/links/parsing'
import type { ResolvedLink } from 'shared/links/types'
import { createLinkDecorationState, LINK_ROLE } from './link-decoration'

export interface WikiLinkDecorationMatch {
  from: number
  to: number
  innerText: string
  parsed: ParsedWikiLinkFields
  resolved: ResolvedLink
}

interface BuildWikiLinkDecorationEntriesOptions {
  isViewerMode: boolean
  isActive: boolean
}

function appendDecoration(
  decorations: Array<Decoration>,
  from: number,
  to: number,
  attrs: Record<string, string | undefined>,
) {
  if (from >= to) return
  decorations.push(Decoration.inline(from, to, attrs))
}

export function buildWikiLinkDecorationEntries(
  { from, to, innerText, parsed, resolved }: WikiLinkDecorationMatch,
  { isViewerMode, isActive }: BuildWikiLinkDecorationEntriesOptions,
): Array<Decoration> {
  const state = createLinkDecorationState({
    type: 'wiki',
    exists: resolved.resolved,
    href: resolved.href,
    pathKind: parsed.pathKind,
    itemPath: parsed.itemPath,
    itemName: parsed.itemName,
    heading: parsed.headingPath.length > 0 ? parsed.headingPath.join('#') : null,
    color: resolved.color,
    isViewerMode,
    isActive,
  })
  const contentStart = from + 2
  const contentEnd = to - 2

  const decorations: Array<Decoration> = []
  appendDecoration(decorations, from, from + 2, {
    nodeName: 'span',
    class: 'wiki-link wiki-link-bracket wiki-link-bracket-open',
    style: state.style,
    ...state.createPartAttrs(LINK_ROLE.bracketOpen),
  })

  let visibleContentStart = contentStart
  if (parsed.displayName) {
    const pipeIndex = innerText.lastIndexOf('|')
    visibleContentStart = Math.min(contentEnd, contentStart + pipeIndex + 1)
    if (contentStart < visibleContentStart) {
      appendDecoration(decorations, contentStart, visibleContentStart, {
        nodeName: 'span',
        class: 'wiki-link wiki-link-hidden-prefix',
        style: state.style,
        ...state.createPartAttrs(LINK_ROLE.prefix, true),
      })
    }
  }

  if (visibleContentStart < contentEnd) {
    appendDecoration(decorations, visibleContentStart, contentEnd, {
      nodeName: 'span',
      class: 'wiki-link wiki-link-content',
      style: state.style,
      ...state.createPartAttrs(LINK_ROLE.content, true),
    })
  }

  appendDecoration(decorations, to - 2, to, {
    nodeName: 'span',
    class: 'wiki-link wiki-link-bracket wiki-link-bracket-close',
    style: state.style,
    ...state.createPartAttrs(LINK_ROLE.bracketClose),
  })

  return decorations
}
