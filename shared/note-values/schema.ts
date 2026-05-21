import { z } from 'zod'

export const noteValuePropsSchema = z.strictObject({
  valueId: z.string(),
  slug: z.string(),
  expressionSource: z.string(),
})

export type NoteValueProps = z.infer<typeof noteValuePropsSchema>

export const NOTE_VALUE_PROP_DEFAULTS = {
  valueId: '',
  slug: '',
  expressionSource: '0',
} satisfies NoteValueProps
