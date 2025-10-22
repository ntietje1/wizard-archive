import { Link } from '@tanstack/react-router'
import { useCampaign } from '~/contexts/CampaignContext'
import { Home, Users, Settings, FileText, Plus, RefreshCw } from '~/lib/icons'
import { cn } from '~/lib/utils'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { FormDialog } from '~/components/forms/category-tag-form/base-tag-form/form-dialog'
import { CategoryForm } from '../../../../components/forms/category-form/category-form'
import {
  CATEGORY_KIND,
  SYSTEM_DEFAULT_CATEGORIES,
  type TagCategory,
} from 'convex/tags/types'
import { getCategoryIcon } from '~/lib/category-icons'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/shadcn/ui/tooltip'
import { CategoryDialog } from '~/components/forms/category-form/category-dialog'

const navigationItemsSection1 = [
  {
    name: 'Overview',
    to: '/campaigns/$dmUsername/$campaignSlug',
    icon: Home,
    exact: true,
  },
  {
    name: 'Notes',
    to: '/campaigns/$dmUsername/$campaignSlug/notes',
    icon: FileText,
  },
  {
    name: 'Players',
    to: '/campaigns/$dmUsername/$campaignSlug/players',
    icon: Users,
  },
]

const navigationItemsSection2 = [
  {
    name: 'Settings',
    to: '/campaigns/$dmUsername/$campaignSlug/settings',
    icon: Settings,
  },
]

export const NavigationSidebar = () => {
  const { dmUsername, campaignSlug, campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership?.data?.campaign

  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const categories = useQuery(
    convexQuery(
      api.tags.queries.getTagCategoriesByCampaign,
      campaign?._id ? { campaignId: campaign._id } : 'skip',
    ),
  )

  const defaultCategories = [
    SYSTEM_DEFAULT_CATEGORIES.Character,
    SYSTEM_DEFAULT_CATEGORIES.Location,
    SYSTEM_DEFAULT_CATEGORIES.Session,
  ] as const

  return (
    <div className="w-16 h-full min-h-0 bg-white border-r border-slate-200 flex flex-col items-center py-4">
      <ScrollArea className="flex-1 w-full h-full pl-1">
        <div className="flex flex-col items-center space-y-2">
          {/* Overview, Players, Notes */}
          {navigationItemsSection1.map((item) => {
            return (
              <Tooltip key={item.name}>
                <TooltipTrigger asChild>
                  <Link
                    to={item.to}
                    params={{ dmUsername, campaignSlug }}
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                      'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                    )}
                    title={item.name}
                  >
                    <item.icon className="h-5 w-5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{item.name}</TooltipContent>
              </Tooltip>
            )
          })}

          {/* Divider */}
          <div className="my-2 h-px w-10 bg-slate-200" />

          {/* Categories */}
          {defaultCategories.map((c) => {
            const to = `/campaigns/$dmUsername/$campaignSlug/categories/${c.slug}`
            const IconComp = getCategoryIcon(c.iconName)
            return (
              <Tooltip key={c.slug}>
                <TooltipTrigger asChild>
                  <Link
                    to={to}
                    params={{ dmUsername, campaignSlug }}
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                      'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                    )}
                    title={c.pluralDisplayName || c.displayName}
                  >
                    <IconComp className="h-5 w-5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {c.pluralDisplayName || c.displayName}
                </TooltipContent>
              </Tooltip>
            )
          })}

          {categories.isError && (
            <Tooltip key="retry-categories">
              <TooltipTrigger asChild>
                <button
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                    'text-red-600 hover:bg-red-50 hover:text-red-700',
                  )}
                  title="Retry loading categories"
                  aria-label="Retry loading categories"
                  onClick={() => categories.refetch()}
                >
                  <RefreshCw className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Retry loading categories
              </TooltipContent>
            </Tooltip>
          )}

          {categories.data
            ?.sort((a: TagCategory, b: TagCategory) =>
              a.kind.localeCompare(b.kind),
            )
            .filter((c: TagCategory) => c.kind !== CATEGORY_KIND.SystemManaged)
            .filter(
              (c: TagCategory) =>
                !defaultCategories.map((d) => d.slug).includes(c.slug),
            )
            .map((c: TagCategory) => {
              const to = `/campaigns/$dmUsername/$campaignSlug/categories/${c.slug}`
              return (
                <Tooltip key={c._id}>
                  <TooltipTrigger asChild>
                    <Link
                      to={to}
                      params={{ dmUsername, campaignSlug }}
                      className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                        'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                      )}
                      title={c.pluralDisplayName || c.displayName}
                    >
                      {(() => {
                        const IconComp = getCategoryIcon(c.iconName)
                        return <IconComp className="h-5 w-5" />
                      })()}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {c.pluralDisplayName || c.displayName}
                  </TooltipContent>
                </Tooltip>
              )
            })}

          {/* Create Category button */}
          <Tooltip key="create-category">
            <TooltipTrigger asChild>
              <button
                className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                title="New Category"
                onClick={() => setIsCreateOpen(true)}
              >
                <Plus className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">New Category</TooltipContent>
          </Tooltip>

          {/* Divider */}
          <div className="my-2 h-px w-10 bg-slate-200" />

          {/* Settings */}
          {navigationItemsSection2.map((item) => (
            <Tooltip key={item.name}>
              <TooltipTrigger asChild>
                <Link
                  to={item.to}
                  params={{ dmUsername, campaignSlug }}
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                    'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  )}
                  title={item.name}
                >
                  <item.icon className="h-5 w-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{item.name}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </ScrollArea>

      {/* Create Category Dialog */}
      {campaign && (
        <CategoryDialog
          mode="create"
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={() => setIsCreateOpen(false)}
          campaignId={campaign._id}
        />
      )}
    </div>
  )
}
