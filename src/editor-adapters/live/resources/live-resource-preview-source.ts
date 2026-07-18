import type { FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import { assertDomainId, DOMAIN_ID_KIND } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type {
  ResourcePreviewSource,
  ResourcePreviewState,
} from '@wizard-archive/editor/resources/editor-runtime-contract'
import { createResourcePreview } from '@wizard-archive/editor/resources/preview'
import { parseSafeHttpsUrl } from '@wizard-archive/editor/resources/authored-destination-contract'
import { createResourceWatchStore } from './resource-watch-store'

type StoredPreviewState = FunctionReturnType<typeof api.resources.queries.loadResourcePreview>

export function createLiveResourcePreviewSource(
  watch: (resourceId: ResourceId, apply: (state: StoredPreviewState) => void) => () => void,
): Readonly<{ source: ResourcePreviewSource; dispose(): void }> {
  const loading: ResourcePreviewState = { status: 'loading' }
  let store: ReturnType<typeof createResourceWatchStore<StoredPreviewState, ResourcePreviewState>>
  store = createResourceWatchStore<StoredPreviewState, ResourcePreviewState>(
    watch,
    (resourceId, state) => store.set(resourceId, readPreviewState(state)),
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

function readPreviewState(state: StoredPreviewState): ResourcePreviewState {
  if (state.status === 'unavailable') return state
  try {
    const imageUrl = state.imageUrl === null ? null : parseSafeHttpsUrl(state.imageUrl)
    if (state.imageUrl !== null && imageUrl === null) {
      throw new TypeError('Resource preview image URL is not safe')
    }
    return {
      status: 'ready',
      preview: createResourcePreview(
        state.preview.kind,
        state.preview.excerpt,
        state.preview.outline.map((heading) => ({
          ...heading,
          blockId: assertDomainId(DOMAIN_ID_KIND.noteBlock, heading.blockId),
        })),
      ),
      imageUrl,
    }
  } catch {
    return { status: 'unavailable', reason: 'integrity_error' }
  }
}
