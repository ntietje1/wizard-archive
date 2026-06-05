import { use } from 'react'
import { BlockShareMenuContext } from '~/features/sharing/contexts/block-share-menu-state'

export function useBlockShareMenu() {
  const context = use(BlockShareMenuContext)
  if (!context) {
    throw new Error('useBlockShareMenu must be used within BlockShareMenuProvider.')
  }
  return context
}
