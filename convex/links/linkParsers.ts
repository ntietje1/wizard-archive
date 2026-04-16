import type { ParsedLinkData } from './types'

export const WIKI_LINK_REGEX = /\[\[((?:(?!\[\[)(?!\]\][^\]]).)+?)\]\](?=$|[^\]])/g

export const MD_LINK_REGEX = /(?<!!)\[([^\]]+)\]\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g

export function isExternalUrl(str: string): boolean {
  const lower = str.toLowerCase()
  return (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:') ||
    lower.startsWith('ftp://')
  )
}

export interface ParsedWikiLinkFields {
  itemPath: Array<string>
  itemName: string
  headingPath: Array<string>
  displayName: string | null
}

function parsePathAndHeading(text: string): Omit<ParsedWikiLinkFields, 'displayName'> {
  const parts = text.split('#')
  const itemPathStr = parts[0].trim()
  const headingPath = parts
    .slice(1)
    .map((heading) => heading.trim())
    .filter(Boolean)
  const itemPath = itemPathStr
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
  const itemName = itemPath[itemPath.length - 1] || ''

  return { itemPath, itemName, headingPath }
}

export function parseWikiLinkText(text: string): ParsedWikiLinkFields {
  const lastPipeIndex = text.lastIndexOf('|')
  let displayName: string | null = null
  let remainingText = text

  if (lastPipeIndex !== -1) {
    displayName = text.slice(lastPipeIndex + 1).trim() || null
    remainingText = text.slice(0, lastPipeIndex)
  }

  const { itemPath, itemName, headingPath } = parsePathAndHeading(remainingText)

  return { itemPath, itemName, headingPath, displayName }
}

export interface ParsedMdLinkFields {
  target: string
  isExternal: boolean
  itemPath: Array<string>
  itemName: string
  headingPath: Array<string>
}

export function parseMdLinkTarget(target: string): ParsedMdLinkFields {
  if (isExternalUrl(target)) {
    return {
      target,
      isExternal: true,
      itemPath: [],
      itemName: '',
      headingPath: [],
    }
  }

  const { itemPath, itemName, headingPath } = parsePathAndHeading(target)

  return { target, isExternal: false, itemPath, itemName, headingPath }
}

export function extractWikiLinksFromText(text: string): Array<ParsedLinkData> {
  const links: Array<ParsedLinkData> = []
  const regex = new RegExp(WIKI_LINK_REGEX.source, 'g')

  let match
  while ((match = regex.exec(text)) !== null) {
    const innerText = match[1]
    const parsed = parseWikiLinkText(innerText)
    links.push({
      syntax: 'wiki',
      itemPath: parsed.itemPath,
      itemName: parsed.itemName,
      headingPath: parsed.headingPath,
      displayName: parsed.displayName,
      rawTarget: innerText,
      isExternal: false,
    })
  }

  return links
}

export function extractMdLinksFromText(text: string): Array<ParsedLinkData> {
  const links: Array<ParsedLinkData> = []
  const regex = new RegExp(MD_LINK_REGEX.source, 'g')

  let match
  while ((match = regex.exec(text)) !== null) {
    const displayText = match[1]
    const target = match[2]
    const parsed = parseMdLinkTarget(target)
    links.push({
      syntax: 'md',
      itemPath: parsed.itemPath,
      itemName: parsed.itemName,
      headingPath: parsed.headingPath,
      displayName: displayText,
      rawTarget: target,
      isExternal: parsed.isExternal,
    })
  }

  return links
}
