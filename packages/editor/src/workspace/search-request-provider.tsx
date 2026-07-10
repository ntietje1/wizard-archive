import type { ReactNode, RefObject } from 'react'
import { WorkspaceRuntimeSearchRequestContext } from './search-request-context'
import { useLocalSearchDialogRequestState } from './search-request-state'

export function WorkspaceRuntimeSearchRequestProvider({
  children,
  scopeRef,
}: {
  children: ReactNode
  scopeRef: RefObject<HTMLElement | null>
}) {
  const request = useLocalSearchDialogRequestState({ enabled: true, scopeRef })

  return (
    <WorkspaceRuntimeSearchRequestContext.Provider value={request}>
      {children}
    </WorkspaceRuntimeSearchRequestContext.Provider>
  )
}
