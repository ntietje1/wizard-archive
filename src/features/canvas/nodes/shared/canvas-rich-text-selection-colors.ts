import type { CanvasPaintValue, CanvasPropertyValue } from '../../properties/canvas-property-types'

interface CanvasRichTextColorBlock {
  children?: Array<CanvasRichTextColorBlock>
  content?: unknown
}

export function resolveCanvasRichTextSelectionTextColor({
  activeTextColor,
  defaultTextColor,
  hasTextSelection,
  selectedBlocks,
}: {
  activeTextColor: string | null
  defaultTextColor: string
  hasTextSelection: boolean
  selectedBlocks: Array<CanvasRichTextColorBlock>
}): CanvasPropertyValue<CanvasPaintValue> {
  if (!hasTextSelection) {
    return { kind: 'value', value: { color: defaultTextColor, opacity: 100 } }
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
      color: selectedColor ?? activeTextColor ?? defaultTextColor,
      opacity: 100,
    },
  }
}

function collectSelectedBlockTextColors(blocks: Array<CanvasRichTextColorBlock>) {
  const colors = new Set<string>()
  let hasUnstyledText = false

  for (const block of blocks) {
    if (collectBlockTextColors(block, colors)) {
      hasUnstyledText = true
    }
  }

  return { colors, hasUnstyledText }
}

function collectBlockTextColors(block: CanvasRichTextColorBlock, colors: Set<string>) {
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
  if (typeof textColor === 'string') {
    colors.add(textColor)
    return true
  }

  return false
}
