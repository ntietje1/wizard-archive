import { z } from 'zod'
import { isUuidV7 } from '../../resources/domain-id'

export interface NoteValueProps {
  valueId: string
  label: string
  expressionSource: string
}

export const noteValuePropsSchema = z.strictObject({
  valueId: z.string().refine(isUuidV7, 'Expected a lowercase UUIDv7 note value id'),
  label: z.string(),
  expressionSource: z.string(),
}) satisfies z.ZodType<NoteValueProps>

export const NOTE_VALUE_PROP_DEFAULTS = {
  valueId: '',
  label: '',
  expressionSource: '0',
}
