import { useEffect, useRef, useState } from 'react'
import debounce from 'lodash-es/debounce'
import { validateItemName, validateSidebarItemNameWithSiblings } from 'shared/sidebar-items/name'
import type { Id } from 'convex/_generated/dataModel'
import type { ValidationResult } from 'shared/sidebar-items/name'
import { useOptionalActiveSidebarItems } from '~/features/sidebar/contexts/sidebar-items-context'

const NAME_VALIDATION_DEBOUNCE_MS = 300

interface UseNameValidationOptions {
  name: string
  initialName: string
  isActive: boolean
  campaignId?: Id<'campaigns'>
  parentId: Id<'sidebarItems'> | null
  excludeId?: Id<'sidebarItems'>
  validateName?: (
    name: string,
    parentId: Id<'sidebarItems'> | null,
    excludeId?: Id<'sidebarItems'>,
  ) => ValidationResult
}

export function useNameValidation({
  name,
  initialName,
  isActive,
  campaignId,
  parentId,
  excludeId,
  validateName,
}: UseNameValidationOptions) {
  const activeSidebarItems = useOptionalActiveSidebarItems()
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
    if (!campaignId || trimmed === trimmedInitialName)
      return { valid: true as const, error: undefined }
    if (validateName) return validateName(trimmed, parentId, excludeId)
    if (!activeSidebarItems) return { valid: true as const, error: undefined }

    return validateSidebarItemNameWithSiblings(
      trimmed,
      activeSidebarItems.parentItemsMap.get(parentId) ?? [],
      excludeId,
    )
  }

  const isPendingDebounce = trimmedName !== trimmedDebouncedName

  const nameValidation = isActive
    ? checkFormat(trimmedName)
    : { valid: true as const, error: undefined }

  const uniquenessValidation = isActive
    ? checkUniqueness(trimmedDebouncedName)
    : { valid: true as const, error: undefined }

  const isResultValid = !isPendingDebounce
  const isUnique = isResultValid && uniquenessValidation.valid
  const isNotUnique = isResultValid && !uniquenessValidation.valid

  const validationError = (() => {
    if (!nameValidation.valid) return nameValidation.error
    if (isNotUnique) return uniquenessValidation.error ?? 'Name is already in use'
    return undefined
  })()
  const hasError = !nameValidation.valid || isNotUnique

  const checkNameUnique = (nameToCheck: string): string | undefined => {
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
