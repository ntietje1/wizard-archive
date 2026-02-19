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

  const wikiLinkValidation = useMemo(() => {
    if (!isActive || !trimmedName) return { valid: true, error: undefined }
    return validateWikiLinkCompatibleName(trimmedName)
  }, [isActive, trimmedName])

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

  const isResultValid = !isPendingDebounce
  const isUnique = isResultValid && uniquenessValidation.valid
  const isNotUnique = isResultValid && !uniquenessValidation.valid

  const validationError = useMemo(() => {
    if (!wikiLinkValidation.valid) return wikiLinkValidation.error
    if (isNotUnique) return uniquenessValidation.error
    return undefined
  }, [wikiLinkValidation, isNotUnique, uniquenessValidation.error])
  const hasError = !wikiLinkValidation.valid || isNotUnique

  const checkNameUnique = useCallback(
    async (nameToCheck: string): Promise<string | undefined> => {
      const trimmed = nameToCheck.trim()

      const wikiLinkResult = validateWikiLinkCompatibleName(trimmed)
      if (!wikiLinkResult.valid) {
        return wikiLinkResult.error
      }

      // Skip uniqueness check if not needed
      if (!campaignId || !trimmed || trimmed === trimmedInitialName) {
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
