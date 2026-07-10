import type { Decoration } from '@tiptap/pm/view'
import type { ParsedMdLinkFields } from '../../../../../shared/links/parsing'
import type { ResolvedLink } from '../../../../../shared/links/types'
import { createLinkDecorationState, LINK_ROLE } from './decoration'
import { appendLinkDecoration } from './decoration-entries'
import type { BuildLinkDecorationEntriesOptions } from './decoration-entries'

export interface MdLinkDecorationMatch {
  from: number
  to: number
  displayText: string
  target: string
  parsed: ParsedMdLinkFields & { displayText: string }
  resolved: ResolvedLink
}

export function buildMdLinkDecorationEntries(
  { from, to, displayText, target, parsed, resolved }: MdLinkDecorationMatch,
  { isViewerMode, isActive }: BuildLinkDecorationEntriesOptions,
): Array<Decoration> {
  const linkType = parsed.isExternal ? 'md-external' : 'md-internal'
  const state = createLinkDecorationState({
    type: linkType,
    resolutionStatus: resolved.status,
    href: resolved.href,
    itemId: parsed.isExternal ? null : resolved.itemId,
    itemSlug: parsed.isExternal ? null : resolved.itemSlug,
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
  appendLinkDecoration(decorations, from, openBracketEnd, {
    nodeName: 'span',
    class: 'md-link-bracket md-link-bracket-open',
    style: state.style,
    ...state.createPartAttrs(LINK_ROLE.bracketOpen),
  })
  appendLinkDecoration(decorations, openBracketEnd, displayEnd, {
    nodeName: 'span',
    class: 'md-link-display',
    style: state.style,
    ...state.createPartAttrs(LINK_ROLE.content),
  })
  appendLinkDecoration(decorations, displayEnd, middleBracketEnd, {
    nodeName: 'span',
    class: 'md-link-bracket md-link-bracket-middle',
    style: state.style,
    ...state.createPartAttrs(LINK_ROLE.bracketMiddle),
  })
  appendLinkDecoration(decorations, middleBracketEnd, targetEnd, {
    nodeName: 'span',
    class: 'md-link-target',
    style: state.style,
    ...state.createPartAttrs(LINK_ROLE.target),
  })
  appendLinkDecoration(decorations, targetEnd, closingBracketPos, {
    nodeName: 'span',
    class: 'md-link-bracket md-link-bracket-close',
    style: state.style,
    ...state.createPartAttrs(LINK_ROLE.bracketClose),
  })

  return decorations
}
