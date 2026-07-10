import { createContext } from 'react'
import type { SearchDialogRequestState } from '../search/dialog-controller'

export const WorkspaceRuntimeSearchRequestContext = createContext<SearchDialogRequestState | null>(
  null,
)
