import { z } from 'zod'

export const blockTypeSchema = z.enum([
  'paragraph',
  'heading',
  'bulletListItem',
  'numberedListItem',
  'checkListItem',
  'toggleListItem',
  'quote',
  'codeBlock',
  'divider',
  'image',
  'video',
  'audio',
  'file',
  'table',
])

export const stylesSchema = z
  .strictObject({
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    underline: z.boolean().optional(),
    strike: z.boolean().optional(),
    code: z.boolean().optional(),
    textColor: z.string().optional(),
    backgroundColor: z.string().optional(),
  })
  .optional()

export const styledTextSchema = z.strictObject({
  type: z.literal('text'),
  text: z.string(),
  styles: stylesSchema,
})

export const inlineContentSchema = styledTextSchema

export const tableContentSchema = z.strictObject({
  type: z.literal('tableContent'),
  columnWidths: z.array(z.number().nullable()),
  headerRows: z.number().optional(),
  headerCols: z.number().optional(),
  rows: z.array(
    z.strictObject({
      cells: z.array(z.array(inlineContentSchema)),
    }),
  ),
})

export const textAlignmentSchema = z.enum(['left', 'center', 'right', 'justify']).optional()

export const defaultProps = {
  textColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  textAlignment: textAlignmentSchema,
}

export const paragraphPropsSchema = z.strictObject({ ...defaultProps })

export const headingPropsSchema = z.strictObject({
  level: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
  isToggleable: z.boolean().optional(),
  ...defaultProps,
})

export const bulletListItemPropsSchema = z.strictObject({ ...defaultProps })

export const numberedListItemPropsSchema = z.strictObject({
  start: z.number().optional(),
  ...defaultProps,
})

export const checkListItemPropsSchema = z.strictObject({
  checked: z.boolean().optional(),
  ...defaultProps,
})

export const toggleListItemPropsSchema = z.strictObject({ ...defaultProps })

export const quotePropsSchema = z.strictObject({
  textColor: z.string().optional(),
  backgroundColor: z.string().optional(),
})

export const codeBlockPropsSchema = z.strictObject({
  language: z.string().optional(),
})

export const dividerPropsSchema = z.strictObject({})

export const imagePropsSchema = z.strictObject({
  name: z.string().optional(),
  url: z.string().optional(),
  caption: z.string().optional(),
  backgroundColor: z.string().optional(),
  textAlignment: textAlignmentSchema,
  showPreview: z.boolean().optional(),
  previewWidth: z.number().optional(),
})

export const videoPropsSchema = z.strictObject({
  name: z.string().optional(),
  url: z.string().optional(),
  caption: z.string().optional(),
  backgroundColor: z.string().optional(),
  textAlignment: textAlignmentSchema,
  showPreview: z.boolean().optional(),
  previewWidth: z.number().optional(),
})

export const audioPropsSchema = z.strictObject({
  name: z.string().optional(),
  url: z.string().optional(),
  caption: z.string().optional(),
  backgroundColor: z.string().optional(),
  showPreview: z.boolean().optional(),
})

export const filePropsSchema = z.strictObject({
  name: z.string().optional(),
  url: z.string().optional(),
  caption: z.string().optional(),
  backgroundColor: z.string().optional(),
})

export const tablePropsSchema = z.strictObject({
  textColor: z.string().optional(),
})
