import { Link } from '@tanstack/react-router'

export function CampaignNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Campaign Not Found</h1>
        <p className="text-muted-foreground mb-4">
          {
            "The campaign you're looking for doesn't exist, has been moved, or you don't have access to it."
          }
        </p>
        <Link
          to="/campaigns"
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
        >
          Back to Campaigns
        </Link>
      </div>
    </div>
  )
}
