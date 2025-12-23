import { useState } from 'react'
import { Tags } from 'lucide-react'
import { Button } from '~/components/shadcn/ui/button'
import { useCampaign } from '~/contexts/CampaignContext'
import { CategoryDialog } from '~/components/forms/category-form/category-dialog'

export function NewCategoryButton() {
  const { campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership?.data?.campaign
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  if (!campaign) return null

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Create new category"
        onClick={() => setIsCreateOpen(true)}
      >
        <Tags className="h-4 w-4" />
      </Button>
      <CategoryDialog
        mode="create"
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => setIsCreateOpen(false)}
        campaignId={campaign._id}
      />
    </>
  )
}
