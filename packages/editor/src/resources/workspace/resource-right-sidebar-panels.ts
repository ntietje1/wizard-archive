import { Clock3, FileText, Link2, List } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { EditorRuntime } from '../editor-runtime-contract'
import type { AuthorizedResourceSummary } from '../resource-index-contract'

export type ResourceRightSidebarPanel = 'details' | 'outline' | 'backlinks' | 'outgoing' | 'history'

export type ResourceRightSidebarPanelOption = Readonly<{
  id: ResourceRightSidebarPanel
  label: string
  icon: LucideIcon
  available: boolean
}>

export function resourceRightSidebarPanels(
  resource: AuthorizedResourceSummary,
  runtime: EditorRuntime,
): ReadonlyArray<ResourceRightSidebarPanelOption> {
  return [
    { id: 'details', label: 'Details', icon: FileText, available: true },
    { id: 'outline', label: 'Outline', icon: List, available: resource.kind === 'note' },
    {
      id: 'backlinks',
      label: 'Backlinks',
      icon: Link2,
      available: runtime.resources.references.status === 'available',
    },
    {
      id: 'outgoing',
      label: 'Outgoing links',
      icon: Link2,
      available: runtime.resources.references.status === 'available',
    },
    {
      id: 'history',
      label: 'History',
      icon: Clock3,
      available: runtime.history.status === 'available' && resource.permission === 'edit',
    },
  ]
}
