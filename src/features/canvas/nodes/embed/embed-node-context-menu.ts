import { SquareArrowOutUpRight } from 'lucide-react'
import type { CanvasContextMenuContributor } from '../../runtime/context-menu/canvas-context-menu-types'

export const embedNodeContextMenuContributors = [
  {
    id: 'embed-node-open',
    surfaces: ['canvas'],
    applies: (context, services) => services.canOpenEmbedSelection(context.selection),
    getItems: () => [
      {
        id: 'embed-node-open',
        commandId: 'selection.open',
        label: 'Open',
        icon: SquareArrowOutUpRight,
        group: 'navigation',
        priority: 0,
        scope: 'selection',
      },
    ],
  },
] satisfies ReadonlyArray<CanvasContextMenuContributor>
