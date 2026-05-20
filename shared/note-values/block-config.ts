const noteValuePropSchema = {
  valueId: { default: '' },
  slug: { default: '' },
  expressionSource: { default: '0' },
} as const

export const noteValueInlineConfig = {
  type: 'value',
  propSchema: noteValuePropSchema,
  content: 'none',
  meta: {
    draggable: true,
  },
} as const
