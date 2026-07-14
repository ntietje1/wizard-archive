import type { Decoration } from '@tiptap/pm/view'
import type { ParsedWikiLinkFields } from '../../../../../shared/links/parsing'
import type { ResolvedLink } from '../../../../../shared/links/types'
import { createLinkDecorationState, LINK_ROLE } from './decoration'
import { appendLinkDecoration } from './decoration-entries'
import type { BuildLinkDecorationEntriesOptions } from './decoration-entries'

export interface WikiLinkDecorationMatch {
  from: number
  to: number
  innerText: string
  parsed: ParsedWikiLinkFields
  resolved: ResolvedLink
}

export function buildWikiLinkDecorationEntries(
  { from, to, innerText, parsed, resolved }: WikiLinkDecorationMatch,
  { isViewerMode, isActive }: BuildLinkDecorationEntriesOptions,
): Array<Decoration> {
  const state = createLinkDecorationState({
    type: 'wiki',
    resolutionStatus: resolved.status,
    href: resolved.href,
    itemId: resolved.itemId,
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
  appendLinkDecoration(decorations, from, from + 2, {
    nodeName: 'span',
    class: 'wiki-link wiki-link-bracket wiki-link-bracket-open',
    style: state.style,
    ...state.createPartAttrs(LINK_ROLE.bracketOpen),
  })

  let visibleContentStart = contentStart
  if (parsed.displayName !== null) {
    const pipeIndex = innerText.lastIndexOf('|')
    visibleContentStart = Math.min(contentEnd, contentStart + pipeIndex + 1)
    if (contentStart < visibleContentStart) {
      appendLinkDecoration(decorations, contentStart, visibleContentStart, {
        nodeName: 'span',
        class: 'wiki-link wiki-link-hidden-prefix',
        style: state.style,
        ...state.createPartAttrs(LINK_ROLE.prefix),
      })
    }
  }

  if (visibleContentStart < contentEnd) {
    appendLinkDecoration(decorations, visibleContentStart, contentEnd, {
      nodeName: 'span',
      class: 'wiki-link wiki-link-content',
      style: state.style,
      ...state.createPartAttrs(LINK_ROLE.content),
    })
  }

  appendLinkDecoration(decorations, to - 2, to, {
    nodeName: 'span',
    class: 'wiki-link wiki-link-bracket wiki-link-bracket-close',
    style: state.style,
    ...state.createPartAttrs(LINK_ROLE.bracketClose),
  })

  return decorations
}
