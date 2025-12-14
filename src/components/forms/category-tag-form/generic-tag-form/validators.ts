import { api } from 'convex/_generated/api'
import type { ConvexReactClient } from 'convex/react'
import type { Id } from 'convex/_generated/dataModel'
import { MAX_NAME_LENGTH } from '../base-tag-form/types'

export function validateTagDescription(
  value: string,
  maxLength: number,
): string | undefined {
  const v = value.trim()
  if (!v) return undefined
  if (v.length > maxLength)
    return `Description must be ${maxLength} characters or fewer`
  return undefined
}

export function validateTagName(
  value: string,
  maxLength: number,
): string | undefined {
  const v = value.trim()
  if (!v) return `Name is required`
  if (v.length > maxLength)
    return `Name must be ${maxLength} characters or fewer`
  return undefined
}

export async function validateTagNameAsync(
  convex: ConvexReactClient,
  campaignId: Id<'campaigns'>,
  categoryId: Id<'tagCategories'>,
  name: string,
  excludeTagId?: Id<'tags'>,
): Promise<string | undefined> {
  const syncErr = validateTagName(name, MAX_NAME_LENGTH)
  if (syncErr) return syncErr

  const exists = await convex.query(api.tags.queries.checkTagNameExists, {
    campaignId,
    categoryId,
    tagName: name.trim(),
    excludeTagId,
  })

  return exists ? 'This name is already taken.' : undefined
}
