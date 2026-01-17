import { useCallback } from 'react'
import { useConvex } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useAllSidebarItems } from './useSidebarItems'
import { useCampaign } from './useCampaign'
import type { AnySidebarItem, SidebarItemId } from 'convex/sidebarItems/types'
import type { ValidationResult } from '~/lib/sidebar-validation'
import {
  checkNameConflict,
  validateNoCircularParent,
  validateSidebarItemName as validateSidebarItemNameSync,
  validateWikiLinkCompatibleName,
} from '~/lib/sidebar-validation'

export interface UseSidebarItemValidationOptions {
  enabled?: boolean
}

/**
 * Hook providing sidebar item validation utilities.
 * Combines sync validation (wiki-link, circular parent) with async validation (name uniqueness).
 *
 * Use this hook in any component that needs to validate sidebar item operations:
 * - Create: validateForCreate
 * - Update/Rename: validateForUpdate
 * - Move: validateForMove
 */
export function useSidebarItemValidation(
  options: UseSidebarItemValidationOptions = {},
) {
  const { enabled = true } = options
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id
  const convex = useConvex()
  const { itemsMap, parentItemsMap } = useAllSidebarItems(enabled)

  /**
   * Get siblings under a parent (items that share the same parentId).
   */
  const getSiblings = useCallback(
    (parentId: SidebarItemId | undefined): Array<AnySidebarItem> => {
      return parentItemsMap.get(parentId) ?? []
    },
    [parentItemsMap],
  )

  /**
   * Sync validation for wiki-link compatibility.
   * Can be used for immediate feedback while typing.
   */
  const validateWikiLink = useCallback(
    (name: string | undefined): ValidationResult => {
      return validateWikiLinkCompatibleName(name)
    },
    [],
  )

  /**
   * Sync validation for name conflicts using cached data.
   * Fast but may be slightly stale.
   */
  const validateNameConflictSync = useCallback(
    (
      name: string | undefined,
      parentId: SidebarItemId | undefined,
      excludeId?: SidebarItemId,
    ): ValidationResult => {
      const siblings = getSiblings(parentId)
      return checkNameConflict(name, siblings, excludeId)
    },
    [getSiblings],
  )

  /**
   * Sync validation for circular parent references.
   */
  const validateParentSync = useCallback(
    (
      itemId: SidebarItemId,
      newParentId: SidebarItemId | undefined,
    ): ValidationResult => {
      return validateNoCircularParent(itemId, newParentId, itemsMap)
    },
    [itemsMap],
  )

  /**
   * Combined sync validation for name (wiki-link + conflict check).
   */
  const validateNameSync = useCallback(
    (
      name: string | undefined,
      parentId: SidebarItemId | undefined,
      excludeId?: SidebarItemId,
    ): ValidationResult => {
      const siblings = getSiblings(parentId)
      return validateSidebarItemNameSync({ name, siblings, itemId: excludeId })
    },
    [getSiblings],
  )

  /**
   * Async validation for name. Returns error message string if invalid, undefined if valid.
   * Combines wiki-link validation with uniqueness check.
   */
  const validateNameAsync = useCallback(
    async (
      name: string | undefined,
      parentId: SidebarItemId | undefined,
      excludeId?: SidebarItemId,
    ): Promise<string | undefined> => {
      if (!campaignId) return undefined

      // First do sync wiki-link validation
      const wikiLinkResult = validateWikiLinkCompatibleName(name)
      if (!wikiLinkResult.valid) {
        return wikiLinkResult.error
      }

      // Then do async uniqueness check
      if (!name || name.trim() === '') {
        return undefined
      }

      const isUnique = await convex.query(
        api.sidebarItems.queries.checkUniqueNameUnderParent,
        { campaignId, parentId, name: name.trim(), excludeId },
      )

      return isUnique ? undefined : 'An item with this name already exists here'
    },
    [convex, campaignId],
  )

  /**
   * Validate for CREATE operation.
   * Checks name (wiki-link + uniqueness under parent).
   * Returns error message or undefined if valid.
   */
  const validateForCreate = useCallback(
    async (options: {
      name: string | undefined
      parentId: SidebarItemId | undefined
    }): Promise<string | undefined> => {
      const { name, parentId } = options
      return validateNameAsync(name, parentId)
    },
    [validateNameAsync],
  )

  /**
   * Validate for UPDATE/RENAME operation.
   * Checks name (wiki-link + uniqueness under parent), excluding current item.
   * Returns error message or undefined if valid.
   */
  const validateForUpdate = useCallback(
    async (options: {
      name: string | undefined
      parentId: SidebarItemId | undefined
      itemId: SidebarItemId
    }): Promise<string | undefined> => {
      const { name, parentId, itemId } = options
      return validateNameAsync(name, parentId, itemId)
    },
    [validateNameAsync],
  )

  /**
   * Validate for MOVE operation.
   * Checks circular parent reference and name conflict in new location.
   * Returns error message or undefined if valid.
   */
  const validateForMove = useCallback(
    async (options: {
      itemId: SidebarItemId
      newParentId: SidebarItemId | undefined
      itemName: string | undefined
    }): Promise<string | undefined> => {
      const { itemId, newParentId, itemName } = options

      // Check circular parent reference (sync)
      const parentResult = validateParentSync(itemId, newParentId)
      if (!parentResult.valid) {
        return parentResult.error
      }

      // Check name conflict in new location (async)
      const nameError = await validateNameAsync(itemName, newParentId, itemId)
      if (nameError) {
        return nameError
      }

      return undefined
    },
    [validateParentSync, validateNameAsync],
  )

  /**
   * Sync check if an item can be moved to a new parent.
   * Only checks circular reference, not name conflicts.
   * Use for drag-and-drop feedback.
   */
  const canMoveToParent = useCallback(
    (
      itemId: SidebarItemId,
      newParentId: SidebarItemId | undefined,
    ): boolean => {
      const result = validateParentSync(itemId, newParentId)
      return result.valid
    },
    [validateParentSync],
  )

  /**
   * Form validator function for name fields.
   * Returns error message or undefined if valid.
   * Use this in form field validators for async validation.
   */
  const createNameValidator = useCallback(
    (parentId: SidebarItemId | undefined, excludeId?: SidebarItemId) => {
      return async (name: string): Promise<string | undefined> => {
        return validateNameAsync(name, parentId, excludeId)
      }
    },
    [validateNameAsync],
  )

  return {
    // Raw utilities (for advanced use cases)
    itemsMap,
    getSiblings,

    // Low-level sync validation
    validateWikiLink,
    validateNameConflictSync,
    validateParentSync,
    validateNameSync,

    // Low-level async validation
    validateNameAsync,

    // High-level operation validators (RECOMMENDED)
    validateForCreate,
    validateForUpdate,
    validateForMove,

    // Convenience helpers
    canMoveToParent,
    createNameValidator,
  }
}
