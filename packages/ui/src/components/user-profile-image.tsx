import type { ComponentProps } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@wizard-archive/ui/shadcn/components/avatar'
import { getInitials } from '../utils/get-initials'

type UserProfileImageProps = {
  imageUrl?: string | null
  name?: string | null
  email?: string | null
  size?: ComponentProps<typeof Avatar>['size']
  className?: string
}

export function UserProfileImage({
  imageUrl,
  name,
  email,
  size = 'default',
  className,
}: UserProfileImageProps) {
  return (
    <Avatar size={size} className={className}>
      {imageUrl && <AvatarImage src={imageUrl} alt={name ?? 'User profile picture'} />}
      <AvatarFallback>{getInitials(name, email)}</AvatarFallback>
    </Avatar>
  )
}
