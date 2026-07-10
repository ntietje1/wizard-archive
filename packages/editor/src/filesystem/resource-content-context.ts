import { createContext, createElement, useContext, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { SidebarItemId } from '../../../../shared/common/ids'
import type { ResourceContentSource, ResourceContentState } from './resource-content-source'

const DEFAULT_RESOURCE_CONTENT_SOURCE: ResourceContentSource = {
  status: 'unsupported',
  reason: 'not_available',
}

const ResourceContentSourceContext = createContext<ResourceContentSource>(
  DEFAULT_RESOURCE_CONTENT_SOURCE,
)

export function ResourceContentSourceProvider({
  children,
  source,
}: {
  children: ReactNode
  source: ResourceContentSource
}) {
  return createElement(ResourceContentSourceContext.Provider, { value: source }, children)
}

function useResourceContentSource(): ResourceContentSource {
  return useContext(ResourceContentSourceContext)
}

export function useResourceContentState(
  itemId: SidebarItemId | null | undefined,
  fallbackLabel?: string,
): ResourceContentState {
  const source = useResourceContentSource()

  useEffect(() => {
    if (source.status !== 'available') return
    source.ensureContentState(itemId)
  }, [itemId, source])

  const unavailableState = useMemo(
    () =>
      source.status === 'unsupported'
        ? createUnsupportedResourceContentState(fallbackLabel, source.reason)
        : null,
    [fallbackLabel, source],
  )

  if (source.status !== 'available') return unavailableState!
  return source.getContentState(itemId, fallbackLabel)
}

function createUnsupportedResourceContentState(
  fallbackLabel: string | undefined,
  reason: Extract<ResourceContentSource, { status: 'unsupported' }>['reason'],
): ResourceContentState {
  return {
    status: 'unsupported',
    reason,
    label: fallbackLabel ?? 'Page',
    item: undefined,
    folderChildren: [],
    isLoading: false,
    error: null,
  }
}
