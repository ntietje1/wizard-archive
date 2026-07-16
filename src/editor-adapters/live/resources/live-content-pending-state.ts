import type {
  ContentPendingState,
  ContentUnavailableState,
} from '@wizard-archive/editor/resources/content-session-contract'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'

type BackendContentPendingState =
  | ContentUnavailableState
  | Readonly<{ status: 'initializing'; operationId: string }>

export function liveContentPendingState(state: BackendContentPendingState): ContentPendingState {
  if (state.status !== 'initializing') return state
  try {
    return {
      status: 'initializing',
      operationId: assertDomainId(DOMAIN_ID_KIND.operation, state.operationId),
    }
  } catch {
    return { status: 'integrity_error', issue: 'content_corrupt' }
  }
}
