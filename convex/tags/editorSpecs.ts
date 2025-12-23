import type {
  CustomInlineContentConfig,
  InlineContentSpec,
} from '@blocknote/core'

export const TAG_INLINE_CONTENT_TYPE = 'tag' as const

export const TagConfig: CustomInlineContentConfig = {
  type: TAG_INLINE_CONTENT_TYPE,
  propSchema: {
    tagId: { default: '' },
    tagName: { default: '' },
    tagColor: { default: '' },
  },
  content: 'none',
}

type TagInlineSpec = InlineContentSpec<typeof TagConfig>

export type TagInlineSpecType = { tag: TagInlineSpec }
