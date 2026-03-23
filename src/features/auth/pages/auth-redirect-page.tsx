import { useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'

export function AuthRedirectPage() {
  const navigate = useNavigate()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const joinUrl = sessionStorage.getItem('joinCampaignRedirectUrl')

      if (joinUrl) {
        try {
          const url = new URL(joinUrl, window.location.origin)
          if (url.origin !== window.location.origin) {
            console.error('Invalid redirect URL origin:', joinUrl)
            sessionStorage.removeItem('joinCampaignRedirectUrl')
            navigate({ to: '/', replace: true })
            return
          }
          sessionStorage.removeItem('joinCampaignRedirectUrl')
          window.location.href = url.pathname + url.search + url.hash
          return
        } catch {
          console.error('Invalid redirect URL format:', joinUrl)
          sessionStorage.removeItem('joinCampaignRedirectUrl')
          navigate({ to: '/', replace: true })
          return
        }
      }

      navigate({ to: '/', replace: true })
    }
  }, [navigate])

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin" />
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  )
}
