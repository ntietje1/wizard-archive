import { Component } from 'react'
import type { ErrorInfo, PropsWithChildren, ReactNode } from 'react'
import { logger } from '~/shared/utils/logger'

interface FallbackComponentProps {
  error: Error
  resetErrorBoundary: () => void
}

interface ErrorBoundaryProps extends PropsWithChildren {
  fallback?: ReactNode
  FallbackComponent?: React.ComponentType<FallbackComponentProps>
  onReset?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  resetErrorBoundary = () => {
    this.props.onReset?.()
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.FallbackComponent) {
        return (
          <this.props.FallbackComponent
            error={this.state.error}
            resetErrorBoundary={this.resetErrorBoundary}
          />
        )
      }

      if (this.props.fallback) {
        return this.props.fallback
      }

      return null
    }

    return this.props.children
  }
}
