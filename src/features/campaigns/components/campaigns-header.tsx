import { Shield, Sword } from 'lucide-react'

export function CampaignsHeader() {
  return (
    <div className="text-center mb-12">
      <div className="flex items-center justify-center gap-3 mb-4">
        <div className="p-3 bg-accent rounded-lg">
          <Sword className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-4xl font-bold text-foreground">Campaign Manager</h1>
        <div className="p-3 bg-accent rounded-lg">
          <Shield className="h-8 w-8 text-primary" />
        </div>
      </div>
      <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
        Manage your campaigns and share notes with your party. Create new
        adventures or continue existing ones.
      </p>
    </div>
  )
}
