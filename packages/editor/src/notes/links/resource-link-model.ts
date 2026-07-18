import { z } from 'zod'
import {
  EMPTY_AUTHORED_DESTINATION_SERIALIZED,
  parseSerializedAuthoredDestination,
} from '../../resources/authored-destination'

export type NoteResourceLinkProps = Readonly<{
  destination: string
  label: string
}>

export const noteResourceLinkPropsSchema = z.strictObject({
  destination: z
    .string()
    .refine(
      (value) => parseSerializedAuthoredDestination(value) !== null,
      'Expected a serialized authored destination',
    ),
  label: z.string(),
}) satisfies z.ZodType<NoteResourceLinkProps>

export const NOTE_RESOURCE_LINK_PROP_DEFAULTS: NoteResourceLinkProps = {
  destination: EMPTY_AUTHORED_DESTINATION_SERIALIZED,
  label: '',
}

export const noteResourceLinkInlineConfig = {
  type: 'resourceLink',
  propSchema: {
    destination: { default: NOTE_RESOURCE_LINK_PROP_DEFAULTS.destination },
    label: { default: NOTE_RESOURCE_LINK_PROP_DEFAULTS.label },
  },
  content: 'none',
} as const
