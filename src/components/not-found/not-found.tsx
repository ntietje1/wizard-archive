import { Link } from '@tanstack/react-router'
import { Button } from '../shadcn/ui/button'

export default function NotFoundPage() {
  return (
    <div className="h-screen flex flex-col items-center justify-center p-4">
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">Page Not Found</h2>
        <p className="text-gray-600 max-w-md">
          {"The page you're looking for doesn't exist or has been moved."}
        </p>

        <Link to="/">
          <Button variant="outline">Go home</Button>
        </Link>
      </div>
    </div>
  )
}
