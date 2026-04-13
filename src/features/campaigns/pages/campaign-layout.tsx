import { ClientOnly, Outlet, useRouteContext } from '@tanstack/react-router'
import { CampaignProvider } from '~/features/campaigns/contexts/campaign-context'
import { SidebarItemsProvider } from '~/features/sidebar/contexts/all-sidebar-items-provider'
import { SidebarLayout } from '~/features/sidebar/components/sidebar-layout'
import { DndProvider } from '~/features/dnd/contexts/dnd-provider'
import { ViewAsBanner } from '~/features/editor/components/view-as-banner'
import { ErrorBoundary } from '~/shared/components/error-boundary'
import { ErrorFallback } from '~/shared/components/error-fallback'
import { SearchDialog } from '~/features/search/components/search-dialog'

export function CampaignLayout() {
  const { initialPanelPreferences } = useRouteContext({
    from: '__root__',
  })

  return (
    <CampaignProvider>
      <SidebarItemsProvider>
        <DndProvider>
          <ClientOnly fallback={null}>
            <SearchDialog />
          </ClientOnly>
          <div className="flex flex-col flex-1 min-h-0">
            <SidebarLayout initialPanel={initialPanelPreferences?.['left-sidebar'] ?? null}>
              <ErrorBoundary FallbackComponent={ErrorFallback}>
                <Outlet />
              </ErrorBoundary>
            </SidebarLayout>
            <ViewAsBanner />
          </div>
        </DndProvider>
      </SidebarItemsProvider>
    </CampaignProvider>
  )
}
