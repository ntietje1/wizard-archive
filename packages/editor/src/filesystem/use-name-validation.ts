import { validateItemName } from '../workspace/items'
import type { ValidationResult } from '../workspace/items'
import type { SidebarItemId } from '../../../../shared/common/ids'

interface UseNameValidationOptions {
  name: string
  initialName: string
  isActive: boolean
  parentId: SidebarItemId | null
  excludeId?: SidebarItemId
  validateName?: (
    name: string,
    parentId: SidebarItemId | null,
    excludeId?: SidebarItemId,
  ) => ValidationResult
}

export function useNameValidation({ name, initialName, isActive }: UseNameValidationOptions) {
  const validation = isActive ? validateItemName(name) : { valid: true as const }
  const validationError = validation.valid ? undefined : validation.error

  return {
    debouncedName: name,
    shouldValidate: isActive && name !== initialName,
    isUnique: validation.valid,
    isNotUnique: false,
    checkNameUnique: (value: string) => {
      if (!isActive) return undefined
      const result = validateItemName(value)
      return result.valid ? undefined : result.error
    },
    validationError,
    hasError: !validation.valid,
  }
}
