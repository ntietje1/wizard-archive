import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { debounce } from 'lodash-es'
import { validateItemName } from 'convex/sidebarItems/sharedValidation'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import { useSidebarItemMutations } from '~/hooks/useSidebarItemMutations'

interface UseNameValidationOptions {
  name: string
  initialName: string
  isActive: boolean
  campaignId?: Id<'campaigns'>
  parentId: Id<'folders'> | null
  excludeId?: SidebarItemId
}

export function useNameValidation({
  name,
  initialName,
  isActive,
  campaignId,
  parentId,
  excludeId,
}: UseNameValidationOptions) {
  const { validateName } = useSidebarItemMutations()
  const [debouncedName, setDebouncedName] = useState(name)
  const debouncedSetNameRef = useRef(
    debounce((value: string) => {
      setDebouncedName(value)
    }, 300),
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

  const isPendingDebounce = trimmedName !== trimmedDebouncedName

  const nameValidation = useMemo(() => {
    if (!isActive) return { valid: true, error: undefined }
    if (trimmedName === trimmedInitialName)
      return { valid: true, error: undefined }
    return validateItemName(trimmedName)
  }, [isActive, trimmedName, trimmedInitialName])

  const uniquenessValidation = useMemo(() => {
    if (!isActive || !campaignId) return { valid: true }
    if (trimmedDebouncedName === trimmedInitialName) return { valid: true }
    return validateName(trimmedDebouncedName, parentId, excludeId)
  }, [
    isActive,
    campaignId,
    trimmedDebouncedName,
    trimmedInitialName,
    parentId,
    excludeId,
    validateName,
  ])

  const isResultValid = !isPendingDebounce
  const isUnique = isResultValid && uniquenessValidation.valid
  const isNotUnique = isResultValid && !uniquenessValidation.valid

  const validationError = useMemo(() => {
    if (!nameValidation.valid) return nameValidation.error
    if (isNotUnique)
      return uniquenessValidation.error ?? 'Name is already in use'
    return undefined
  }, [nameValidation, isNotUnique, uniquenessValidation.error])
  const hasError = !nameValidation.valid || isNotUnique

  const checkNameUnique = useCallback(
    (nameToCheck: string): string | undefined => {
      const trimmed = nameToCheck.trim()

      const nameResult = validateItemName(trimmed)
      if (!nameResult.valid) {
        return nameResult.error ?? 'Invalid name'
      }

      // Skip uniqueness check if not needed
      if (!campaignId || trimmed === trimmedInitialName) {
        return undefined
      }

      const result = validateName(trimmed, parentId, excludeId)
      return result.valid ? undefined : result.error
    },
    [campaignId, parentId, excludeId, trimmedInitialName, validateName],
  )

  return {
    debouncedName: trimmedDebouncedName,
    shouldValidate:
      isActive && !!trimmedName && trimmedName !== trimmedInitialName,
    isUnique,
    isNotUnique,
    checkNameUnique,
    validationError,
    hasError,
  }
}
