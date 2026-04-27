import { useEffect } from 'react'
import { api } from 'convex/_generated/api'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { hasAtLeastPermissionLevel } from 'convex/permissions/hasAtLeastPermissionLevel'
import { useCanvasToolStore } from '../../stores/canvas-tool-store'
import type {
  CanvasEdge as Edge,
  CanvasNode as Node,
} from '~/features/canvas/types/canvas-domain-types'
import type * as Y from 'yjs'
import type { CanvasWithContent } from 'convex/canvases/types'
import { useConvexYjsCollaboration } from '~/features/editor/hooks/useConvexYjsCollaboration'
import { useResolvedTheme } from '~/features/settings/hooks/useTheme'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'

const CURSOR_COLORS = [
  '#e06c75',
  '#e5c07b',
  '#98c379',
  '#56b6c2',
  '#61afef',
  '#c678dd',
  '#d19a66',
  '#be5046',
]

function getCursorColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length]
}

export type CanvasViewerSession =
  | { status: 'loading' }
  | { status: 'error'; error: Error | string }
  | {
      status: 'ready'
      canvasId: CanvasWithContent['_id']
      campaignId: CanvasWithContent['campaignId']
      canEdit: boolean
      colorMode: 'light' | 'dark'
      parentId: CanvasWithContent['parentId']
      provider: ReturnType<typeof useConvexYjsCollaboration>['provider']
      user: { name: string; color: string }
      doc: Y.Doc
      nodesMap: Y.Map<Node>
      edgesMap: Y.Map<Edge>
    }

export function useCanvasViewerSession(canvas: CanvasWithContent): CanvasViewerSession {
  const profileQuery = useAuthQuery(api.users.queries.getUserProfile, {})
  const profile = profileQuery.data
  const resolvedTheme = useResolvedTheme()

  const canEdit = hasAtLeastPermissionLevel(canvas.myPermissionLevel, PERMISSION_LEVEL.EDIT)
  const userName = profile?.name ?? profile?.username ?? 'Anonymous'
  const userColor = profile ? getCursorColor(profile._id) : '#61afef'

  const { doc, provider, isLoading, error } = useConvexYjsCollaboration(
    canvas._id,
    { name: userName, color: userColor },
    canEdit,
  )

  const nodesMap = doc ? doc.getMap<Node>('nodes') : null
  const edgesMap = doc ? doc.getMap<Edge>('edges') : null
  const user = { name: userName, color: userColor }

  useEffect(() => {
    return () => {
      useCanvasToolStore.getState().reset()
    }
  }, [canvas._id])

  if (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error : 'Failed to initialize canvas collaboration',
    }
  }

  if (profileQuery.isLoading || isLoading || !profile || !doc || !nodesMap || !edgesMap) {
    return { status: 'loading' }
  }

  return {
    status: 'ready',
    canvasId: canvas._id,
    campaignId: canvas.campaignId,
    canEdit,
    colorMode: resolvedTheme,
    parentId: canvas.parentId,
    provider,
    user,
    doc,
    nodesMap,
    edgesMap,
  }
}
