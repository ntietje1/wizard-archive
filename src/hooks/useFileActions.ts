import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'

export function useFileActions() {
  const createFile = useMutation({
    mutationFn: useConvexMutation(api.files.mutations.createFile),
  })

  const updateFile = useMutation({
    mutationFn: useConvexMutation(api.files.mutations.updateFile),
  })

  return {
    createFile,
    updateFile,
  }
}
