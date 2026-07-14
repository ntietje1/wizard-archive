import { normalizeLegacyResourcePathSegment } from './resourcePathSegment'

export function getSidebarItemNormalizedNameMigrationPatch(item: {
  name: string
  normalizedName?: string
}): { normalizedName: string } | undefined {
  const normalizedName = normalizeLegacyResourcePathSegment(item.name)
  return item.normalizedName === normalizedName ? undefined : { normalizedName }
}
