import type { Ref } from 'react'
import type { CanvasToolId } from '../../tools/canvas-tool-types'
import type { RemoteUser } from '../../utils/canvas-awareness-types'

export function getCanvasInteractionChrome({
  activeTool,
  dropTarget,
  remoteUsers,
  toolCursor,
}: {
  activeTool: CanvasToolId
  dropTarget: {
    overlayRef: Ref<HTMLDivElement>
    isTarget: boolean
    isFileTarget: boolean
  }
  remoteUsers: Array<RemoteUser>
  toolCursor: string | undefined
}) {
  return {
    toolCursor,
    remoteUsers,
    activeTool,
    dropTarget,
  }
}
