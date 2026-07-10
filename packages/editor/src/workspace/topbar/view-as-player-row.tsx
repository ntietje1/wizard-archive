import { UserProfileImage } from '@wizard-archive/ui/components/user-profile-image'
import type { EditorShareParticipant } from '../../sharing/contracts'

export function ViewAsPlayerRow({ member }: { member: EditorShareParticipant }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <UserProfileImage
        imageUrl={member.imageUrl ?? null}
        name={member.displayName}
        size="sm"
        className="shrink-0"
      />
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate font-medium" title={member.displayName}>
          {member.displayName}
        </span>
        {member.username && (
          <span className="truncate text-xs text-muted-foreground" title={`@${member.username}`}>
            @{member.username}
          </span>
        )}
      </span>
    </span>
  )
}
