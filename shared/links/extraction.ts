import { MD_LINK_REGEX, WIKI_LINK_REGEX, parseMdLinkTarget, parseWikiLinkText } from './parsing'
import type { ParsedLinkData } from './types'

const GLOBAL_WIKI_LINK_REGEX = new RegExp(WIKI_LINK_REGEX.source, 'g')
const GLOBAL_MD_LINK_REGEX = new RegExp(MD_LINK_REGEX.source, 'g')

export function extractLinksFromText(text: string): Array<ParsedLinkData> {
  const matches: Array<{ index: number; link: ParsedLinkData }> = []

  for (const wikiMatch of text.matchAll(GLOBAL_WIKI_LINK_REGEX)) {
    const innerText = wikiMatch[1]
    const parsed = parseWikiLinkText(innerText)
    matches.push({
      index: wikiMatch.index,
      link: {
        syntax: 'wiki',
        pathKind: parsed.pathKind,
        itemPath: parsed.itemPath,
        itemName: parsed.itemName,
        headingPath: parsed.headingPath,
        displayName: parsed.displayName,
        rawTarget: innerText,
        isExternal: false,
      },
    })
  }

  for (const mdMatch of text.matchAll(GLOBAL_MD_LINK_REGEX)) {
    const displayText = mdMatch[1]
    const target = mdMatch[2]
    const parsed = parseMdLinkTarget(target)
    matches.push({
      index: mdMatch.index,
      link: {
        syntax: 'md',
        pathKind: parsed.pathKind,
        itemPath: parsed.itemPath,
        itemName: parsed.itemName,
        headingPath: parsed.headingPath,
        displayName: displayText,
        rawTarget: target,
        isExternal: parsed.isExternal,
      },
    })
  }

  return matches.sort((a, b) => a.index - b.index).map((match) => match.link)
}

export function getLinkQuery(link: ParsedLinkData): string {
  if (link.isExternal) return link.rawTarget

  const itemPath = link.itemPath.join('/')
  if (link.headingPath.length === 0) return itemPath
  return `${itemPath}#${link.headingPath.join('#')}`
}
