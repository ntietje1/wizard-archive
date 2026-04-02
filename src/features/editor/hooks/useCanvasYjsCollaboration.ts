import { useConvexYjsCollaboration } from './useConvexYjsCollaboration'
import type { Id } from 'convex/_generated/dataModel'

export function useCanvasYjsCollaboration(
  canvasId: Id<'canvases'>,
  user: { name: string; color: string },
  canEdit: boolean,
) {
  return useConvexYjsCollaboration(canvasId, user, canEdit)
}
