import { createElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { ResourceShell } from './resources/resource-shell'
import type { ResourceSort } from './resources/resource-shell'
import type { WizardEditorRuntime } from './resources/editor-runtime-contract'

export interface WizardEditorProps {
  ariaLabel: string
  runtime: WizardEditorRuntime
  resourcePanel?: 'visible' | 'hidden'
  resourcePanelSlots?: {
    footer?: ReactNode
    headerEnd?: ReactNode
    headerStart?: ReactNode
  }
  resourceSort?: ResourceSort
  workspaceName: string | null
}

export function WizardEditor(props: WizardEditorProps): ReactElement {
  return createElement(ResourceShell, {
    ariaLabel: props.ariaLabel,
    runtime: props.runtime,
    resourcePanelSlots: props.resourcePanelSlots,
    showResourcePanel: props.resourcePanel !== 'hidden',
    sort: props.resourceSort,
    workspaceName: props.workspaceName,
  })
}
