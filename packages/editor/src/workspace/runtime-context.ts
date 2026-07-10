import { createContext, createElement, use } from 'react'
import type { ReactNode } from 'react'
import type { WorkspaceRuntime } from './runtime'

const WorkspaceRuntimeContext = createContext<WorkspaceRuntime | null>(null)

export function WorkspaceRuntimeProvider({
  children,
  value,
}: {
  children: ReactNode
  value: WorkspaceRuntime
}) {
  return createElement(WorkspaceRuntimeContext.Provider, { value }, children)
}

export function useWorkspaceRuntime() {
  const runtime = use(WorkspaceRuntimeContext)
  if (!runtime) {
    throw new Error('useWorkspaceRuntime must be used within WorkspaceRuntimeProvider')
  }
  return runtime
}
