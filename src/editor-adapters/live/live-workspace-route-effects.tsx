import { useEffect } from 'react'
import type { ResourceIndexLoader } from '@wizard-archive/editor/resources/index-contract'
import { useLiveWorkspaceSelectedTarget } from './use-live-workspace-navigation'

export function LiveWorkspaceRouteEffects({
  resourceLoader,
}: {
  resourceLoader: ResourceIndexLoader
}) {
  const requestedTarget = useLiveWorkspaceSelectedTarget()
  const requestedResourceId = requestedTarget?.resourceId ?? null
  useEffect(() => {
    if (requestedResourceId) {
      void resourceLoader.ensureResource(requestedResourceId)
    }
  }, [requestedResourceId, resourceLoader])

  return null
}
