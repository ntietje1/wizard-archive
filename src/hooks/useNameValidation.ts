import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery, useConvex } from '@convex-dev/react-query'
import { debounce } from 'lodash-es'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemId } from 'convex/sidebarItems/types'

interface UseNameValidationOptions {
  name: string
  initialName: string
  isActive: boolean
  campaignId?: Id<'campaigns'>
  parentId?: SidebarItemId
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
  const convex = useConvex()
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

  const shouldValidate = useMemo(() => {
    if (!campaignId || !isActive) return false
    if (!trimmedDebouncedName) return false
    if (trimmedDebouncedName === trimmedInitialName) return false
    return true
  }, [campaignId, isActive, trimmedDebouncedName, trimmedInitialName])

  // Also check if we should validate based on current (non-debounced) name
  // This is used to determine if we should show loading state
  const willValidate = useMemo(() => {
    if (!campaignId || !isActive) return false
    if (!trimmedName) return false
    if (trimmedName === trimmedInitialName) return false
    return true
  }, [campaignId, isActive, trimmedName, trimmedInitialName])

  // Check uniqueness
  const isUniqueQuery = useQuery(
    convexQuery(
      api.sidebarItems.queries.checkUniqueNameUnderParent,
      shouldValidate && campaignId
        ? {
            campaignId,
            parentId,
            name: trimmedDebouncedName,
            excludeId,
          }
        : 'skip',
    ),
  )

  // Only consider query result valid if the debounced name matches current name
  // This prevents showing stale error messages while typing
  const isResultValid = !isPendingDebounce && shouldValidate
  const isUnique = isResultValid && isUniqueQuery.data === true
  const isNotUnique = isResultValid && isUniqueQuery.data === false

  // Show loading if:
  // - Query is loading OR
  // - We're waiting for debounce to catch up (and will trigger validation)
  const isLoading =
    (shouldValidate && isUniqueQuery.isLoading) ||
    (willValidate && isPendingDebounce)

  // Async validation function for form validators
  const checkNameUnique = useCallback(
    async (nameToCheck: string): Promise<string | undefined> => {
      const trimmed = nameToCheck.trim()
      if (!campaignId || !trimmed || trimmed === trimmedInitialName) {
        return undefined
      }
      const isUnique = await convex.query(
        api.sidebarItems.queries.checkUniqueNameUnderParent,
        { campaignId, parentId, name: trimmed, excludeId },
      )
      return isUnique ? undefined : 'Name already taken'
    },
    [convex, campaignId, parentId, excludeId, trimmedInitialName],
  )

  return {
    debouncedName: trimmedDebouncedName,
    shouldValidate: willValidate,
    isUnique,
    isNotUnique,
    isLoading,
    checkNameUnique,
  }
}
