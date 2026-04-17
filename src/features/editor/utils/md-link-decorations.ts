import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { ParsedMdLinkFields } from 'convex/links/linkParsers'
import type { ResolvedLink } from 'convex/links/types'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { createLinkDecorationState, LINK_ROLE } from './link-decoration'
import { overlapsSelection } from './link-extension-utils'

export interface MdLinkDecorationMatch {
  from: number
  to: number
  displayText: string
  target: string
  parsed: ParsedMdLinkFields & { displayText: string }
  resolved: ResolvedLink
}

interface BuildMdLinkDecorationEntriesOptions {
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

export function buildMdLinkDecorationEntries(
  { from, to, displayText, target, parsed, resolved }: MdLinkDecorationMatch,
  { isViewerMode, isActive }: BuildMdLinkDecorationEntriesOptions,
): Array<Decoration> {
  const linkType = parsed.isExternal ? 'md-external' : 'md-internal'
  const state = createLinkDecorationState({
    type: linkType,
    exists: parsed.isExternal || resolved.resolved,
    href: resolved.href,
    pathKind: parsed.isExternal ? null : parsed.pathKind,
    itemPath: parsed.isExternal ? null : parsed.itemPath,
    itemName: parsed.isExternal ? null : parsed.itemName,
    heading:
      !parsed.isExternal && parsed.headingPath.length > 0 ? parsed.headingPath.join('#') : null,
    color: resolved.color,
    isViewerMode,
    isActive,
  })
  const openBracketEnd = Math.min(to, from + 1)
  const displayEnd = Math.min(to, openBracketEnd + displayText.length)
  const middleBracketEnd = Math.min(to, displayEnd + 2)
  const rawTargetEnd = middleBracketEnd + target.length
  const closingBracketPos = Math.min(to, rawTargetEnd + 1)
  const targetEnd = Math.min(rawTargetEnd, Math.max(middleBracketEnd, closingBracketPos - 1))

  const decorations: Array<Decoration> = []
  appendDecoration(decorations, from, openBracketEnd, {
    nodeName: 'span',
    class: 'md-link-bracket md-link-bracket-open',
    style: state.style,
    ...state.createPartAttrs(LINK_ROLE.bracketOpen),
  })
  appendDecoration(decorations, openBracketEnd, displayEnd, {
    nodeName: 'span',
    class: 'md-link-display',
    style: state.style,
    ...state.createPartAttrs(LINK_ROLE.content, true),
  })
  appendDecoration(decorations, displayEnd, middleBracketEnd, {
    nodeName: 'span',
    class: 'md-link-bracket md-link-bracket-middle',
    style: state.style,
    ...state.createPartAttrs(LINK_ROLE.bracketMiddle),
  })
  appendDecoration(decorations, middleBracketEnd, targetEnd, {
    nodeName: 'span',
    class: 'md-link-target',
    style: state.style,
    ...state.createPartAttrs(LINK_ROLE.target),
  })
  appendDecoration(decorations, targetEnd, closingBracketPos, {
    nodeName: 'span',
    class: 'md-link-bracket md-link-bracket-close',
    style: state.style,
    ...state.createPartAttrs(LINK_ROLE.bracketClose),
  })

  return decorations
}

export function buildMdLinkDecorations(
  doc: ProseMirrorNode,
  matches: Array<MdLinkDecorationMatch>,
  isViewerMode: boolean,
  selFrom: number,
  selTo: number,
): DecorationSet {
  const decorations = matches.flatMap((match) =>
    buildMdLinkDecorationEntries(match, {
      isViewerMode,
      isActive: !isViewerMode && overlapsSelection(match.from, match.to, selFrom, selTo),
    }),
  )

  return DecorationSet.create(doc, decorations)
}
