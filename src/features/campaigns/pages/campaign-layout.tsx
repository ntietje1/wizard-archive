import { Outlet, useRouteContext } from '@tanstack/react-router'
import { CampaignProvider } from '~/features/campaigns/contexts/campaign-context'
import { SidebarItemsProvider } from '~/features/sidebar/contexts/all-sidebar-items-provider'
import { SidebarLayout } from '~/features/sidebar/components/sidebar-layout'
import { DndProvider } from '~/features/dnd/contexts/dnd-provider'
import { ViewAsBanner } from '~/features/editor/components/view-as-banner'
import { ErrorBoundary } from '~/shared/components/error-boundary'
import { ErrorFallback } from '~/shared/components/error-fallback'

export function CampaignLayout() {
  const { initialSidebarWidth, initialSidebarExpanded } = useRouteContext({
    from: '__root__',
  })

  return (
    <CampaignProvider>
      <SidebarItemsProvider>
        <DndProvider>
          <div className="flex flex-col flex-1 min-h-0">
            <SidebarLayout
              initialSidebarWidth={initialSidebarWidth}
              initialSidebarExpanded={initialSidebarExpanded}
            >
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
