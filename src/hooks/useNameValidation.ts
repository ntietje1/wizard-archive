import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { debounce } from 'lodash-es'
import { useSidebarItemMutations } from '~/hooks/useSidebarItemMutations'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemId } from 'convex/sidebarItems/baseTypes'
import { validateWikiLinkCompatibleName } from '~/lib/sidebar-validation'

interface UseNameValidationOptions {
  name: string
  initialName: string
  isActive: boolean
  campaignId?: Id<'campaigns'>
  parentId?: Id<'folders'>
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

  // Debounce name for validation
  useEffect(() => {
    const debouncedFn = debouncedSetNameRef.current
    debouncedFn(name)
    return () => {
      debouncedFn.cancel()
    }
  }, [name])

  // Determine if we should validate
  const trimmedName = name.trim()
  const trimmedDebouncedName = debouncedName.trim()
  const trimmedInitialName = initialName.trim()

  // Check if current typed name differs from debounced name (pending new validation)
  const isPendingDebounce = trimmedName !== trimmedDebouncedName

  // Wiki-link validation (sync, immediate feedback)
  const wikiLinkValidation = useMemo(() => {
    if (!isActive || !trimmedName) return { valid: true, error: undefined }
    return validateWikiLinkCompatibleName(trimmedName)
  }, [isActive, trimmedName])

  // Collection-based uniqueness validation (sync, after debounce)
  const uniquenessValidation = useMemo(() => {
    if (!isActive || !campaignId) return { valid: true }
    if (!trimmedDebouncedName) return { valid: true }
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

  // Only consider uniqueness result valid if the debounced name matches current name
  const isResultValid = !isPendingDebounce
  const isUnique = isResultValid && uniquenessValidation.valid
  const isNotUnique = isResultValid && !uniquenessValidation.valid

  // Combined validation error
  const validationError = useMemo(() => {
    if (!wikiLinkValidation.valid) return wikiLinkValidation.error
    if (isNotUnique) return uniquenessValidation.error
    return undefined
  }, [wikiLinkValidation, isNotUnique, uniquenessValidation.error])
  const hasError = !wikiLinkValidation.valid || isNotUnique

  // No async loading needed — validation is sync from collection
  const isLoading = false

  // Sync validation function for form validators (kept as async for interface compat)
  const checkNameUnique = useCallback(
    async (nameToCheck: string): Promise<string | undefined> => {
      const trimmed = nameToCheck.trim()

      // Check wiki-link compatibility
      const wikiLinkResult = validateWikiLinkCompatibleName(trimmed)
      if (!wikiLinkResult.valid) {
        return wikiLinkResult.error
      }

      // Skip uniqueness check if not needed
      if (!campaignId || !trimmed || trimmed === trimmedInitialName) {
        return undefined
      }

      // Check uniqueness from collection
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
    isLoading,
    checkNameUnique,
    validationError,
    hasError,
  }
}
