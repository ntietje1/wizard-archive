import { Link } from '@tanstack/react-router'
import { useCampaign } from '~/contexts/CampaignContext'
import { Home, Users, Settings, FileText, Plus } from '~/lib/icons'
import { cn } from '~/lib/utils'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { FormDialog } from '~/components/forms/category-tag-dialogs/base-tag-dialog/form-dialog'
import { CreateCategoryForm } from './create-category-form'
import { CATEGORY_KIND, type TagCategory } from 'convex/tags/types'
import { getCategoryIcon } from '~/lib/category-icons'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'

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
  const { dmUsername, campaignSlug } = useCampaign()
  const { campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership?.data?.campaign

  const [isCreateOpen, setIsCreateOpen] = useState(false)


  const categories = useQuery(
    convexQuery(
      api.tags.queries.getTagCategoriesByCampaign,
      campaign?._id ? { campaignId: campaign._id } : 'skip',
    ),
  )


  return (
    <div className="w-16 h-full min-h-0 bg-white border-r border-slate-200 flex flex-col items-center py-4">
      <ScrollArea className="flex-1 w-full h-full pl-1">
        <div className="flex flex-col items-center space-y-2">
        {/* Overview, Players, Notes */}
        {navigationItemsSection1.map((item) => {
          return (
            <Link
              key={item.name}
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
          )
        })}

        {/* Divider */}
        <div className="my-2 h-px w-10 bg-slate-200" />

        {/* Categories */}
        {categories.data
          ?.sort((a: TagCategory, b: TagCategory) =>
            a.kind.localeCompare(b.kind),
          )
          .filter((c: TagCategory) => c.kind !== CATEGORY_KIND.SystemManaged)
          .map((c: TagCategory) => {
            const to = `/campaigns/$dmUsername/$campaignSlug/${c.name}`
            return (
              <Link
                key={c._id}
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
            )
          })}

        {/* Create Category button */}
        <button
          className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          title="New Category"
          onClick={() => setIsCreateOpen(true)}
        >
          <Plus className="h-5 w-5" />
        </button>

        {/* Divider */}
        <div className="my-2 h-px w-10 bg-slate-200" />

        {/* Settings */}
        {navigationItemsSection2.map((item) => (
          <Link
            key={item.name}
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
        ))}
        </div>
      </ScrollArea>

      {/* Create Category Dialog */}
      <FormDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="New Category"
        description="Create a user-defined category."
        icon={Plus}
        maxWidth="max-w-2xl"
      >
        {campaign && (
          <CreateCategoryForm
            campaignId={campaign._id as any}
            onClose={() => setIsCreateOpen(false)}
          />
        )}
      </FormDialog>
    </div>
  )
}
