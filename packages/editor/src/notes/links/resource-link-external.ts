import { parseSerializedAuthoredDestination } from '../../resources/authored-destination'
import {
  NOTE_RESOURCE_LINK_PROP_DEFAULTS,
  noteResourceLinkPropsSchema,
} from './resource-link-model'
import type { NoteResourceLinkProps } from './resource-link-model'

const MARKER_ATTRIBUTE = 'data-note-resource-link'
const DESTINATION_ATTRIBUTE = 'data-note-resource-link-destination'
const LABEL_ATTRIBUTE = 'data-note-resource-link-label'

export function noteResourceLinkText(props: Partial<NoteResourceLinkProps>): string {
  const normalized = normalizeResourceLinkProps(props)
  if (normalized.label.trim()) return normalized.label
  const destination = parseSerializedAuthoredDestination(normalized.destination)
  if (destination?.kind === 'externalUrl') return destination.url
  if (destination?.kind === 'unresolved') return destination.rawTarget || 'Unresolved link'
  return 'Linked resource'
}

export function renderNoteResourceLinkExternalElement(
  props: Partial<NoteResourceLinkProps>,
): HTMLElement {
  const normalized = normalizeResourceLinkProps(props)
  const element = document.createElement('span')
  element.textContent = noteResourceLinkText(normalized)
  element.setAttribute(MARKER_ATTRIBUTE, 'true')
  element.setAttribute(DESTINATION_ATTRIBUTE, normalized.destination)
  element.setAttribute(LABEL_ATTRIBUTE, normalized.label)
  return element
}

export function parseNoteResourceLinkExternalElement(
  element: HTMLElement,
): Partial<NoteResourceLinkProps> | undefined {
  if (element.getAttribute(MARKER_ATTRIBUTE) !== 'true') return undefined
  return normalizeResourceLinkProps({
    destination: element.getAttribute(DESTINATION_ATTRIBUTE) ?? undefined,
    label: element.getAttribute(LABEL_ATTRIBUTE) ?? undefined,
  })
}

function normalizeResourceLinkProps(props: Partial<NoteResourceLinkProps>): NoteResourceLinkProps {
  return noteResourceLinkPropsSchema.parse({
    destination: props.destination ?? NOTE_RESOURCE_LINK_PROP_DEFAULTS.destination,
    label: props.label ?? NOTE_RESOURCE_LINK_PROP_DEFAULTS.label,
  })
}
