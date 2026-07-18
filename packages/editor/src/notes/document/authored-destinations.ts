import {
  parseSerializedAuthoredDestination,
  remapAuthoredDestination,
  serializeAuthoredDestination,
} from '../../resources/authored-destination'
import type { AuthoredDestinationOccurrence } from '../../resources/authored-destination'
import type {
  AuthoredDestination,
  CanonicalTarget,
} from '../../resources/authored-destination-contract'
import type { CanonicalTargetMapEntry } from '../../resources/content-copy-contract'
import type { InlineContent, NoteBlock, TableContent } from './model'

type RemapMode = 'same_campaign_copy' | 'same_campaign_update' | 'new_campaign_clone'
type RemapResult<T> =
  | Readonly<{ status: 'completed'; value: T }>
  | Readonly<{ status: 'unmapped'; target: CanonicalTarget }>

export type NoteAuthoredDestinationRemapResult =
  | Readonly<{ status: 'completed'; blocks: Array<NoteBlock> }>
  | Readonly<{ status: 'unmapped'; target: CanonicalTarget }>

export function noteAuthoredDestinations(
  blocks: ReadonlyArray<NoteBlock>,
): ReadonlyArray<AuthoredDestination> {
  return noteAuthoredDestinationOccurrences(blocks).map((occurrence) => occurrence.destination)
}

export function noteAuthoredDestinationOccurrences(
  blocks: ReadonlyArray<NoteBlock>,
): ReadonlyArray<AuthoredDestinationOccurrence> {
  const occurrences: Array<AuthoredDestinationOccurrence> = []
  for (const block of blocks) collectBlockDestinations(block, occurrences)
  return occurrences
}

export function remapNoteAuthoredDestinations(
  blocks: ReadonlyArray<NoteBlock>,
  targetMap: ReadonlyArray<CanonicalTargetMapEntry>,
  mode: RemapMode,
): NoteAuthoredDestinationRemapResult {
  const remapped: Array<NoteBlock> = []
  for (const block of blocks) {
    const result = remapBlockDestinations(block, targetMap, mode)
    if (result.status === 'unmapped') return result
    remapped.push(result.block)
  }
  return { status: 'completed', blocks: remapped }
}

function collectBlockDestinations(
  block: NoteBlock,
  occurrences: Array<AuthoredDestinationOccurrence>,
): void {
  const destinations: Array<AuthoredDestination> = []
  if (block.type === 'embed') {
    destinations.push(parseDestination(block.props.destination))
  } else {
    collectInlineDestinations(block.content, destinations)
  }
  for (const destination of destinations) {
    occurrences.push({ source: { kind: 'noteBlock', blockId: block.id }, destination })
  }
  for (const child of block.children ?? []) collectBlockDestinations(child, occurrences)
}

function collectInlineDestinations(
  content: Exclude<NoteBlock, { type: 'embed' }>['content'],
  destinations: Array<AuthoredDestination>,
): void {
  if (Array.isArray(content)) {
    for (const inline of content) {
      if (inline.type === 'resourceLink') {
        destinations.push(parseDestination(inline.props.destination))
      }
    }
    return
  }
  content?.rows.forEach((row) =>
    row.cells.forEach((cell) => collectInlineDestinations(cell.content, destinations)),
  )
}

function remapBlockDestinations(
  block: NoteBlock,
  targetMap: ReadonlyArray<CanonicalTargetMapEntry>,
  mode: RemapMode,
):
  | Readonly<{ status: 'completed'; block: NoteBlock }>
  | Readonly<{ status: 'unmapped'; target: CanonicalTarget }> {
  const props =
    block.type === 'embed'
      ? remapSerializedDestination(block.props.destination, targetMap, mode)
      : null
  if (props?.status === 'unmapped') return props
  const content = block.type === 'embed' ? null : remapInlineContent(block.content, targetMap, mode)
  if (content?.status === 'unmapped') return content
  const children = remapNoteAuthoredDestinations(block.children ?? [], targetMap, mode)
  if (children.status === 'unmapped') return children
  return {
    status: 'completed',
    block: {
      ...block,
      ...(props ? { props: { ...block.props, destination: props.destination } } : {}),
      ...(content ? { content: content.value } : {}),
      ...(block.children ? { children: [...children.blocks] } : {}),
    } as NoteBlock,
  }
}

function remapInlineContent(
  content: Exclude<NoteBlock, { type: 'embed' }>['content'],
  targetMap: ReadonlyArray<CanonicalTargetMapEntry>,
  mode: RemapMode,
): RemapResult<InlineContent | TableContent> | null {
  if (!content) return null
  return Array.isArray(content)
    ? remapInlineItems(content, targetMap, mode)
    : remapTableContent(content, targetMap, mode)
}

function remapInlineItems(
  content: InlineContent,
  targetMap: ReadonlyArray<CanonicalTargetMapEntry>,
  mode: RemapMode,
): RemapResult<InlineContent> {
  const remapped: InlineContent = []
  for (const inline of content) {
    if (inline.type !== 'resourceLink') {
      remapped.push(inline)
      continue
    }
    const destination = remapSerializedDestination(inline.props.destination, targetMap, mode)
    if (destination.status === 'unmapped') return destination
    remapped.push({
      ...inline,
      props: { ...inline.props, destination: destination.destination },
    })
  }
  return { status: 'completed', value: remapped }
}

function remapTableContent(
  content: TableContent,
  targetMap: ReadonlyArray<CanonicalTargetMapEntry>,
  mode: RemapMode,
): RemapResult<TableContent> {
  const rows = []
  for (const row of content.rows) {
    const cells = []
    for (const cell of row.cells) {
      const remapped = remapInlineItems(cell.content, targetMap, mode)
      if (remapped.status === 'unmapped') return remapped
      cells.push({ ...cell, content: remapped.value })
    }
    rows.push({ ...row, cells })
  }
  return { status: 'completed', value: { ...content, rows } }
}

function remapSerializedDestination(
  serialized: string,
  targetMap: ReadonlyArray<CanonicalTargetMapEntry>,
  mode: RemapMode,
):
  | Readonly<{ status: 'completed'; destination: string }>
  | Readonly<{ status: 'unmapped'; target: CanonicalTarget }> {
  const result = remapAuthoredDestination(parseDestination(serialized), targetMap, mode)
  return result.status === 'completed'
    ? { status: 'completed', destination: serializeAuthoredDestination(result.destination) }
    : result
}

function parseDestination(serialized: string): AuthoredDestination {
  const destination = parseSerializedAuthoredDestination(serialized)
  if (!destination) throw new TypeError('Invalid note authored destination')
  return destination
}
