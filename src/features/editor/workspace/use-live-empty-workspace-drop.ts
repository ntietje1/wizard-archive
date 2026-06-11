import { useRef } from 'react'
import { EMPTY_EDITOR_DROP_TYPE } from '~/features/dnd/utils/drop-target-data'
import { useDndDropTarget } from '~/features/dnd/hooks/useDndDropTarget'
import { useExternalDropTarget } from '~/features/dnd/hooks/useExternalDropTarget'
import type { EditorWorkspaceSource } from './editor-workspace-source'

export function useLiveEmptyWorkspaceDropCapability(): EditorWorkspaceSource['items']['emptyWorkspaceDrop'] {
  const ref = useRef<HTMLDivElement>(null)
  const dropData = { type: EMPTY_EDITOR_DROP_TYPE } as const

  const { isDropTarget } = useDndDropTarget({
    ref,
    data: dropData,
    highlightId: EMPTY_EDITOR_DROP_TYPE,
  })

  const { isFileDropTarget } = useExternalDropTarget({
    ref,
    data: dropData,
    canAcceptFiles: true,
  })

  return {
    status: 'enabled',
    accepts: {
      externalFiles: true,
      sidebarItems: true,
    },
    target: {
      ref,
      isFileDropTarget,
      isSidebarItemDropTarget: isDropTarget,
    },
  }
}
