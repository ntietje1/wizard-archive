import { validateItemName } from '../../items'
import type { ValidationResult } from '../../items'
import type { SidebarItemId } from '../../../../../../shared/common/ids'

export function useSidebarNameValidator() {
  return (
    name: string,
    _parentId: SidebarItemId | null,
    _excludeId?: SidebarItemId,
  ): ValidationResult => {
    return validateItemName(name)
  }
}
