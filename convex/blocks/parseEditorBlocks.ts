import { BLOCK_TYPES } from '../../shared/blockTypes'
import { ERROR_CODE, throwClientError } from '../errors'
import { isBlockContent } from './inlineContentValidators'
import type { BlockProps, BlockType, CustomBlock } from './types'

const BLOCK_TYPE_SET = new Set<string>(BLOCK_TYPES)
const MAX_BLOCK_DEPTH = 100
const TEXT_ALIGNMENTS = new Set(['left', 'center', 'right', 'justify'])
const HEADING_LEVELS = new Set([1, 2, 3, 4, 5, 6])
const TEXT_PROP_KEYS = new Set(['textColor', 'backgroundColor', 'textAlignment'])
const HEADING_PROP_KEYS = new Set([
  'textColor',
  'backgroundColor',
  'textAlignment',
  'level',
  'isToggleable',
])
const NUMBERED_LIST_PROP_KEYS = new Set(['textColor', 'backgroundColor', 'textAlignment', 'start'])
const CHECK_LIST_PROP_KEYS = new Set(['textColor', 'backgroundColor', 'textAlignment', 'checked'])
const MEDIA_PROP_KEYS = new Set([
  'name',
  'url',
  'caption',
  'backgroundColor',
  'textAlignment',
  'showPreview',
  'previewWidth',
])
const FILE_PROP_KEYS = new Set(['name', 'url', 'caption', 'backgroundColor'])
const AUDIO_PROP_KEYS = new Set(['name', 'url', 'caption', 'backgroundColor', 'showPreview'])

function fail(message: string): never {
  throwClientError(ERROR_CODE.VALIDATION_FAILED, message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function readString(value: Record<string, unknown>, key: string): string | undefined {
  const nested = value[key]
  if (nested === undefined) return undefined
  if (typeof nested !== 'string') fail(`Block prop "${key}" must be a string`)
  return nested
}

function readBoolean(value: Record<string, unknown>, key: string): boolean | undefined {
  const nested = value[key]
  if (nested === undefined) return undefined
  if (typeof nested !== 'boolean') fail(`Block prop "${key}" must be a boolean`)
  return nested
}

function readNumber(value: Record<string, unknown>, key: string): number | undefined {
  const nested = value[key]
  if (nested === undefined) return undefined
  if (typeof nested !== 'number') fail(`Block prop "${key}" must be a number`)
  return nested
}

function readTextAlignment(value: Record<string, unknown>): string | undefined {
  const textAlignment = readString(value, 'textAlignment')
  if (textAlignment !== undefined && !TEXT_ALIGNMENTS.has(textAlignment)) {
    fail('Block prop "textAlignment" is invalid')
  }
  return textAlignment
}

function defaultTextProps(value: Record<string, unknown>): BlockProps {
  const props: BlockProps = {}
  const textColor = readString(value, 'textColor')
  const backgroundColor = readString(value, 'backgroundColor')
  const textAlignment = readTextAlignment(value)
  if (textColor !== undefined) props.textColor = textColor
  if (backgroundColor !== undefined) props.backgroundColor = backgroundColor
  if (textAlignment !== undefined) props.textAlignment = textAlignment
  return props
}

function expectNoExtraProps(value: Record<string, unknown>, allowed: Set<string>, type: BlockType) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`Block type "${type}" does not support prop "${key}"`)
  }
}

function parseDefaultTextBlockProps(type: BlockType, value: Record<string, unknown>): BlockProps {
  expectNoExtraProps(value, TEXT_PROP_KEYS, type)
  return defaultTextProps(value)
}

function parseHeadingProps(value: Record<string, unknown>): BlockProps {
  expectNoExtraProps(value, HEADING_PROP_KEYS, 'heading')
  const level = readNumber(value, 'level')
  const isToggleable = readBoolean(value, 'isToggleable')
  if (level === undefined) fail('Heading level is required')
  if (!HEADING_LEVELS.has(level)) fail('Heading level is invalid')
  return {
    ...defaultTextProps(value),
    level,
    ...(isToggleable === undefined ? {} : { isToggleable }),
  }
}

function parseNumberedListProps(value: Record<string, unknown>): BlockProps {
  expectNoExtraProps(value, NUMBERED_LIST_PROP_KEYS, 'numberedListItem')
  const start = readNumber(value, 'start')
  return { ...defaultTextProps(value), ...(start === undefined ? {} : { start }) }
}

function parseCheckListProps(value: Record<string, unknown>): BlockProps {
  expectNoExtraProps(value, CHECK_LIST_PROP_KEYS, 'checkListItem')
  const checked = readBoolean(value, 'checked')
  return { ...defaultTextProps(value), ...(checked === undefined ? {} : { checked }) }
}

function parseCodeBlockProps(value: Record<string, unknown>): BlockProps {
  expectNoExtraProps(value, new Set(['language']), 'codeBlock')
  const language = readString(value, 'language')
  return language === undefined ? {} : { language }
}

function parseMediaProps(type: 'image' | 'video', value: Record<string, unknown>): BlockProps {
  expectNoExtraProps(value, MEDIA_PROP_KEYS, type)
  const name = readString(value, 'name')
  const url = readString(value, 'url')
  const caption = readString(value, 'caption')
  const backgroundColor = readString(value, 'backgroundColor')
  const textAlignment = readTextAlignment(value)
  const showPreview = readBoolean(value, 'showPreview')
  const previewWidth = readNumber(value, 'previewWidth')
  return {
    ...(name === undefined ? {} : { name }),
    ...(url === undefined ? {} : { url }),
    ...(caption === undefined ? {} : { caption }),
    ...(backgroundColor === undefined ? {} : { backgroundColor }),
    ...(textAlignment === undefined ? {} : { textAlignment }),
    ...(showPreview === undefined ? {} : { showPreview }),
    ...(previewWidth === undefined ? {} : { previewWidth }),
  }
}

function parseFileProps(value: Record<string, unknown>): BlockProps {
  expectNoExtraProps(value, FILE_PROP_KEYS, 'file')
  return parseFilePropsBase(value)
}

function parseAudioProps(value: Record<string, unknown>): BlockProps {
  expectNoExtraProps(value, AUDIO_PROP_KEYS, 'audio')
  const showPreview = readBoolean(value, 'showPreview')
  return { ...parseFilePropsBase(value), ...(showPreview === undefined ? {} : { showPreview }) }
}

function parseFilePropsBase(value: Record<string, unknown>): BlockProps {
  const name = readString(value, 'name')
  const url = readString(value, 'url')
  const caption = readString(value, 'caption')
  const backgroundColor = readString(value, 'backgroundColor')
  return {
    ...(name === undefined ? {} : { name }),
    ...(url === undefined ? {} : { url }),
    ...(caption === undefined ? {} : { caption }),
    ...(backgroundColor === undefined ? {} : { backgroundColor }),
  }
}

function parseTableProps(value: Record<string, unknown>): BlockProps {
  expectNoExtraProps(value, new Set(['textColor']), 'table')
  const textColor = readString(value, 'textColor')
  return textColor === undefined ? {} : { textColor }
}

const PROP_PARSERS: Record<BlockType, (value: Record<string, unknown>) => BlockProps> = {
  paragraph: (value) => parseDefaultTextBlockProps('paragraph', value),
  heading: parseHeadingProps,
  bulletListItem: (value) => parseDefaultTextBlockProps('bulletListItem', value),
  numberedListItem: parseNumberedListProps,
  checkListItem: parseCheckListProps,
  toggleListItem: (value) => parseDefaultTextBlockProps('toggleListItem', value),
  quote: (value) => parseDefaultTextBlockProps('quote', value),
  codeBlock: parseCodeBlockProps,
  divider: (value) => {
    expectNoExtraProps(value, new Set(), 'divider')
    return {}
  },
  image: (value) => parseMediaProps('image', value),
  video: (value) => parseMediaProps('video', value),
  audio: parseAudioProps,
  file: parseFileProps,
  table: parseTableProps,
}

function parseProps(type: BlockType, value: unknown): BlockProps {
  if (!isRecord(value)) fail(`Block "${type}" props must be an object`)
  return PROP_PARSERS[type](value)
}

function parseEditorBlock(input: unknown, depth = 0): CustomBlock {
  if (depth > MAX_BLOCK_DEPTH) fail(`Block tree exceeds maximum depth of ${MAX_BLOCK_DEPTH}`)
  if (!isRecord(input)) fail('Block must be an object')
  if (typeof input.id !== 'string' || input.id.length === 0) fail('Block id is required')
  if (typeof input.type !== 'string' || !BLOCK_TYPE_SET.has(input.type)) {
    fail('Block type is invalid')
  }
  const type = input.type as BlockType
  const content =
    input.content === undefined
      ? undefined
      : isBlockContent(input.content)
        ? input.content
        : fail('Block content is invalid')
  const children =
    input.children === undefined
      ? undefined
      : Array.isArray(input.children)
        ? input.children.map((child) => parseEditorBlock(child, depth + 1))
        : fail('Block children must be an array')

  return {
    id: input.id,
    type,
    props: parseProps(type, input.props ?? {}),
    ...(content === undefined ? {} : { content }),
    ...(children === undefined ? {} : { children }),
  }
}

export function parseEditorBlocks(input: unknown): Array<CustomBlock> {
  if (!Array.isArray(input)) fail('Block content must be an array')
  return input.map(parseEditorBlock)
}
