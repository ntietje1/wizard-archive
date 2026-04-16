import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { ParsedWikiLinkFields } from 'convex/links/linkParsers'
import type { ResolvedLink } from 'convex/links/types'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { createLinkDecorationState, LINK_ROLE } from './link-decoration'
import { overlapsSelection } from './link-extension-utils'

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

export function buildWikiLinkDecorationEntries(
  { from, to, innerText, parsed, resolved }: WikiLinkDecorationMatch,
  { isViewerMode, isActive }: BuildWikiLinkDecorationEntriesOptions,
): Array<Decoration> {
  const state = createLinkDecorationState({
    type: 'wiki',
    exists: resolved.resolved,
    href: resolved.href,
    itemPath: parsed.itemPath,
    itemName: parsed.itemName,
    heading: parsed.headingPath.length > 0 ? parsed.headingPath.join('#') : null,
    color: resolved.color,
    isViewerMode,
    isActive,
  })
  const contentStart = from + 2
  const contentEnd = to - 2

  const decorations = [
    Decoration.inline(from, from + 2, {
      nodeName: 'span',
      class: 'wiki-link-bracket wiki-link-bracket-open',
      style: state.style,
      ...state.createPartAttrs(LINK_ROLE.bracketOpen),
    }),
  ]

  let visibleContentStart = contentStart
  if (parsed.displayName) {
    const pipeIndex = innerText.lastIndexOf('|')
    visibleContentStart = Math.min(contentEnd, contentStart + pipeIndex + 1)
    if (contentStart < visibleContentStart) {
      decorations.push(
        Decoration.inline(contentStart, visibleContentStart, {
          nodeName: 'span',
          class: 'wiki-link-hidden-prefix',
          style: state.style,
          ...state.createPartAttrs(LINK_ROLE.prefix, true),
        }),
      )
    }
  }

  if (visibleContentStart < contentEnd) {
    decorations.push(
      Decoration.inline(visibleContentStart, contentEnd, {
        nodeName: 'span',
        class: 'wiki-link-content',
        style: state.style,
        ...state.createPartAttrs(LINK_ROLE.content, true),
      }),
    )
  }

  decorations.push(
    Decoration.inline(to - 2, to, {
      nodeName: 'span',
      class: 'wiki-link-bracket wiki-link-bracket-close',
      style: state.style,
      ...state.createPartAttrs(LINK_ROLE.bracketClose),
    }),
  )

  return decorations
}

export function buildWikiLinkDecorations(
  doc: ProseMirrorNode,
  matches: Array<WikiLinkDecorationMatch>,
  isViewerMode: boolean,
  selFrom: number,
  selTo: number,
): DecorationSet {
  const decorations = matches.flatMap((match) =>
    buildWikiLinkDecorationEntries(match, {
      isViewerMode,
      isActive: !isViewerMode && overlapsSelection(match.from, match.to, selFrom, selTo),
    }),
  )

  return DecorationSet.create(doc, decorations)
}
