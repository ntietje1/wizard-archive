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

const flatBlockContentSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('paragraph'),
    props: paragraphPropsSchema,
    content: z.array(inlineContentSchema).optional(),
  }),
  z.strictObject({
    type: z.literal('heading'),
    props: headingPropsSchema,
    content: z.array(inlineContentSchema).optional(),
  }),
  z.strictObject({
    type: z.literal('bulletListItem'),
    props: bulletListItemPropsSchema,
    content: z.array(inlineContentSchema).optional(),
  }),
  z.strictObject({
    type: z.literal('numberedListItem'),
    props: numberedListItemPropsSchema,
    content: z.array(inlineContentSchema).optional(),
  }),
  z.strictObject({
    type: z.literal('checkListItem'),
    props: checkListItemPropsSchema,
    content: z.array(inlineContentSchema).optional(),
  }),
  z.strictObject({
    type: z.literal('toggleListItem'),
    props: toggleListItemPropsSchema,
    content: z.array(inlineContentSchema).optional(),
  }),
  z.strictObject({
    type: z.literal('quote'),
    props: quotePropsSchema,
    content: z.array(inlineContentSchema).optional(),
  }),
  z.strictObject({
    type: z.literal('codeBlock'),
    props: codeBlockPropsSchema,
    content: z.array(inlineContentSchema).optional(),
  }),
  z.strictObject({
    type: z.literal('divider'),
    props: dividerPropsSchema,
    content: z.array(inlineContentSchema).optional(),
  }),
  z.strictObject({
    type: z.literal('image'),
    props: imagePropsSchema,
    content: z.array(inlineContentSchema).optional(),
  }),
  z.strictObject({
    type: z.literal('video'),
    props: videoPropsSchema,
    content: z.array(inlineContentSchema).optional(),
  }),
  z.strictObject({
    type: z.literal('audio'),
    props: audioPropsSchema,
    content: z.array(inlineContentSchema).optional(),
  }),
  z.strictObject({
    type: z.literal('file'),
    props: filePropsSchema,
    content: z.array(inlineContentSchema).optional(),
  }),
  z.strictObject({
    type: z.literal('table'),
    props: tablePropsSchema,
    content: tableContentSchema.optional(),
  }),
])

export { flatBlockContentSchema }
export type FlatBlockContent = z.infer<typeof flatBlockContentSchema>
export const flatBlockContentValidator = zodToConvex(flatBlockContentSchema)
