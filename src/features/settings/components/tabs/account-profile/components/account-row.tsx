import { useEffect, useRef, useState } from 'react'
import debounce from 'lodash-es/debounce'
import { toast } from 'sonner'
import { api } from 'convex/_generated/api'
import { Camera, Loader2 } from 'lucide-react'
import type { UserProfile } from 'convex/users/types'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { handleError } from '~/shared/utils/logger'
import { useFileUpload } from '~/features/file-upload/hooks/useFileUpload'
import { UserProfileImage } from '~/shared/components/user-profile-image'
import { Input } from '~/features/shadcn/components/input'
import { Label } from '~/features/shadcn/components/label'

export function AccountRow({ profile }: { profile: UserProfile }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { uploadFile, commitUpload } = useFileUpload()
  const [isUploading, setIsUploading] = useState(false)
  const [name, setName] = useState(profile.name ?? '')

  const updateProfileImage = useAppMutation(
    api.users.mutations.updateProfileImage,
  )

  const updateNameMutation = useAppMutation(api.users.mutations.updateName)

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
    debouncedSaveName(e.target.value)
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
    try {
      const storageId = await uploadFile.mutateAsync(file)
      await Promise.all([
        commitUpload.mutateAsync({ storageId }),
        updateProfileImage.mutateAsync({ storageId }),
      ])
      toast.success('Profile picture updated')
    } catch (error) {
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
        <Label
          htmlFor="preferred-name"
          className="text-xs text-muted-foreground"
        >
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
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  )
}
