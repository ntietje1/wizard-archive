import { useContext } from 'react'
import { FileSidebarContext } from '~/contexts/FileSidebarContext'

export const useFileSidebar = () => {
  const context = useContext(FileSidebarContext)
  if (!context) {
    throw new Error('useFileSidebar must be used within a FileSidebarProvider')
  }
  return context
}
