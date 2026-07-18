import { createContext } from 'react'
import type { ReactNode } from 'react'
import type { AuthoredDestinationDropResolver } from '../resources/authored-destination-drop'
import type { NoteSessionState } from '../resources/content-session-contract'
import type { ResourceId } from '../resources/domain-id'
import type { EditorRuntime } from '../resources/editor-runtime-contract'
import type { AuthorizedResourceSummary } from '../resources/resource-index-contract'

type RenderableNoteState = Extract<
  NoteSessionState,
  { status: 'initializing' } | { status: 'ready' }
>

export type EmbeddedNoteResourceRenderer = (input: {
  ancestors: ReadonlySet<ResourceId>
  drop: AuthoredDestinationDropResolver | null
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
  state: RenderableNoteState
}) => ReactNode

export type NoteResourceBinding = Readonly<{
  ancestors?: ReadonlySet<ResourceId>
  drop?: AuthoredDestinationDropResolver
  renderNote: EmbeddedNoteResourceRenderer
  runtime: EditorRuntime
  sourceResourceId: ResourceId
}>

type NoteResourceRuntime = Readonly<{
  ancestry: ReadonlySet<ResourceId>
  editable: boolean
  drop: AuthoredDestinationDropResolver | null
  renderNote: EmbeddedNoteResourceRenderer | null
  runtime: EditorRuntime | null
  sourceResourceId: ResourceId | null
}>

export const NoteResourceRuntimeContext = createContext<NoteResourceRuntime | null>(null)
