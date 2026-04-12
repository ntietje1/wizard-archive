import { z } from 'zod'
import { zodToConvex } from 'convex-helpers/server/zod4'
import {
  inlineContentSchema,
  tableContentSchema,
  paragraphPropsSchema,
  headingPropsSchema,
  bulletListItemPropsSchema,
  numberedListItemPropsSchema,
  checkListItemPropsSchema,
  toggleListItemPropsSchema,
  quotePropsSchema,
  codeBlockPropsSchema,
  dividerPropsSchema,
  imagePropsSchema,
  videoPropsSchema,
  audioPropsSchema,
  filePropsSchema,
  tablePropsSchema,
} from './sharedBlockSchemas'

type BlockNoteBlock = {
  id: string
  type: string
  props: Record<string, unknown>
  content?: Array<z.infer<typeof inlineContentSchema>> | z.infer<typeof tableContentSchema>
  children?: Array<BlockNoteBlock>
}

const blockNoteBlockSchema: z.ZodType<BlockNoteBlock> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.strictObject({
      id: z.string(),
      type: z.literal('paragraph'),
      props: paragraphPropsSchema,
      content: z.array(inlineContentSchema).optional(),
      children: z.array(blockNoteBlockSchema).optional(),
    }),
    z.strictObject({
      id: z.string(),
      type: z.literal('heading'),
      props: headingPropsSchema,
      content: z.array(inlineContentSchema).optional(),
      children: z.array(blockNoteBlockSchema).optional(),
    }),
    z.strictObject({
      id: z.string(),
      type: z.literal('bulletListItem'),
      props: bulletListItemPropsSchema,
      content: z.array(inlineContentSchema).optional(),
      children: z.array(blockNoteBlockSchema).optional(),
    }),
    z.strictObject({
      id: z.string(),
      type: z.literal('numberedListItem'),
      props: numberedListItemPropsSchema,
      content: z.array(inlineContentSchema).optional(),
      children: z.array(blockNoteBlockSchema).optional(),
    }),
    z.strictObject({
      id: z.string(),
      type: z.literal('checkListItem'),
      props: checkListItemPropsSchema,
      content: z.array(inlineContentSchema).optional(),
      children: z.array(blockNoteBlockSchema).optional(),
    }),
    z.strictObject({
      id: z.string(),
      type: z.literal('toggleListItem'),
      props: toggleListItemPropsSchema,
      content: z.array(inlineContentSchema).optional(),
      children: z.array(blockNoteBlockSchema).optional(),
    }),
    z.strictObject({
      id: z.string(),
      type: z.literal('quote'),
      props: quotePropsSchema,
      content: z.array(inlineContentSchema).optional(),
      children: z.array(blockNoteBlockSchema).optional(),
    }),
    z.strictObject({
      id: z.string(),
      type: z.literal('codeBlock'),
      props: codeBlockPropsSchema,
      content: z.array(inlineContentSchema).optional(),
      children: z.array(blockNoteBlockSchema).optional(),
    }),
    z.strictObject({
      id: z.string(),
      type: z.literal('divider'),
      props: dividerPropsSchema,
      content: z.array(inlineContentSchema).optional(),
      children: z.array(blockNoteBlockSchema).optional(),
    }),
    z.strictObject({
      id: z.string(),
      type: z.literal('image'),
      props: imagePropsSchema,
      content: z.array(inlineContentSchema).optional(),
      children: z.array(blockNoteBlockSchema).optional(),
    }),
    z.strictObject({
      id: z.string(),
      type: z.literal('video'),
      props: videoPropsSchema,
      content: z.array(inlineContentSchema).optional(),
      children: z.array(blockNoteBlockSchema).optional(),
    }),
    z.strictObject({
      id: z.string(),
      type: z.literal('audio'),
      props: audioPropsSchema,
      content: z.array(inlineContentSchema).optional(),
      children: z.array(blockNoteBlockSchema).optional(),
    }),
    z.strictObject({
      id: z.string(),
      type: z.literal('file'),
      props: filePropsSchema,
      content: z.array(inlineContentSchema).optional(),
      children: z.array(blockNoteBlockSchema).optional(),
    }),
    z.strictObject({
      id: z.string(),
      type: z.literal('table'),
      props: tablePropsSchema,
      content: tableContentSchema.optional(),
      children: z.array(blockNoteBlockSchema).optional(),
    }),
  ]),
)

export { blockNoteBlockSchema }
export const blockNoteBlockValidator = zodToConvex(blockNoteBlockSchema)
