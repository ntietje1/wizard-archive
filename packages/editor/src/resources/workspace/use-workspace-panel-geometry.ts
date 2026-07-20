import { useState } from 'react'
import type { ResourceProjectionScope } from '../resource-index-contract'
import {
  DEFAULT_WORKSPACE_PANEL_GEOMETRY,
  loadWorkspacePanelGeometry,
  normalizeWorkspacePanelGeometry,
  saveWorkspacePanelGeometry,
} from '../workspace-panel-geometry'

export function useWorkspacePanelGeometry(scope: ResourceProjectionScope) {
  const [geometry, setGeometry] = useState(() =>
    typeof window === 'undefined'
      ? DEFAULT_WORKSPACE_PANEL_GEOMETRY
      : loadWorkspacePanelGeometry(window.localStorage, scope.campaignId, scope.actorId),
  )
  const setPanelSize = (panel: 'left' | 'right', size: number) => {
    const next = normalizeWorkspacePanelGeometry({ ...geometry, [panel]: size })
    setGeometry(next)
    if (typeof window !== 'undefined') {
      saveWorkspacePanelGeometry(window.localStorage, scope.campaignId, scope.actorId, next)
    }
  }
  return { geometry, setPanelSize }
}
