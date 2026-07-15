import { useEffect } from 'react'
import type { ResourceIndexLoader } from '@wizard-archive/editor/resources/index-contract'
import { useLiveWorkspaceSelectedResourceId } from './use-live-workspace-navigation'

export function LiveWorkspaceRouteEffects({
  resourceLoader,
}: {
  resourceLoader: ResourceIndexLoader
}) {
  const requestedResourceId = useLiveWorkspaceSelectedResourceId()
  useEffect(() => {
    if (requestedResourceId) {
      void resourceLoader.ensureResource(requestedResourceId)
    }
  }, [requestedResourceId, resourceLoader])

  return null
}
