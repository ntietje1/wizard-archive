import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
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
  const trimmedDebouncedName = debouncedName.trim()
  const trimmedInitialName = initialName.trim()
  const shouldValidate = useMemo(() => {
    if (!campaignId || !isActive) return false
    if (!trimmedDebouncedName) return false
    if (trimmedDebouncedName === trimmedInitialName) return false
    return true
  }, [campaignId, isActive, trimmedDebouncedName, trimmedInitialName])

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

  const isUnique = isUniqueQuery.data === true
  const isNotUnique = isUniqueQuery.data === false

  return {
    debouncedName: trimmedDebouncedName,
    shouldValidate,
    isUnique,
    isNotUnique,
    isLoading: isUniqueQuery.isLoading,
  }
}
