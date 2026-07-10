import { useEffect, useRef, useState } from 'react'
import debounce from 'lodash-es/debounce'
import { toast } from 'sonner'
import { Camera, Loader2 } from 'lucide-react'
import type { UserProfile } from 'shared/users/types'
import {
  useUpdateNameMutation,
  useUpdateProfileImageMutation,
} from '~/shared/hooks/use-user-profile-operations'
import { handleError } from '~/shared/utils/logger'
import { useAppFileUpload } from '~/shared/uploads/use-app-file-upload'
import { UserProfileImage } from '@wizard-archive/ui/components/user-profile-image'
import { Input } from '@wizard-archive/ui/shadcn/components/input'
import { Label } from '@wizard-archive/ui/shadcn/components/label'
import type { Id } from 'convex/_generated/dataModel'

export function AccountRow({ profile }: { profile: UserProfile }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { discardUpload, uploadFile } = useAppFileUpload()
  const [isUploading, setIsUploading] = useState(false)
  const [name, setName] = useState(profile.name ?? '')

  const updateProfileImage = useUpdateProfileImageMutation()
  const updateNameMutation = useUpdateNameMutation()

  const debouncedSaveName = debounce(async (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    try {
      await updateNameMutation.mutateAsync({ name: trimmed })
    } catch (error) {
      handleError(error, 'Failed to update name')
    }
  }, 500)

  useEffect(() => {
    return () => {
      debouncedSaveName.cancel()
    }
  }, [debouncedSaveName])

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value)
    void debouncedSaveName(e.target.value)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB')
      return
    }

    setIsUploading(true)
    let uploadSessionId: Id<'fileStorage'> | null = null
    try {
      const { sessionId } = await uploadFile.mutateAsync(file)
      uploadSessionId = sessionId
      await updateProfileImage.mutateAsync({ uploadSessionId: sessionId })
      toast.success('Profile picture updated')
    } catch (error) {
      if (uploadSessionId) {
        await discardUpload.mutateAsync({ sessionId: uploadSessionId }).catch(() => undefined)
      }
      handleError(error, 'Failed to update profile image')
    }
    setIsUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        className="relative group rounded-full cursor-pointer shrink-0"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
      >
        <UserProfileImage
          imageUrl={profile.imageUrl}
          name={profile.name}
          email={profile.email}
          size="sm"
        />
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity">
          {isUploading ? (
            <Loader2 className="size-4 text-primary-foreground animate-spin" />
          ) : (
            <Camera className="size-4 text-primary-foreground" />
          )}
        </div>
      </button>
      <div className="min-w-0 flex flex-col gap-1 max-w-56">
        <Label htmlFor="preferred-name" className="text-xs text-muted-foreground">
          Preferred name
        </Label>
        <Input
          id="preferred-name"
          value={name}
          onChange={handleNameChange}
          placeholder="Your preferred name"
          className="h-8 text-sm"
        />
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        aria-label="Upload profile picture"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  )
}
