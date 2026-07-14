import type { Id } from '../_generated/dataModel'

type LegacyEmbedProps = {
  targetKind: 'sidebarItem'
  sidebarItemId: Id<'sidebarItems'>
  [key: string]: unknown
}

export function isLegacySidebarItemEmbedProps(value: unknown): value is LegacyEmbedProps {
  return (
    typeof value === 'object' &&
    value !== null &&
    'targetKind' in value &&
    value.targetKind === 'sidebarItem' &&
    'sidebarItemId' in value &&
    typeof value.sidebarItemId === 'string'
  )
}

export function getResourceEmbedPropsMigrationPatch(
  props: LegacyEmbedProps,
  resourceId: string | null,
) {
  const { sidebarItemId: _sidebarItemId, ...sharedProps } = props
  if (!resourceId) return { ...sharedProps, targetKind: 'empty' as const }
  return { ...sharedProps, targetKind: 'resource' as const, resourceId }
}
