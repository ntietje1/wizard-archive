import { Shield, Sword } from '~/lib/icons'

export function CampaignsHeader() {
  return (
    <div className="text-center mb-12">
      <div className="flex items-center justify-center gap-3 mb-4">
        <div className="p-3 bg-amber-100 rounded-full">
          <Sword className="h-8 w-8 text-amber-600" />
        </div>
        <h1 className="text-4xl font-bold text-slate-800">Campaign Manager</h1>
        <div className="p-3 bg-amber-100 rounded-full">
          <Shield className="h-8 w-8 text-amber-600" />
        </div>
      </div>
      <p className="text-slate-600 text-lg max-w-2xl mx-auto">
        Manage your campaigns and share notes with your party. Create new
        adventures or continue existing ones.
      </p>
    </div>
  )
}
