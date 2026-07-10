import { WorkspaceSurface } from './surface'
import { TrashBanner } from '../filesystem/trash/banner'
import { FileTopbar } from './topbar/topbar'
import { createRuntimeFileTopbarSource } from './topbar/source'
import type { RuntimeFileTopbarSourceInput } from './topbar/source'
import { RIGHT_SIDEBAR_CONTENT } from './right-sidebar/content'
import { getRightSidebarAvailablePanels } from './right-sidebar/source'
import type { RightSidebarSource } from './right-sidebar/source'
import type { CurrentItemState } from './runtime'
import type { WorkspaceViewStateStores } from './runtime-host'
import { createRuntimeTrashSource } from '../filesystem/trash/runtime-source'
import type { RuntimeTrashSourceInput } from '../filesystem/trash/runtime-source'
import { RightSidebarContainer } from './right-sidebar/container'
import type { WorkspaceRightSidebarControls } from './right-sidebar/controls'
import { WorkspaceRuntimeContent } from './runtime-content'
import type { WorkspaceRuntimeContentRuntime } from './runtime-content'

type RuntimeBannerInput = RuntimeTrashSourceInput & {
  filesystem: RuntimeTrashSourceInput['filesystem'] & {
    current: Pick<CurrentItemState, 'availabilityState' | 'item'>
  }
}

type WorkspaceRuntimeGraphRuntime = WorkspaceRuntimeContentRuntime &
  RuntimeBannerInput &
  RuntimeFileTopbarSourceInput & {
    navigation: WorkspaceRuntimeContentRuntime['navigation'] &
      RuntimeBannerInput['navigation'] &
      RuntimeFileTopbarSourceInput['navigation']
    filesystem: WorkspaceRuntimeContentRuntime['filesystem'] &
      RuntimeBannerInput['filesystem'] &
      RuntimeFileTopbarSourceInput['filesystem']
  }

interface WorkspaceRuntimeGraphProps {
  rightSidebar?: {
    source: RightSidebarSource
    state: WorkspaceRightSidebarControls
  }
  runtime: WorkspaceRuntimeGraphRuntime
  viewStateStores: WorkspaceViewStateStores
}

export function WorkspaceRuntimeGraph({
  rightSidebar,
  runtime,
  viewStateStores,
}: WorkspaceRuntimeGraphProps) {
  const currentItem = runtime.filesystem.current.item
  const hasHistoryPanel = Boolean(
    rightSidebar &&
    getRightSidebarAvailablePanels(rightSidebar.source)[RIGHT_SIDEBAR_CONTENT.history],
  )
  const history = runtime.filesystem.history
  const historyControl =
    rightSidebar && history.status === 'available' && hasHistoryPanel
      ? {
          status: 'enabled' as const,
          onToggle: () => rightSidebar.state.toggle(RIGHT_SIDEBAR_CONTENT.history),
        }
      : { status: 'hidden' as const }

  return (
    <WorkspaceSurface
      topbar={
        <FileTopbar
          historyControl={historyControl}
          source={createRuntimeFileTopbarSource(runtime)}
        />
      }
      banner={<WorkspaceRuntimeBanner runtime={runtime} />}
      rightSidebar={
        rightSidebar && (
          <RightSidebarContainer
            item={currentItem}
            sidebar={rightSidebar.state}
            source={rightSidebar.source}
          />
        )
      }
    >
      <WorkspaceRuntimeContent runtime={runtime} viewStateStores={viewStateStores} />
    </WorkspaceSurface>
  )
}

function WorkspaceRuntimeBanner({ runtime }: { runtime: RuntimeBannerInput }) {
  const { availabilityState, item } = runtime.filesystem.current
  if (availabilityState.status !== 'available' || !item || !item.isTrashed) return null
  return <TrashBanner item={item} source={createRuntimeTrashSource(runtime)} />
}
