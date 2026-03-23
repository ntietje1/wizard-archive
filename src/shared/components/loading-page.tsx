import { LoadingSpinner } from './loading-spinner'

interface LoadingPageProps {
  message?: string
  delayedFadeIn?: boolean
  fadeInSpeed?: 'fast' | 'normal' | 'slow'
}

export function LoadingPage({
  message = 'Loading...',
  delayedFadeIn = true,
  fadeInSpeed = 'normal',
}: LoadingPageProps) {
  const fadeInClasses = delayedFadeIn
    ? fadeInSpeed === 'fast'
      ? 'fade-in-delayed-fast'
      : fadeInSpeed === 'slow'
        ? 'fade-in-delayed-slow'
        : 'fade-in-delayed'
    : ''

  return (
    <div
      className={`min-h-screen flex flex-col flex-1 items-center justify-center ${fadeInClasses}`}
    >
      <LoadingSpinner size="lg" className="mb-4" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  )
}
