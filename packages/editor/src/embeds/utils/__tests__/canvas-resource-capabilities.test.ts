import { describe, expect, it } from 'vite-plus/test'
import { RESOURCE_TYPES } from '../../../workspace/items-persistence-contract'
import type { AnyItemWithContent } from '../../../workspace/items'
import {
  isCanvasSidebarItemEmbedRichTextEditable,
  shouldCanvasSidebarItemEmbedLockToMediaAspectRatio,
  shouldCanvasSidebarItemEmbedUseDocumentShapeDefault,
  shouldCanvasSidebarItemEmbedUseFreeformResize,
  shouldClearDefaultCanvasSidebarItemEmbedAspectRatio,
} from '../canvas-resource-capabilities'

describe('canvas sidebar item embed capabilities', () => {
  it('uses freeform document behavior for note and canvas embeds', () => {
    for (const type of [RESOURCE_TYPES.notes, RESOURCE_TYPES.canvases]) {
      const item = itemWithType(type)

      expect(shouldCanvasSidebarItemEmbedUseFreeformResize(item)).toBe(true)
      expect(shouldClearDefaultCanvasSidebarItemEmbedAspectRatio(item)).toBe(true)
      expect(shouldCanvasSidebarItemEmbedLockToMediaAspectRatio(item)).toBe(false)
    }
  })

  it('keeps media-shaped embeds locked to their media aspect ratio', () => {
    for (const type of [RESOURCE_TYPES.files, RESOURCE_TYPES.gameMaps]) {
      const item = itemWithType(type)

      expect(shouldCanvasSidebarItemEmbedLockToMediaAspectRatio(item)).toBe(true)
      expect(shouldCanvasSidebarItemEmbedUseFreeformResize(item)).toBe(false)
      expect(shouldClearDefaultCanvasSidebarItemEmbedAspectRatio(item)).toBe(false)
    }
  })

  it('allows only notes to use rich text editing and document defaults', () => {
    expect(isCanvasSidebarItemEmbedRichTextEditable(itemWithType(RESOURCE_TYPES.notes))).toBe(true)
    expect(
      shouldCanvasSidebarItemEmbedUseDocumentShapeDefault(itemWithType(RESOURCE_TYPES.notes)),
    ).toBe(true)
    expect(isCanvasSidebarItemEmbedRichTextEditable(itemWithType(RESOURCE_TYPES.canvases))).toBe(
      false,
    )
    expect(
      shouldCanvasSidebarItemEmbedUseDocumentShapeDefault(itemWithType(RESOURCE_TYPES.canvases)),
    ).toBe(false)
  })
})

function itemWithType(type: AnyItemWithContent['type']): AnyItemWithContent {
  return { type } as AnyItemWithContent
}
