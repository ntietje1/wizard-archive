import { v } from 'convex/values'
import { literals } from 'convex-helpers/validators'
import { blockNoteIdValidator } from './schema'
import { blockContentValidator } from './inlineContentValidators'
import type { Validator } from 'convex/values'

const textAlignmentValidator = v.optional(literals('left', 'center', 'right', 'justify'))

const defaultPropsValidators = {
  textColor: v.optional(v.string()),
  backgroundColor: v.optional(v.string()),
  textAlignment: textAlignmentValidator,
}

const paragraphPropsValidator = v.object(defaultPropsValidators)
const headingPropsValidator = v.object({
  ...defaultPropsValidators,
  level: literals(1, 2, 3, 4, 5, 6),
  isToggleable: v.optional(v.boolean()),
})
const numberedListItemPropsValidator = v.object({
  ...defaultPropsValidators,
  start: v.optional(v.number()),
})
const checkListItemPropsValidator = v.object({
  ...defaultPropsValidators,
  checked: v.optional(v.boolean()),
})
const emptyPropsValidator = v.object({})
const codeBlockPropsValidator = v.object({
  language: v.optional(v.string()),
})
const mediaPropsValidator = v.object({
  name: v.optional(v.string()),
  url: v.optional(v.string()),
  caption: v.optional(v.string()),
  backgroundColor: v.optional(v.string()),
  textAlignment: textAlignmentValidator,
  showPreview: v.optional(v.boolean()),
  previewWidth: v.optional(v.number()),
})
const audioFilePropsValidator = v.object({
  name: v.optional(v.string()),
  url: v.optional(v.string()),
  caption: v.optional(v.string()),
  backgroundColor: v.optional(v.string()),
})
const audioPropsValidator = v.object({
  name: v.optional(v.string()),
  url: v.optional(v.string()),
  caption: v.optional(v.string()),
  backgroundColor: v.optional(v.string()),
  showPreview: v.optional(v.boolean()),
})
const tablePropsValidator = v.object({
  textColor: v.optional(v.string()),
})

const baseFields = {
  id: blockNoteIdValidator,
  // Convex validators are not recursive; parseEditorBlocks validates nested children strictly.
  children: v.optional(v.array(v.any())),
}
const optionalBlockContentValidator = v.optional(blockContentValidator)

const customBlockUnionValidator = v.union(
  v.object({
    ...baseFields,
    type: v.literal('paragraph'),
    props: paragraphPropsValidator,
    content: optionalBlockContentValidator,
  }),
  v.object({
    ...baseFields,
    type: v.literal('heading'),
    props: headingPropsValidator,
    content: optionalBlockContentValidator,
  }),
  v.object({
    ...baseFields,
    type: v.literal('bulletListItem'),
    props: paragraphPropsValidator,
    content: optionalBlockContentValidator,
  }),
  v.object({
    ...baseFields,
    type: v.literal('numberedListItem'),
    props: numberedListItemPropsValidator,
    content: optionalBlockContentValidator,
  }),
  v.object({
    ...baseFields,
    type: v.literal('checkListItem'),
    props: checkListItemPropsValidator,
    content: optionalBlockContentValidator,
  }),
  v.object({
    ...baseFields,
    type: v.literal('toggleListItem'),
    props: paragraphPropsValidator,
    content: optionalBlockContentValidator,
  }),
  v.object({
    ...baseFields,
    type: v.literal('quote'),
    props: paragraphPropsValidator,
    content: optionalBlockContentValidator,
  }),
  v.object({
    ...baseFields,
    type: v.literal('codeBlock'),
    props: codeBlockPropsValidator,
    content: optionalBlockContentValidator,
  }),
  v.object({
    ...baseFields,
    type: v.literal('divider'),
    props: emptyPropsValidator,
  }),
  v.object({
    ...baseFields,
    type: v.literal('image'),
    props: mediaPropsValidator,
    content: optionalBlockContentValidator,
  }),
  v.object({
    ...baseFields,
    type: v.literal('video'),
    props: mediaPropsValidator,
    content: optionalBlockContentValidator,
  }),
  v.object({
    ...baseFields,
    type: v.literal('audio'),
    props: audioPropsValidator,
    content: optionalBlockContentValidator,
  }),
  v.object({
    ...baseFields,
    type: v.literal('file'),
    props: audioFilePropsValidator,
    content: optionalBlockContentValidator,
  }),
  v.object({
    ...baseFields,
    type: v.literal('table'),
    props: tablePropsValidator,
    content: optionalBlockContentValidator,
  }),
)

// Convex validators cannot express recursive block trees without widening child nodes.
// The validator rejects malformed top-level blocks; parseEditorBlocks validates children strictly.
export const editorBlockInputValidator = customBlockUnionValidator as unknown as Validator<
  unknown,
  'required'
>
