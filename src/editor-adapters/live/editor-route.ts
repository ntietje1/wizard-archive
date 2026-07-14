export const EDITOR_ROUTE = '/campaigns/$campaignId/editor' as const
export const EDITOR_ROUTE_ID = `/_app/_authed${EDITOR_ROUTE}` as const

export function createEditorRoutePath({ campaignId }: { campaignId: string }) {
  return `/campaigns/${encodeURIComponent(campaignId)}/editor`
}
