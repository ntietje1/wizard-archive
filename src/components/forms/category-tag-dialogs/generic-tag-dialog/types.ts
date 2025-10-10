import type { TagCategory } from "convex/tags/types"
import { getCategoryIcon } from "~/lib/category-icons"
import type { TagCategoryConfig } from "../base-tag-dialog/types"

export const createConfig = (category: TagCategory): TagCategoryConfig => {
  return {
    singular: category.displayName,
    plural: category.pluralDisplayName,
    icon: getCategoryIcon(category.iconName),
    categorySlug: category.slug,
  }
}