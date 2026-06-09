import { toast } from 'sonner'
import { Button } from '~/features/shadcn/components/button'

export function RequestAccessButton() {
  return (
    <Button type="button" size="sm" variant="secondary" onClick={() => toast.info('coming soon')}>
      Request Access
    </Button>
  )
}
