import { useEffect, useRef } from 'react'
import { canonicalTargetsEqual } from '@wizard-archive/editor/resources/authored-destination'
import type { ResourceNavigation } from '@wizard-archive/editor/resources/editor-runtime-contract'
import type { CanonicalTarget } from '@wizard-archive/editor/resources/authored-destination-contract'
import {
  useLiveWorkspaceNavigation,
  useLiveWorkspaceSelectedTarget,
} from '../use-live-workspace-navigation'

export function useLiveResourceNavigation(): ResourceNavigation {
  const selectedTarget = useLiveWorkspaceSelectedTarget()
  const { navigateToTarget } = useLiveWorkspaceNavigation()
  const selectedRef = useRef(selectedTarget)
  const navigateRef = useRef(navigateToTarget)
  const listenersRef = useRef(new Set<() => void>())
  const navigationRef = useRef<ResourceNavigation>(null)

  navigationRef.current ??= {
    current: () => selectedRef.current,
    open: (target: CanonicalTarget) => void navigateRef.current(target),
    subscribe: (listener) => {
      listenersRef.current.add(listener)
      return () => listenersRef.current.delete(listener)
    },
  }

  useEffect(() => {
    navigateRef.current = navigateToTarget
  }, [navigateToTarget])

  useEffect(() => {
    if (
      selectedRef.current === null
        ? selectedTarget === null
        : selectedTarget !== null && canonicalTargetsEqual(selectedRef.current, selectedTarget)
    ) {
      return
    }
    selectedRef.current = selectedTarget
    for (const listener of listenersRef.current) listener()
  }, [selectedTarget])

  return navigationRef.current
}
