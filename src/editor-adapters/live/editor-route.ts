export const EDITOR_ROUTE = '/campaigns/$dmUsername/$campaignSlug/editor' as const
export const EDITOR_ROUTE_ID = `/_app/_authed${EDITOR_ROUTE}` as const

export function createEditorRoutePath({
  campaignSlug,
  dmUsername,
}: {
  campaignSlug: string
  dmUsername: string
}) {
  return `/campaigns/${encodeURIComponent(dmUsername)}/${encodeURIComponent(campaignSlug)}/editor`
}
