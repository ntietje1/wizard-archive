import { useState } from 'react'
import { toast } from 'sonner'
import { CheckIcon, Copy } from 'lucide-react'
import type { Id } from 'convex/_generated/dataModel'
import { Button } from '~/features/shadcn/components/button'
import { cn } from '~/features/shadcn/lib/utils'

export function UserIdRow({ userId }: { userId: Id<'userProfiles'> }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(userId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">User ID</p>
        <p className="text-sm text-muted-foreground truncate font-mono">
          {userId}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopy}
        className={cn(
          'shrink-0',
          copied && 'text-green-600 hover:text-green-600',
        )}
      >
        {copied ? (
          <>
            <CheckIcon className="size-3.5" />
            Copied
          </>
        ) : (
          <>
            <Copy className="size-3.5" />
            Copy
          </>
        )}
      </Button>
    </div>
  )
}
