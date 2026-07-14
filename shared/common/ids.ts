type SharedId<TableName extends string> = string & { __tableName: TableName }

export type CampaignId = SharedId<'campaigns'>
export type CampaignMemberId = SharedId<'campaignMembers'>
export type WorkspaceMemberId = SharedId<'campaignMembers'>
export type SessionRowId = SharedId<'sessions'>
export type SidebarItemId = SharedId<'sidebarItems'>
export type UserProfileId = SharedId<'userProfiles'>
