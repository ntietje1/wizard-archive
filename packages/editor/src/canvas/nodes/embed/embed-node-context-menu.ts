import { SquareArrowOutUpRight } from 'lucide-react'
import type {
  CanvasContextMenuContributor,
  CanvasEmbedNodeTarget,
} from '../../runtime/context-menu/canvas-context-menu-types'

interface CreateEmbedNodeContextMenuContributorOptions {
  canOpenEmbedTarget: (target: CanvasEmbedNodeTarget) => boolean
  openEmbedTarget: (target: CanvasEmbedNodeTarget) => Promise<boolean>
}

export function createEmbedNodeContextMenuContributor({
  canOpenEmbedTarget,
  openEmbedTarget,
}: CreateEmbedNodeContextMenuContributorOptions): CanvasContextMenuContributor {
  return {
    id: 'embed-node-open',
    surfaces: ['canvas'],
    applies: (context) =>
      context.target.kind === 'embed-node' && canOpenEmbedTarget(context.target),
    getItems: (context) => {
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
          onSelect: async () => {
            await openEmbedTarget(target)
          },
        },
      ]
    },
  }
}
