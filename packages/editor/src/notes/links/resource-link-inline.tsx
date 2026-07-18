import type { MouseEvent } from 'react'
import {
  parseSerializedAuthoredDestination,
  resolveAuthoredDestinationKnowledge,
} from '../../resources/authored-destination'
import type { ResolvedAuthoredDestination } from '../../resources/authored-destination'
import type { AuthoredDestination } from '../../resources/authored-destination-contract'
import type { EditorRuntime } from '../../resources/editor-runtime-contract'
import { presentExternalUrl } from '../../resources/external-url-presentation'
import type { AuthorizedResourceSummary } from '../../resources/resource-index-contract'
import { useWorkspaceIndexSnapshot } from '../../resources/workspace/resource-store-snapshot'
import { useNoteResourceRuntime } from '../use-note-resource-runtime'
import { noteResourceLinkText } from './resource-link-external'
import type { NoteResourceLinkProps } from './resource-link-model'

export function NoteResourceLinkInline({ props }: { props: NoteResourceLinkProps }) {
  const surface = useNoteResourceRuntime()
  return surface.runtime ? (
    <ResolvedResourceLink editable={surface.editable} props={props} runtime={surface.runtime} />
  ) : (
    <ResourceLinkButton
      editable={surface.editable}
      label={noteResourceLinkText(props)}
      state="unavailable"
    />
  )
}

function ResolvedResourceLink({
  editable,
  props,
  runtime,
}: {
  editable: boolean
  props: NoteResourceLinkProps
  runtime: EditorRuntime
}) {
  const snapshot = useWorkspaceIndexSnapshot(runtime.resources.index)
  const destination = parseSerializedAuthoredDestination(props.destination)
  if (!destination) {
    return <ResourceLinkButton editable={editable} label="Invalid link" state="broken" />
  }
  const resolved = resolveAuthoredDestinationKnowledge<AuthorizedResourceSummary>(
    destination,
    runtime.scope.campaignId,
    destination.kind === 'internal'
      ? targetKnowledge(snapshot.lookup(destination.target.resourceId))
      : undefined,
  )
  const label = props.label.trim() || resolvedLabel(destination, resolved)
  if (resolved.status === 'available') {
    return (
      <ResourceLinkButton
        editable={editable}
        label={label}
        state="available"
        onOpen={() => runtime.navigation.open(resolved.target)}
      />
    )
  }
  if (resolved.status === 'external') {
    return (
      <ResourceLinkButton
        editable={editable}
        label={label}
        state="external"
        onOpen={() => window.open(resolved.url, '_blank', 'noopener,noreferrer')}
      />
    )
  }
  return (
    <ResourceLinkButton
      editable={editable}
      label={label}
      state={resolved.status === 'broken' ? 'broken' : 'unavailable'}
    />
  )
}

function ResourceLinkButton({
  editable,
  label,
  onOpen,
  state,
}: {
  editable: boolean
  label: string
  onOpen?: () => void
  state: 'available' | 'broken' | 'external' | 'unavailable'
}) {
  const open = (event: MouseEvent<HTMLButtonElement>) => {
    if (!onOpen || (editable && !event.ctrlKey && !event.metaKey)) return
    event.preventDefault()
    event.stopPropagation()
    onOpen()
  }
  return (
    <span className="note-resource-link-owner" contentEditable={false}>
      <button
        type="button"
        aria-disabled={!onOpen}
        aria-label={onOpen ? `Open ${label}` : label}
        className="note-resource-link"
        data-note-resource-link-state={state}
        onClick={open}
      >
        <span>{label}</span>
      </button>
    </span>
  )
}

function targetKnowledge(
  knowledge:
    | Readonly<{ state: 'known'; value: AuthorizedResourceSummary }>
    | Readonly<{ state: 'missing' }>
    | Readonly<{ state: 'unknown' }>,
) {
  switch (knowledge.state) {
    case 'known':
      return {
        state: 'available' as const,
        campaignId: knowledge.value.campaignId,
        display: knowledge.value,
      }
    case 'missing':
      return { state: 'missing' as const }
    case 'unknown':
      return { state: 'unavailable' as const }
  }
}

function resolvedLabel(
  destination: AuthoredDestination,
  resolved: ResolvedAuthoredDestination<AuthorizedResourceSummary>,
) {
  if (resolved.status === 'available') return resolved.display.title
  if (resolved.status === 'external') return presentExternalUrl(resolved.url).title
  if (resolved.status === 'unresolved') return resolved.rawTarget || 'Unresolved link'
  if (destination.kind === 'internal') return resolved.status === 'broken' ? 'Missing link' : 'Link'
  return 'Invalid link'
}
