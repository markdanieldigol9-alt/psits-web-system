import { Link } from 'react-router-dom';

export const UnauthorizedPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-8 text-center space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Unauthorized</h1>
        <p className="text-gray-600">
          You do not have permission to access this page.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary text-white hover:opacity-95"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
};

