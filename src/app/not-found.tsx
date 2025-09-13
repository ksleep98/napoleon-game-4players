import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          404 - Page Not Found
        </h2>
        <p className="text-gray-600 mb-6">
          The page you are looking for does not exist.
        </p>
        <Link
          href="/"
          className="inline-block bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
        >
          Return Home
        </Link>
      </div>
    </div>
  )
}
