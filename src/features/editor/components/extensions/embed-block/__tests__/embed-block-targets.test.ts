import { describe, expect, it } from 'vitest'
import { embedPropsSchema } from 'shared/editor-blocks/blockSchemas'
import { blockPropsFromEmbedTarget, embedTargetFromBlockProps } from '../embed-block-targets'

describe('note embed block target props', () => {
  it('converts primitive external block props into a shared embed target', () => {
    expect(
      embedTargetFromBlockProps({
        targetKind: 'externalUrl',
        url: 'https://example.com/assets/song.mp3',
        name: 'Theme',
      }),
    ).toEqual({
      kind: 'externalUrl',
      url: 'https://example.com/assets/song.mp3',
      name: 'Theme',
    })
  })

  it('falls back to empty for invalid external urls', () => {
    expect(
      embedTargetFromBlockProps({
        targetKind: 'externalUrl',
        url: 'http://example.com/not-allowed.png',
        name: 'Not allowed',
      }),
    ).toEqual({ kind: 'empty' })
  })

  it('clears stale locator fields when converting targets back to primitive props', () => {
    expect(
      blockPropsFromEmbedTarget({
        kind: 'sidebarItem',
        sidebarItemId: 'item-1',
      }),
    ).toEqual({
      targetKind: 'sidebarItem',
      sidebarItemId: 'item-1',
    })

    expect(blockPropsFromEmbedTarget({ kind: 'empty' })).toEqual({
      targetKind: 'empty',
    })
  })

  it('writes strict variant props accepted by the shared schema', () => {
    expect(
      embedPropsSchema.safeParse(
        blockPropsFromEmbedTarget({ kind: 'sidebarItem', sidebarItemId: 'item-1' }),
      ).success,
    ).toBe(true)
    expect(
      embedPropsSchema.safeParse(
        blockPropsFromEmbedTarget({
          kind: 'externalUrl',
          url: 'https://example.com/file.pdf',
          name: 'file.pdf',
        }),
      ).success,
    ).toBe(true)
  })
})
