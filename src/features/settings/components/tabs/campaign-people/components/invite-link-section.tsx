import { toast } from 'sonner'
import { Button } from '~/features/shadcn/components/button'
import { ButtonGroup } from '~/features/shadcn/components/button-group'
import { Input } from '~/features/shadcn/components/input'

export function InviteLinkSection({ joinUrl }: { joinUrl: string }) {
  return (
    <div className="flex flex-col gap-0">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">
        Invite players
      </h3>
      <ButtonGroup className="w-full">
        <Input
          readOnly
          value={joinUrl}
          placeholder="Join URL not configured"
          className="focus-visible:border-input focus-visible:ring-0"
          onClick={(e) => e.currentTarget.select()}
        />
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(joinUrl)
              toast.success('Join link copied to clipboard')
            } catch {
              toast.error('Failed to copy link')
            }
          }}
        >
          Copy
        </Button>
      </ButtonGroup>
    </div>
  )
}
