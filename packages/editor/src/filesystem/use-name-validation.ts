import { useEffect, useRef, useState } from 'react'
import debounce from 'lodash-es/debounce'
import { validateItemName } from '../workspace/items'
import type { ValidationResult } from '../workspace/items'
import type { SidebarItemId } from '../../../../shared/common/ids'

const NAME_VALIDATION_DEBOUNCE_MS = 300

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

export function useNameValidation({
  name,
  initialName,
  isActive,
  parentId,
  excludeId,
  validateName,
}: UseNameValidationOptions) {
  const [debouncedName, setDebouncedName] = useState(name)
  const debouncedSetNameRef = useRef(
    debounce((value: string) => {
      setDebouncedName(value)
    }, NAME_VALIDATION_DEBOUNCE_MS),
  )

  useEffect(() => {
    const debouncedFn = debouncedSetNameRef.current
    debouncedFn(name)
    return () => {
      debouncedFn.cancel()
    }
  }, [name])

  const trimmedName = name.trim()
  const trimmedDebouncedName = debouncedName.trim()
  const trimmedInitialName = initialName.trim()

  const checkFormat = (trimmed: string) => {
    if (trimmed === trimmedInitialName) return { valid: true as const, error: undefined }
    return validateItemName(trimmed)
  }

  const checkUniqueness = (trimmed: string) => {
    if (trimmed === trimmedInitialName) return { valid: true as const, error: undefined }
    if (validateName) return validateName(trimmed, parentId, excludeId)
    return { valid: true as const, error: undefined }
  }

  const isPendingDebounce = trimmedName !== trimmedDebouncedName

  const nameValidation = isActive
    ? checkFormat(trimmedName)
    : { valid: true as const, error: undefined }

  const canValidateUniqueness = isActive && nameValidation.valid && !isPendingDebounce

  const uniquenessValidation = canValidateUniqueness
    ? checkUniqueness(trimmedDebouncedName)
    : { valid: true as const, error: undefined }

  const isUnique = canValidateUniqueness && uniquenessValidation.valid
  const isNotUnique = canValidateUniqueness && !uniquenessValidation.valid

  const validationError = (() => {
    if (!nameValidation.valid) return nameValidation.error
    if (isNotUnique) return uniquenessValidation.error ?? 'Name is already in use'
    return undefined
  })()
  const hasError = !nameValidation.valid || isNotUnique

  const checkNameUnique = (nameToCheck: string): string | undefined => {
    if (!isActive) return undefined
    const trimmed = nameToCheck.trim()
    const formatResult = checkFormat(trimmed)
    if (!formatResult.valid) return formatResult.error ?? 'Invalid name'
    const uniqueResult = checkUniqueness(trimmed)
    return uniqueResult.valid ? undefined : (uniqueResult.error ?? 'Name is already in use')
  }

  return {
    debouncedName: trimmedDebouncedName,
    shouldValidate: isActive && !!trimmedName && trimmedName !== trimmedInitialName,
    isUnique,
    isNotUnique,
    checkNameUnique,
    validationError,
    hasError,
  }
}
