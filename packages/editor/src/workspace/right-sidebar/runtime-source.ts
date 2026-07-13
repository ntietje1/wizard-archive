import { getProjectedNoteOutlineHeadings } from '../../notes/outline/note-outline'
import type { Heading } from '../../notes/document/model'
import type { NoteBlockId } from '../../resources/domain-id'
import * as rightSidebarSource from './source'
import type { CurrentItemState, WorkspaceNavigation } from '../runtime'
import type { CampaignMemberId, SidebarItemId } from '../../../../../shared/common/ids'
import type { AnyItemWithContent } from '../items'
import type { ResourceHistory } from '../../filesystem/history-types'
import type { ItemLinksCapability } from '../../filesystem/search'
import type { FileSystemPermissions } from '../../filesystem/permissions'
import type {
  ResourceContentSource,
  ResourceContentState,
} from '../../filesystem/resource-content-source'
import type { ViewAsParticipantCapability } from '../../sharing/contracts'

type RightSidebarAvailablePanels = rightSidebarSource.RightSidebarAvailablePanels
type RightSidebarOutlineSource = rightSidebarSource.RightSidebarOutlineSource
type RightSidebarOutlineState = rightSidebarSource.RightSidebarOutlineState
type RightSidebarSource = rightSidebarSource.RightSidebarSource

interface RuntimeRightSidebarOutlineBehavior {
  navigateToHeading: (noteBlockId: NoteBlockId) => void
}

type RuntimeRightSidebarCatalogSource = {
  getKnownItemById: (itemId: SidebarItemId) => unknown
}

type RuntimeRightSidebarSearchSource =
  | {
      status: 'unsupported'
      reason: 'not_available' | 'not_implemented'
    }
  | {
      status: 'available'
      itemLinks: ItemLinksCapability
    }

type RuntimeRightSidebarSourceInput = {
  navigation: {
    openItem: WorkspaceNavigation['openItem']
  }
  filesystem: {
    catalog: RuntimeRightSidebarCatalogSource
    current: CurrentItemState
    history: ResourceHistory
    permissions: Pick<FileSystemPermissions, 'canAccessItem' | 'getMemberItemPermissionLevel'>
    search: RuntimeRightSidebarSearchSource
    resourceContent: ResourceContentSource
    sharing: {
      viewAsParticipant: ViewAsParticipantCapability
    }
  }
}

type RuntimeRightSidebarPanelSourceInput = {
  filesystem: Pick<RuntimeRightSidebarSourceInput['filesystem'], 'current' | 'history' | 'search'>
}

type UnavailableOutlineAvailabilityState = Extract<
  RightSidebarOutlineState,
  { status: 'unavailable' }
>['availabilityState']

export function createRuntimeRightSidebarSource(
  runtime: RuntimeRightSidebarSourceInput,
  outlineBehavior: RuntimeRightSidebarOutlineBehavior,
): RightSidebarSource {
  const { permissions, resourceContent, sharing } = runtime.filesystem
  const panels = createRuntimeRightSidebarPanelSource(runtime)
  const selectedViewAsPlayerId =
    sharing.viewAsParticipant.status === 'available'
      ? (sharing.viewAsParticipant.selectedParticipantId as CampaignMemberId | undefined)
      : undefined

  return {
    ...panels,
    navigation: {
      openItem: runtime.navigation.openItem,
    },
    outline: createRightSidebarOutlineSource({
      getOutlineHeadings: (item) =>
        getProjectedNoteOutlineHeadings(item, {
          canAccessItem: permissions.canAccessItem,
          getMemberItemPermissionLevel: permissions.getMemberItemPermissionLevel,
          viewAsPlayerId: selectedViewAsPlayerId,
        }),
      getResourceContentState:
        resourceContent.status === 'available'
          ? resourceContent.getContentState
          : () => ({
              status: 'error' as const,
              label: 'Page',
              item: undefined,
              folderChildren: [],
              isLoading: false,
              error: new Error('Resource content is unavailable.'),
            }),
      navigateToHeading: outlineBehavior.navigateToHeading,
    }),
    resourceContent,
  }
}

export function getRuntimeRightSidebarAvailablePanels(
  runtime: RuntimeRightSidebarPanelSourceInput,
): RightSidebarAvailablePanels {
  return rightSidebarSource.getRightSidebarAvailablePanels(
    createRuntimeRightSidebarPanelSource(runtime),
  )
}

function createRuntimeRightSidebarPanelSource(
  runtime: RuntimeRightSidebarPanelSourceInput,
): Pick<RightSidebarSource, 'history' | 'itemLinks'> {
  const { current, history, search } = runtime.filesystem
  return {
    history:
      history.status === 'available' && current.item?.id === history.itemId
        ? createRightSidebarHistorySource(history)
        : { status: 'unavailable' },
    itemLinks:
      search.status === 'available'
        ? search.itemLinks
        : { status: 'unsupported', reason: search.reason },
  }
}

function createRightSidebarHistorySource(
  history: Extract<ResourceHistory, { status: 'available' }>,
): RightSidebarSource['history'] {
  return {
    status: 'available',
    itemId: history.itemId,
    entries: history.entries,
    previewEntry: history.previewEntry,
    requestRollback: history.requestRollback,
  }
}

function createRightSidebarOutlineSource({
  getOutlineHeadings,
  getResourceContentState,
  navigateToHeading,
}: {
  getOutlineHeadings: (item: AnyItemWithContent) => Array<Heading>
  getResourceContentState: (itemId: SidebarItemId) => ResourceContentState
  navigateToHeading: RuntimeRightSidebarOutlineBehavior['navigateToHeading']
}): RightSidebarOutlineSource {
  return {
    getOutlineState: (itemId) => {
      const state = getResourceContentState(itemId)
      if (state.status === 'loading') return { status: 'pending' }
      if (state.status === 'not_found') {
        return {
          status: 'unavailable',
          availabilityState: {
            status: 'not_found',
            label: state.label,
            message: `${state.label} was not found.`,
          },
        }
      }
      if (state.status === 'unavailable')
        return createUnavailableOutlineState(state.availabilityState)
      if (state.status !== 'ready') return { status: 'error' }
      return { status: 'success', headings: getOutlineHeadings(state.item) }
    },
    navigateToHeading,
  }
}

function createUnavailableOutlineState(
  availabilityState: UnavailableOutlineAvailabilityState,
): ReturnType<RightSidebarOutlineSource['getOutlineState']> {
  return { status: 'unavailable', availabilityState }
}
