import { BASE_TEXT_COLORS } from '@wizard-archive/ui/utils/color'
import type { PaintColorValue } from '@wizard-archive/ui/utils/paint-color-values'

type RichTextColorSelectionValue = { kind: 'value'; value: PaintColorValue } | { kind: 'mixed' }

interface RichTextColorBlock {
  children?: Array<RichTextColorBlock>
  content?: unknown
}

const FULL_OPACITY = 100 as const

export const DEFAULT_RICH_TEXT_COLOR_VALUE: PaintColorValue = {
  color: 'var(--foreground)',
  opacity: FULL_OPACITY,
}

export const RICH_TEXT_COLOR_PRESETS: Array<{
  label: string
  surfaceColor: string
  value: PaintColorValue
}> = BASE_TEXT_COLORS.map(({ color, label }) => ({
  label,
  surfaceColor: getRichTextColorSurfaceColor(color),
  value: { color, opacity: FULL_OPACITY },
}))

export const RICH_TEXT_HIGHLIGHT_PRESETS: ReadonlyArray<{
  label: string
  value: string
}> = [
  { label: 'No highlight', value: 'default' },
  { label: 'Grey', value: 'var(--bg-gray)' },
  { label: 'Brown', value: 'var(--bg-brown)' },
  { label: 'Red', value: 'var(--bg-red)' },
  { label: 'Orange', value: 'var(--bg-orange)' },
  { label: 'Yellow', value: 'var(--bg-yellow)' },
  { label: 'Green', value: 'var(--bg-green)' },
  { label: 'Blue', value: 'var(--bg-blue)' },
  { label: 'Purple', value: 'var(--bg-purple)' },
  { label: 'Pink', value: 'var(--bg-pink)' },
]

function getRichTextColorSurfaceColor(color: string) {
  if (color === 'var(--foreground)') {
    return 'var(--border)'
  }

  return color.replace('var(--t-', 'var(--bg-')
}

export function resolveRichTextSelectionTextColor({
  activeTextColor,
  defaultTextColor,
  hasTextSelection,
  selectedBlocks,
}: {
  activeTextColor: string | null
  defaultTextColor: string
  hasTextSelection: boolean
  selectedBlocks: Array<RichTextColorBlock>
}): RichTextColorSelectionValue {
  if (!hasTextSelection) {
    return {
      kind: 'value',
      value: { color: activeTextColor ?? defaultTextColor, opacity: FULL_OPACITY },
    }
  }

  const { colors, hasUnstyledText } = collectSelectedBlockTextColors(selectedBlocks)
  if (hasUnstyledText) {
    colors.add(defaultTextColor)
  }

  if (colors.size > 1) {
    return { kind: 'mixed' }
  }

  const [selectedColor] = [...colors]
  return {
    kind: 'value',
    value: {
      color: selectedColor ?? defaultTextColor,
      opacity: FULL_OPACITY,
    },
  }
}

function collectSelectedBlockTextColors(blocks: Array<RichTextColorBlock>) {
  const colors = new Set<string>()
  let hasUnstyledText = false

  for (const block of blocks) {
    if (collectBlockTextColors(block, colors)) {
      hasUnstyledText = true
    }
  }

  return { colors, hasUnstyledText }
}

function collectBlockTextColors(block: RichTextColorBlock, colors: Set<string>) {
  let hasUnstyledText = collectContentTextColors(block.content, colors)

  for (const child of block.children ?? []) {
    if (collectBlockTextColors(child, colors)) {
      hasUnstyledText = true
    }
  }

  return hasUnstyledText
}

function collectContentTextColors(content: unknown, colors: Set<string>) {
  let hasUnstyledText = false

  if (!Array.isArray(content)) {
    return hasUnstyledText
  }

  for (const item of content) {
    if (collectInlineTextItem(item, colors)) {
      hasUnstyledText = true
    }
  }

  return hasUnstyledText
}

function collectInlineTextItem(item: unknown, colors: Set<string>) {
  if (typeof item === 'string') {
    return item.length > 0
  }

  if (!item || typeof item !== 'object') {
    return false
  }

  const contentItem = item as { content?: unknown; styles?: unknown; text?: unknown }
  if (Array.isArray(contentItem.content)) {
    return collectContentTextColors(contentItem.content, colors)
  }

  if (typeof contentItem.text !== 'string' || contentItem.text.length === 0) {
    return false
  }

  return !collectTextColor(contentItem.styles, colors)
}

function collectTextColor(value: unknown, colors: Set<string>) {
  const textColor = (value as { textColor?: unknown } | null)?.textColor
  if (typeof textColor === 'string' && textColor.length > 0) {
    colors.add(textColor)
    return true
  }

  return false
}
