import { z } from 'zod'

export interface NoteValueProps {
  valueId: string
  slug: string
  expressionSource: string
}

export const noteValuePropsSchema = z.strictObject({
  valueId: z.string(),
  slug: z.string(),
  expressionSource: z.string(),
}) satisfies z.ZodType<NoteValueProps>

export const NOTE_VALUE_PROP_DEFAULTS = {
  valueId: '',
  slug: '',
  expressionSource: '0',
} satisfies NoteValueProps
