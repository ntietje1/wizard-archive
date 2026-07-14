import { RIGHT_SIDEBAR_CONTENT } from './content'
import type { RightSidebarContentId } from './content'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import type { Heading } from '../../notes/document/model'
import type { HistoryEntryId, NoteBlockId } from '../../resources/domain-id'
import type { WorkspaceNavigation } from '../runtime'
import type { ResourceHistory } from '../../filesystem/history-types'
import type { ItemLinksCapability } from '../../filesystem/search'
import type { ResourceContentSource } from '../../filesystem/resource-content-source'
import type { ResourceAvailabilityState } from '../../filesystem/domain/availability-state'

type UnavailableOutlineAvailabilityState = Exclude<
  ResourceAvailabilityState,
  { status: 'available' | 'loading' }
>

type RightSidebarHistorySource =
  | {
      status: 'available'
      itemId: SidebarItemId
      entries: Extract<ResourceHistory, { status: 'available' }>['entries']
      previewEntry: (entryId: HistoryEntryId | null) => void
      requestRollback: (entryId: HistoryEntryId) => void
    }
  | {
      status: 'unavailable'
    }

export type RightSidebarOutlineState =
  | { status: 'pending' }
  | { status: 'error' }
  | { status: 'unavailable'; availabilityState: UnavailableOutlineAvailabilityState }
  | { status: 'success'; headings: Array<Heading> }

export interface RightSidebarOutlineSource {
  getOutlineState: (itemId: SidebarItemId) => RightSidebarOutlineState
  navigateToHeading: (noteBlockId: NoteBlockId) => void
}

export interface RightSidebarSource {
  history: RightSidebarHistorySource
  itemLinks: ItemLinksCapability
  navigation: {
    openItem: WorkspaceNavigation['openItem']
  }
  outline: RightSidebarOutlineSource
  resourceContent: ResourceContentSource
}

export type RightSidebarAvailablePanels = Partial<Record<RightSidebarContentId, true>>

export function getRightSidebarAvailablePanels(
  source: Pick<RightSidebarSource, 'history' | 'itemLinks'>,
): RightSidebarAvailablePanels {
  return {
    ...(source.history.status === 'available' ? { [RIGHT_SIDEBAR_CONTENT.history]: true } : {}),
    ...(source.itemLinks.status === 'available'
      ? {
          [RIGHT_SIDEBAR_CONTENT.backlinks]: true,
          [RIGHT_SIDEBAR_CONTENT.outgoing]: true,
        }
      : {}),
    [RIGHT_SIDEBAR_CONTENT.outline]: true,
  }
}
