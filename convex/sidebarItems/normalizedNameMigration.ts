import { normalizeResourceNameForComparison } from '@wizard-archive/editor/resources/resource-contract'

export function getSidebarItemNormalizedNameMigrationPatch(item: {
  name: string
  normalizedName?: string
}): { normalizedName: string } | undefined {
  const normalizedName = normalizeResourceNameForComparison(item.name)
  return item.normalizedName === normalizedName ? undefined : { normalizedName }
}
