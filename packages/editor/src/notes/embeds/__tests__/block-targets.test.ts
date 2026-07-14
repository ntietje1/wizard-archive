import type { ResourceId } from '../../../resources/domain-id'
import { describe, expect, it } from 'vite-plus/test'
import { noteBlockContentSchema } from '../../document/model'

import { blockPropsFromEmbedTarget, embedTargetFromBlockProps } from '../block-targets'

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

  it('clears stale locator fields when converting targets back to primitive props', () => {
    expect(
      blockPropsFromEmbedTarget({
        kind: 'resource',
        resourceId: sidebarId('item-1'),
      }),
    ).toEqual({
      targetKind: 'resource',
      resourceId: 'item-1',
    })

    expect(blockPropsFromEmbedTarget({ kind: 'empty' })).toEqual({
      targetKind: 'empty',
    })
  })

  it('writes strict variant props accepted by the shared schema', () => {
    expect(
      noteBlockContentSchema.safeParse({
        type: 'embed',
        props: blockPropsFromEmbedTarget({
          kind: 'resource',
          resourceId: sidebarId('item-1'),
        }),
      }).success,
    ).toBe(true)
    expect(
      noteBlockContentSchema.safeParse({
        type: 'embed',
        props: blockPropsFromEmbedTarget({
          kind: 'externalUrl',
          url: 'https://example.com/file.pdf',
          name: 'file.pdf',
        }),
      }).success,
    ).toBe(true)
  })
})

function sidebarId(value: string): ResourceId {
  return value as ResourceId
}
