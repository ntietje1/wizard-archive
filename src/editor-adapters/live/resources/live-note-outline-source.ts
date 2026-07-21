import type { FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import { assertDomainId, DOMAIN_ID_KIND } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { NoteOutlineSource, NoteOutlineState } from '@wizard-archive/editor/notes/outline'
import { createResourceWatchStore } from './resource-watch-store'

type StoredNoteOutlineState = FunctionReturnType<typeof api.resources.queries.loadNoteOutline>

export function createLiveNoteOutlineSource(
  watch: (resourceId: ResourceId, apply: (state: StoredNoteOutlineState) => void) => () => void,
): Readonly<{ source: NoteOutlineSource; dispose(): void }> {
  const loading: NoteOutlineState = { status: 'loading' }
  let store: ReturnType<typeof createResourceWatchStore<StoredNoteOutlineState, NoteOutlineState>>
  store = createResourceWatchStore<StoredNoteOutlineState, NoteOutlineState>(
    watch,
    (resourceId, state) => store.set(resourceId, readNoteOutlineState(state)),
    loading,
  )
  return {
    source: {
      get: store.get,
      subscribe: store.subscribe,
    },
    dispose: store.dispose,
  }
}

function readNoteOutlineState(state: StoredNoteOutlineState): NoteOutlineState {
  if (state.status === 'unavailable') return state
  try {
    return {
      status: 'ready',
      headings: state.headings.map((heading) => ({
        ...heading,
        blockId: assertDomainId(DOMAIN_ID_KIND.noteBlock, heading.blockId),
      })),
    }
  } catch {
    return { status: 'unavailable', reason: 'integrity_error' }
  }
}
