import { createElement } from 'react'
import { Eye, Share2 } from 'lucide-react'
import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import type { PermissionLevel } from '../../../../../shared/permissions/types'
import type { AnyItem } from '../items'
import type { ReactNode } from 'react'
import * as p from './predicates'
import * as selection from './selection'
import type {
  ContextMenuCommand,
  ContextMenuContributor,
  ContextMenuItemSpec,
} from '../../context-menu/types'
import type { WorkspaceMenuContext } from '../menu-context'
import { ViewAsPlayerRow } from '../topbar/view-as-player-row'
import type { EditorShareParticipant } from '../../sharing/contracts'

export interface WorkspaceSharingContextMenuActions {
  setGeneralAccessLevel: (
    context: WorkspaceMenuContext,
    level: PermissionLevel | null,
  ) => void | Promise<void>
}

type ViewAsPlayerMenuService =
  | { status: 'unsupported'; reason: string }
  | {
      status: 'available'
      viewAsPlayerId: EditorShareParticipant['id'] | undefined
      playerMembers: Array<EditorShareParticipant>
      setViewAsPlayerId: (playerId: EditorShareParticipant['id'] | undefined) => void
    }

type AvailableViewAsPlayerMenuService = Extract<ViewAsPlayerMenuService, { status: 'available' }>

type SidebarItemSharingMenuService =
  | { status: 'unsupported' }
  | {
      status: 'available'
      renderPanel: (items: Array<AnyItem>) => ReactNode
    }

export interface WorkspaceSharingContextMenuServices {
  actions: {
    sharing: WorkspaceSharingContextMenuActions
  }
  sidebarItemSharing: SidebarItemSharingMenuService
  viewAsPlayer: ViewAsPlayerMenuService
}

type WorkspaceSharingContextMenuItem = ContextMenuItemSpec<
  WorkspaceMenuContext,
  WorkspaceSharingContextMenuServices
>
type WorkspaceSharingContextMenuContributor = ContextMenuContributor<
  WorkspaceMenuContext,
  WorkspaceSharingContextMenuServices
>

const generalAccessLevels = new Set<PermissionLevel>(Object.values(PERMISSION_LEVEL))

function readGeneralAccessLevelPayload(payload: unknown): PermissionLevel | null | undefined {
  if (payload === null) return null
  if (generalAccessLevels.has(payload as PermissionLevel)) return payload as PermissionLevel
  return undefined
}

function createViewAsPlayerItems(
  viewAsPlayer: AvailableViewAsPlayerMenuService,
): Array<WorkspaceSharingContextMenuItem> {
  return viewAsPlayer.playerMembers.map((member, index) => ({
    id: `view-as-player-${index}`,
    commandId: 'setViewAsPlayer',
    payload: member.id,
    label: member.displayName,
    content: createElement(ViewAsPlayerRow, { member }),
    group: 'view-as-player',
    priority: index,
    isChecked: (_context, itemServices, playerId) =>
      itemServices.viewAsPlayer.status === 'available' &&
      itemServices.viewAsPlayer.viewAsPlayerId === playerId,
    closeOnSelect: false,
  }))
}

export const sharingContextMenuCommands = {
  setGeneralAccessLevel: {
    id: 'setGeneralAccessLevel',
    run: (context, services, payload) => {
      const level = readGeneralAccessLevelPayload(payload)
      if (level === undefined) {
        if (import.meta.env.DEV) {
          console.warn('setGeneralAccessLevel command requires a permission-level payload', {
            context,
            payload,
          })
        }
        return
      }
      return services.actions.sharing.setGeneralAccessLevel(context, level)
    },
  },
  setViewAsPlayer: {
    id: 'setViewAsPlayer',
    run: (_context, services, payload) => {
      if (services.viewAsPlayer.status !== 'available') return
      const playerId = services.viewAsPlayer.playerMembers.find(
        (member) => member.id === payload,
      )?.id
      if (!playerId) return
      services.viewAsPlayer.setViewAsPlayerId(
        services.viewAsPlayer.viewAsPlayerId === playerId ? undefined : playerId,
      )
    },
  },
} satisfies Record<
  string,
  ContextMenuCommand<WorkspaceMenuContext, WorkspaceSharingContextMenuServices>
>

export const sharingContextMenuContributors = [
  {
    id: 'editor-share',
    surfaces: ['sidebar', 'folder-view', 'favorites', 'topbar'],
    getItems: () => [
      {
        id: 'view-as-player',
        label: 'View as Player',
        icon: Eye,
        group: 'share',
        priority: 79,
        applies: (context, itemServices) =>
          p.inView('topbar')(context) &&
          itemServices.viewAsPlayer.status === 'available' &&
          p.isSidebarItem(context) &&
          itemServices.viewAsPlayer.playerMembers.length > 0,
        isChecked: (_itemContext, itemServices) =>
          itemServices.viewAsPlayer.status === 'available' &&
          itemServices.viewAsPlayer.viewAsPlayerId !== undefined,
        children: (_context, itemServices) =>
          itemServices.viewAsPlayer.status === 'available'
            ? createViewAsPlayerItems(itemServices.viewAsPlayer)
            : [],
      },
      {
        id: 'share-items',
        label: (context) => {
          const itemCount = context.selectedItems.length
          return itemCount > 1 ? `Share ${itemCount} items...` : 'Share...'
        },
        icon: Share2,
        group: 'share',
        priority: 78,
        submenuContent: (context, services) => {
          if (services.sidebarItemSharing.status !== 'available') return null
          return services.sidebarItemSharing.renderPanel(context.selectedItems)
        },
        applies: (context, itemServices) =>
          p.isSidebarItem(context) &&
          itemServices.sidebarItemSharing.status === 'available' &&
          selection.allSelectedItemsHaveFullAccess(context) &&
          selection.allSelectedItemsNotTrashed(context),
      },
    ],
  },
] satisfies ReadonlyArray<WorkspaceSharingContextMenuContributor>
