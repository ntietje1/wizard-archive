import { WorkspaceFeatureDemo } from '~/features/landing/components/landing-feature-demos'
import { StaticFeatureSection } from '~/features/landing/components/static-feature-section'

const workspaceFeatures = [
  'link related notes or embed them directly',
  'sync across devices',
  'import and export campaigns as markdown files',
  'add images, files, and folders',
]

export function CampaignWorkspaceSection() {
  return (
    <StaticFeatureSection
      title="Write and plan your campaign in one place"
      items={workspaceFeatures}
      cta="Get organized"
      visualDescription="Workspace preview: a campaign sidebar with folders, files, images, and notes beside a focused editor. The mockup should show linked notes or embedded related content, sync status across devices, and import/export controls for Markdown campaigns."
      visual={<WorkspaceFeatureDemo />}
      className="-mt-16 pt-12"
    />
  )
}
