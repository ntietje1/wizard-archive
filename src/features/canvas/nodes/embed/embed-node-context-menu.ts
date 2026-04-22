import { SquareArrowOutUpRight } from 'lucide-react'
import type { CanvasContextMenuContributor } from '../../runtime/context-menu/canvas-context-menu-types'

export const embedNodeContextMenuContributors = [
  {
    id: 'embed-node-open',
    surfaces: ['canvas'],
    applies: (context, services) => services.canOpenEmbedSelection(context.selection),
    getItems: (context, services) => [
      {
        id: 'embed-node-open',
        label: 'Open',
        icon: SquareArrowOutUpRight,
        group: 'navigation',
        priority: 0,
        scope: 'selection',
        onSelect: async () => {
          await services.openEmbedSelection(context.selection)
        },
      },
    ],
  },
] satisfies ReadonlyArray<CanvasContextMenuContributor>
