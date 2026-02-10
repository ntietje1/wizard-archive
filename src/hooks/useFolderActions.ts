import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'

export const useFolderActions = () => {
  const createFolder = useMutation({
    mutationFn: useConvexMutation(api.folders.mutations.createFolder),
  })

  return {
    createFolder,
  }
}
