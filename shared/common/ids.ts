type SharedId<TableName extends string> = string & { __tableName: TableName }

export type CampaignId = SharedId<'campaigns'>
export type AssetId = SharedId<'_storage'>
export type CampaignMemberId = SharedId<'campaignMembers'>
export type WorkspaceId = SharedId<'campaigns'>
export type WorkspaceMemberId = SharedId<'campaignMembers'>
export type EditHistoryId = SharedId<'editHistory'>
export type FileSystemTransactionId = SharedId<'filesystemTransactions'>
export type MapPinId = SharedId<'mapPins'>
export type SessionId = SharedId<'sessions'>
export type SidebarItemId = SharedId<'sidebarItems'>
export type SidebarItemShareId = SharedId<'sidebarItemShares'>
export type UserProfileId = SharedId<'userProfiles'>
