import { validateItemName } from '../items'
import type { CreateParentTarget, ValidationResult } from '../items'
import type { CreateParentTargetValidationSource } from './create-parent-target'
import { validateCreateParentTarget } from './create-parent-target'

export function validateCreateItemLocally(
  {
    name,
    parentTarget,
  }: {
    name: string
    parentTarget: CreateParentTarget
  },
  source: CreateParentTargetValidationSource,
): ValidationResult {
  const parentResult = validateCreateParentTarget(parentTarget, source)
  if (!parentResult.valid) {
    return parentResult
  }

  const nameResult = validateItemName(name)
  if (!nameResult.valid) {
    return nameResult
  }

  return { valid: true }
}
