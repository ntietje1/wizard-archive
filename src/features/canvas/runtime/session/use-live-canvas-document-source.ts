import { useEffect } from 'react'
import { api } from 'convex/_generated/api'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { useCanvasToolStore } from '../../stores/canvas-tool-store'
import type { CanvasWithContent } from 'shared/canvases/types'
import { useConvexYjsCollaboration } from '~/features/editor/hooks/useConvexYjsCollaboration'
import { useResolvedTheme } from '~/shared/theme/context'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { useCampaignActorPermissions } from '~/features/campaigns/hooks/useCampaignActorPermissions'
import type {
  CanvasDocumentEdge,
  CanvasDocumentNode,
} from '~/features/canvas/domain/canvas-document'
import type { CanvasDocumentSource } from './canvas-document-source'

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

export function useLiveCanvasDocumentSource(canvas: CanvasWithContent): CanvasDocumentSource {
  const profileQuery = useAuthQuery(api.users.queries.getUserProfile, {})
  const profile = profileQuery.data
  const resolvedTheme = useResolvedTheme()
  const actorPermissions = useCampaignActorPermissions()

  const canEdit = actorPermissions.canMutate(canvas, PERMISSION_LEVEL.EDIT)
  const userName = profile?.name ?? profile?.username ?? 'Anonymous'
  const userColor = profile ? getCursorColor(profile._id) : '#61afef'

  const { doc, provider, isLoading, error } = useConvexYjsCollaboration(
    canvas._id,
    { name: userName, color: userColor },
    canEdit,
  )

  const nodesMap = doc ? doc.getMap<CanvasDocumentNode>('nodes') : null
  const edgesMap = doc ? doc.getMap<CanvasDocumentEdge>('edges') : null
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

  if (profileQuery.isLoading || isLoading || !doc || !nodesMap || !edgesMap) {
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
