import { SquareArrowOutUpRight } from 'lucide-react'
import type { CanvasContextMenuContributor } from '../../runtime/context-menu/canvas-context-menu-types'

export const embedNodeContextMenuContributors = [
  {
    id: 'embed-node-open',
    surfaces: ['canvas'],
    applies: (context, services) =>
      context.target.kind === 'embed-node' && services.canOpenEmbedTarget(context.target),
    getItems: (context, services) => {
      if (context.target.kind !== 'embed-node') {
        return []
      }

      const target = context.target
      return [
        {
          id: 'embed-node-open',
          label: 'Open',
          icon: SquareArrowOutUpRight,
          group: 'navigation',
          priority: 0,
          scope: 'selection',
          onSelect: async () => {
            await services.openEmbedTarget(target)
          },
        },
      ]
    },
  },
] satisfies ReadonlyArray<CanvasContextMenuContributor>
