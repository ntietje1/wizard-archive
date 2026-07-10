import { validateResourceItemNameWithSiblings } from '../../items'
import type { ValidationResult } from '../../items'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
import { useWorkspaceRuntime } from '../../runtime-context'

export function useSidebarNameValidator() {
  const runtime = useWorkspaceRuntime()

  return (
    name: string,
    parentId: SidebarItemId | null,
    excludeId?: SidebarItemId,
  ): ValidationResult => {
    return validateResourceItemNameWithSiblings(
      name,
      runtime.filesystem.catalog.getVisibleChildren(parentId),
      excludeId,
    )
  }
}
