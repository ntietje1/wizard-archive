import type {
  CustomInlineContentConfig,
  InlineContentSpec,
} from '@blocknote/core'

export const MENTION_INLINE_CONTENT_TYPE = 'mention' as const

export const MentionConfig: CustomInlineContentConfig = {
  type: MENTION_INLINE_CONTENT_TYPE,
  propSchema: {
    sidebarItemId: { default: '' },
    sidebarItemType: { default: '' },
    displayName: { default: '' },
    color: { default: '' },
  },
  content: 'styled',
}

type MentionInlineSpec = InlineContentSpec<typeof MentionConfig>

export type MentionInlineSpecType = { mention: MentionInlineSpec }
