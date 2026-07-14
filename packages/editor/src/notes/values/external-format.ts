import { NOTE_VALUE_PROP_DEFAULTS, noteValuePropsSchema } from './schema'
import type { NoteValueProps } from './schema'

const VALUE_INLINE_MARKER_ATTRIBUTE = 'data-note-value-inline'
const VALUE_INLINE_ID_ATTRIBUTE = 'data-note-value-id'
const VALUE_INLINE_SLUG_ATTRIBUTE = 'data-note-value-slug'
const VALUE_INLINE_EXPRESSION_ATTRIBUTE = 'data-note-value-expression-source'

function normalizeValueInlineProps(props: Partial<NoteValueProps>): NoteValueProps {
  return noteValuePropsSchema.parse({
    valueId: props.valueId ?? NOTE_VALUE_PROP_DEFAULTS.valueId,
    slug: props.slug ?? NOTE_VALUE_PROP_DEFAULTS.slug,
    expressionSource: props.expressionSource ?? NOTE_VALUE_PROP_DEFAULTS.expressionSource,
  })
}

export function renderValueInlineExternalElement(props: Partial<NoteValueProps>): HTMLElement {
  const valueProps = normalizeValueInlineProps(props)
  const element = document.createElement('span')
  element.textContent = valueProps.slug || valueProps.expressionSource || 'value'
  for (const [name, value] of getValueInlineExternalAttributes(valueProps)) {
    element.setAttribute(name, value)
  }
  return element
}

export function parseValueInlineExternalElement(
  element: HTMLElement,
): Partial<NoteValueProps> | undefined {
  if (element.getAttribute(VALUE_INLINE_MARKER_ATTRIBUTE) !== 'true') return undefined

  return normalizeValueInlineProps({
    valueId: element.getAttribute(VALUE_INLINE_ID_ATTRIBUTE) ?? undefined,
    slug: element.getAttribute(VALUE_INLINE_SLUG_ATTRIBUTE) ?? undefined,
    expressionSource: element.getAttribute(VALUE_INLINE_EXPRESSION_ATTRIBUTE) ?? undefined,
  })
}

function getValueInlineExternalAttributes(valueProps: NoteValueProps): Array<[string, string]> {
  return [
    [VALUE_INLINE_MARKER_ATTRIBUTE, 'true'],
    [VALUE_INLINE_ID_ATTRIBUTE, valueProps.valueId],
    [VALUE_INLINE_SLUG_ATTRIBUTE, valueProps.slug],
    [VALUE_INLINE_EXPRESSION_ATTRIBUTE, valueProps.expressionSource],
  ]
}
