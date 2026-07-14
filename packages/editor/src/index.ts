import { createElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { ResourceShell } from './resources/resource-shell'
import type { ResourceShellSort } from './resources/resource-shell'
import type { WizardEditorRuntime } from './resources/editor-runtime-contract'

export interface WizardEditorProps {
  ariaLabel: string
  runtime: WizardEditorRuntime
  sidebar?: 'fixed' | 'none' | 'resizable'
  sidebarSlots?: {
    bottomPanel?: ReactNode
    railEndControls?: ReactNode
    railStartControls?: ReactNode
  }
  sidebarSort?: ResourceShellSort
  workspaceName: string | null
}

export function WizardEditor(props: WizardEditorProps): ReactElement {
  return createElement(ResourceShell, {
    ariaLabel: props.ariaLabel,
    runtime: props.runtime,
    sidebarSlots: props.sidebarSlots,
    showSidebar: props.sidebar !== 'none',
    sort: props.sidebarSort,
    workspaceName: props.workspaceName,
  })
}
