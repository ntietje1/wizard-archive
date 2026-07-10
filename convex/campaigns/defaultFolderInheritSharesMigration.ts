export function getCampaignDefaultFolderInheritSharesMigrationPatch(campaign: {
  defaultFolderInheritShares?: boolean | null
}): { defaultFolderInheritShares: null } | null {
  return campaign.defaultFolderInheritShares === undefined
    ? { defaultFolderInheritShares: null }
    : null
}
