import { NOTE_VALUE_PROP_DEFAULTS } from './schema'

export const noteValueInlineConfig = {
  type: 'value',
  propSchema: {
    valueId: { default: NOTE_VALUE_PROP_DEFAULTS.valueId },
    label: { default: NOTE_VALUE_PROP_DEFAULTS.label },
    expressionSource: { default: NOTE_VALUE_PROP_DEFAULTS.expressionSource },
  },
  content: 'none',
  meta: {
    draggable: true,
  },
} as const
