import { z } from 'zod'

export interface NoteValueProps {
  valueId: string
  label: string
  expressionSource: string
}

export const noteValuePropsSchema = z.strictObject({
  valueId: z.string(),
  label: z.string(),
  expressionSource: z.string(),
}) satisfies z.ZodType<NoteValueProps>

export const NOTE_VALUE_PROP_DEFAULTS = {
  valueId: '',
  label: '',
  expressionSource: '0',
} satisfies NoteValueProps
