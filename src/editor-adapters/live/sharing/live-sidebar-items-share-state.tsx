import { useLiveSidebarItemsShare } from './use-live-sidebar-items-share'
import type { WizardEditorItem } from '@wizard-archive/editor/adapter'
import type { ResourceShareOperations, ResourceShareState } from '@wizard-archive/editor/sharing'
import type { ReactNode } from 'react'

export function LiveSidebarItemsShareState({
  items,
  operations,
  render,
}: {
  items: Array<WizardEditorItem>
  operations: ResourceShareOperations
  render: (state: ResourceShareState) => ReactNode
}) {
  return render(useLiveSidebarItemsShare(items, operations))
}
