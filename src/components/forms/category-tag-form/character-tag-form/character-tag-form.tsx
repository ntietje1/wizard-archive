import { useCallback, useEffect } from 'react'
import { useRouter } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  convexQuery,
  useConvex,
  useConvexMutation,
} from '@convex-dev/react-query'
import { useForm } from '@tanstack/react-form'
import {
  validateTagDescription,
  validateTagName,
  validateTagNameAsync,
} from '../generic-tag-form/validators.ts'
import {
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  type TagCategoryConfig,
} from '../base-tag-form/types.ts'
import { useCampaign } from '~/contexts/CampaignContext'
import { useFileWithPreview } from '~/hooks/useFileWithPreview.ts'
import { toast } from 'sonner'
import type { Id } from 'convex/_generated/dataModel'
import type { Character } from 'convex/characters/types.ts'
import {
  defaultCharacterFormValues,
  type CharacterFormValues,
} from './types.ts'
import {
  NameField,
  DescriptionField,
  ColorField,
  ImageUploadField,
  SubmitButtons,
} from '../generic-tag-form/fields.tsx'
import { PlayerField } from './fields.tsx'

interface CharacterTagFormProps {
  mode: 'create' | 'edit'
  character?: Character
  config: TagCategoryConfig
  navigateToNote?: boolean
  parentFolderId?: Id<'folders'>
  isOpen: boolean
  onClose: () => void
}

export default function CharacterTagForm({
  mode,
  character,
  config,
  navigateToNote,
  parentFolderId,
  isOpen,
  onClose,
}: CharacterTagFormProps) {
  const router = useRouter()
  const convex = useConvex()
  const { campaignWithMembership, dmUsername, campaignSlug } = useCampaign()
  const campaign = campaignWithMembership?.data?.campaign

  const createMutation = useMutation({
    mutationFn: useConvexMutation(api.characters.mutations.createCharacter),
  })

  const updateCharacterMutation = useMutation({
    mutationFn: useConvexMutation(api.characters.mutations.updateCharacter),
  })

  const playersQuery = useQuery(
    convexQuery(
      api.campaigns.queries.getPlayersByCampaign,
      campaign?._id
        ? {
            campaignId: campaign?._id,
          }
        : 'skip',
    ),
  )

  const getCategory = useQuery(
    convexQuery(
      api.tags.queries.getTagCategoryBySlug,
      campaign?._id
        ? {
            campaignId: campaign?._id,
            slug: config.categorySlug,
          }
        : 'skip',
    ),
  )

  const imageUpload = useFileWithPreview({
    isOpen,
    fileStorageId: character?.imageStorageId,
    uploadOnSelect: true,
    fileTypeValidator: (file: File) => {
      if (!file.type.startsWith('image/')) {
        return { success: false, error: 'Only image files are allowed' }
      }
      return { success: true }
    },
  })

  const getInitialValues = useCallback((): CharacterFormValues => {
    if (mode === 'edit' && character) {
      return {
        name: character.displayName,
        description: character.description || '',
        color: character.color ?? null,
        playerId: character.playerId || undefined,
      }
    } else {
      return {
        ...defaultCharacterFormValues,
        color: null,
      }
    }
  }, [character, mode])

  const form = useForm({
    defaultValues: getInitialValues(),
    onSubmit: async ({ value }) => {
      await handleSubmit(value)
    },
  })

  useEffect(() => {
    form.reset(getInitialValues())
  }, [mode, character?._id, getInitialValues])

  async function handleSubmit(value: CharacterFormValues) {
    if (!campaign) {
      toast.error('Campaign not found')
      return
    }

    if (!getCategory.data) {
      toast.error(`Category not found`)
      return
    }

    try {
      let imageStorageId: Id<'_storage'> | undefined = undefined

      if (imageUpload.file) {
        try {
          imageStorageId = await imageUpload.handleSubmit()
        } catch (error) {
          toast.error('Failed to upload image')
          console.error('Failed to upload image:', error)
          return
        }
      }

      if (mode === 'create') {
        const result = await createMutation.mutateAsync({
          displayName: value.name.trim(),
          name: value.name.trim(),
          description: value.description.trim() || undefined,
          color: value.color ?? undefined,
          imageStorageId: imageStorageId,
          campaignId: campaign._id,
          categoryId: getCategory.data._id,
          parentFolderId,
          playerId: value.playerId || undefined,
        })

        if (navigateToNote && result.noteId) {
          const note = await convex.query(api.notes.queries.getNote, {
            noteId: result.noteId,
          })
          if (note?.slug) {
            router.navigate({
              to: '/campaigns/$dmUsername/$campaignSlug/notes/$noteSlug',
              params: {
                dmUsername,
                campaignSlug,
                noteSlug: note.slug,
              },
            })
          }
        }

        toast.success(`${config.singular} created successfully`)
        onClose()
      } else if (mode === 'edit' && character) {
        await updateCharacterMutation.mutateAsync({
          characterId: character.characterId,
          displayName: value.name.trim(),
          description: value.description.trim() || undefined,
          color: value.color,
          imageStorageId: imageStorageId,
          playerId: value.playerId || undefined,
        })

        toast.success(`${config.singular} updated successfully`)
        onClose()
      }
    } catch (error) {
      console.error(`Failed to ${mode} tag:`, error)
      toast.error(`Failed to ${mode} ${config.singular.toLowerCase()}`)
    }
  }

  const isFormDisabled = form.state.isSubmitting || imageUpload.isUploading

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
      className="space-y-4"
    >
      {/* Name Field */}
      <form.Field
        name="name"
        validators={{
          onMount: ({ value }: { value: string }) =>
            validateTagName(value, MAX_NAME_LENGTH),
          onChange: ({ value }: { value: string }) =>
            validateTagName(value, MAX_NAME_LENGTH),
          onChangeAsync: async ({ value }: { value: string }) => {
            if (!campaign || !getCategory.data) return undefined
            return validateTagNameAsync(
              convex,
              campaign._id,
              getCategory.data._id,
              value,
              mode === 'edit' && character ? character.tagId : undefined,
            )
          },
          onChangeAsyncDebounceMs: 300,
        }}
      >
        {(field) => (
          <NameField
            field={field}
            config={config}
            isDisabled={isFormDisabled}
          />
        )}
      </form.Field>

      {/* Description Field */}
      <form.Field
        name="description"
        validators={{
          onChange: ({ value }: { value: string }) =>
            validateTagDescription(value, MAX_DESCRIPTION_LENGTH),
        }}
      >
        {(field) => (
          <DescriptionField
            field={field}
            config={config}
            isDisabled={isFormDisabled}
          />
        )}
      </form.Field>

      {/* Color Picker */}
      <form.Field name="color">
        {(field) => (
          <ColorField
            field={field}
            isDisabled={isFormDisabled}
            categoryDefaultColor={getCategory.data?.defaultColor}
          />
        )}
      </form.Field>

      {/* Player */}
      <form.Field name="playerId">
        {(field) => (
          <PlayerField
            field={field}
            players={playersQuery.data || []}
            isDisabled={isFormDisabled}
          />
        )}
      </form.Field>

      {/* Image Upload Section */}
      <ImageUploadField
        label="Image"
        fileUpload={imageUpload}
        isSubmitting={form.state.isSubmitting}
        handleFileSelect={imageUpload.handleFileSelect}
      />

      {/* Submit Buttons */}
      <form.Subscribe
        selector={(s: { canSubmit: boolean; isSubmitting: boolean }) => ({
          canSubmit: s.canSubmit,
          isSubmitting: s.isSubmitting,
        })}
      >
        {({ canSubmit, isSubmitting }) => {
          return (
            <SubmitButtons
              mode={mode}
              isSubmitting={isSubmitting}
              canSubmit={canSubmit}
              imageUpload={imageUpload}
              nameValue={form.state.values.name}
              onClose={onClose}
            />
          )
        }}
      </form.Subscribe>
    </form>
  )
}
