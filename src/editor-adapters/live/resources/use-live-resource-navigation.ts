import { useEffect, useRef } from 'react'
import type { ResourceNavigation } from '@wizard-archive/editor/resources/editor-runtime-contract'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import {
  useLiveWorkspaceNavigation,
  useLiveWorkspaceSelectedResourceId,
} from '../use-live-workspace-navigation'

export function useLiveResourceNavigation(): ResourceNavigation {
  const selectedResourceId = useLiveWorkspaceSelectedResourceId()
  const { navigateToResource } = useLiveWorkspaceNavigation()
  const selectedRef = useRef(selectedResourceId)
  const navigateRef = useRef(navigateToResource)
  const listenersRef = useRef(new Set<() => void>())
  const navigationRef = useRef<ResourceNavigation>(null)

  navigationRef.current ??= {
    current: () => selectedRef.current,
    open: (resourceId: ResourceId) => void navigateRef.current(resourceId),
    subscribe: (listener) => {
      listenersRef.current.add(listener)
      return () => listenersRef.current.delete(listener)
    },
  }

  useEffect(() => {
    navigateRef.current = navigateToResource
  }, [navigateToResource])

  useEffect(() => {
    if (selectedRef.current === selectedResourceId) return
    selectedRef.current = selectedResourceId
    for (const listener of listenersRef.current) listener()
  }, [selectedResourceId])

  return navigationRef.current
}
