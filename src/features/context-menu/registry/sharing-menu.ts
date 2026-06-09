import { createElement } from 'react'
import { Eye, Share2 } from 'lucide-react'
import type { PermissionLevel } from 'shared/permissions/types'
import * as p from '../predicates'
import type {
  ContextMenuCommand,
  ContextMenuContributor,
  ContextMenuItemSpec,
  EditorContextMenuServices,
  EditorMenuContext,
  ViewAsPlayerMenuService,
} from '../types'
import { ViewAsPlayerRow } from '~/features/editor/components/view-as-player-row'
import { getCampaignMemberDisplayName } from '~/shared/utils/user-display-name'

type EditorContextMenuItem = ContextMenuItemSpec<EditorMenuContext, EditorContextMenuServices>
type EditorContextMenuContributor = ContextMenuContributor<
  EditorMenuContext,
  EditorContextMenuServices
>

function createViewAsPlayerItems(
  services: EditorContextMenuServices,
): Array<EditorContextMenuItem> {
  return services.viewAsPlayer.playerMembers.map((member, index) => ({
    id: `view-as-player-${index}`,
    commandId: 'setViewAsPlayer',
    payload: member._id,
    label: getCampaignMemberDisplayName(member),
    content: createElement(ViewAsPlayerRow, { member }),
    group: 'view-as-player',
    priority: index,
    isChecked: (_context, itemServices, playerId) =>
      itemServices.viewAsPlayer.viewAsPlayerId === playerId,
    closeOnSelect: false,
  }))
}

export const sharingContextMenuCommands = {
  setGeneralAccessLevel: {
    id: 'setGeneralAccessLevel',
    run: (context, services, payload) =>
      services.actions.sharing.setGeneralAccessLevel(
        context,
        (payload as PermissionLevel | null) ?? null,
      ),
  },
  setViewAsPlayer: {
    id: 'setViewAsPlayer',
    run: (_context, services, payload) => {
      const playerId = payload as ViewAsPlayerMenuService['viewAsPlayerId']
      services.viewAsPlayer.setViewAsPlayerId(
        services.viewAsPlayer.viewAsPlayerId === playerId ? undefined : playerId,
      )
    },
  },
} satisfies Record<string, ContextMenuCommand<EditorMenuContext, EditorContextMenuServices>>

export const sharingContextMenuContributors = [
  {
    id: 'editor-share',
    surfaces: ['sidebar', 'folder-view', 'favorites', 'topbar'],
    getItems: (_shareContext, shareServices) => [
      {
        id: 'view-as-player',
        label: 'View as Player',
        icon: Eye,
        group: 'share',
        priority: 79,
        applies: (context, itemServices) =>
          p.inView('topbar')(context) &&
          p.isCampaignDm(context) &&
          p.isSidebarItem(context) &&
          itemServices.viewAsPlayer.playerMembers.length > 0,
        isChecked: (_itemContext, itemServices) =>
          itemServices.viewAsPlayer.viewAsPlayerId !== undefined,
        children: () => createViewAsPlayerItems(shareServices),
      },
      {
        id: 'share-items',
        label: (context) => {
          const itemCount = context.selectedItems?.length ?? 0
          return itemCount > 1 ? `Share ${itemCount} items...` : 'Share...'
        },
        icon: Share2,
        group: 'share',
        priority: 78,
        submenuContent: (context, services) =>
          services.sidebarItemSharing.renderSidebarItemsSharePanel(context.selectedItems ?? []),
        applies: (context) =>
          p.isDm(context) &&
          p.isSidebarItem(context) &&
          p.allSelectedItemsHaveFullAccess(context) &&
          p.allSelectedItemsNotTrashed(context) &&
          !p.hasPinContext(context),
      },
    ],
  },
] satisfies ReadonlyArray<EditorContextMenuContributor>
