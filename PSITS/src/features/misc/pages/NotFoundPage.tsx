import { Link } from 'react-router-dom';
import { BlankLayout } from '@/shared/layouts';
import { Button } from '@/shared/components/Form';

export const NotFoundPage = () => {
  return (
    <BlankLayout>
      <div className="min-h-screen bg-gradient-to-br from-primary to-blue-900 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-8xl font-bold text-white mb-4">404</h1>
          <h2 className="text-3xl font-bold text-white mb-4">Page Not Found</h2>
          <p className="text-blue-100 mb-8 text-lg">
            Sorry, the page you're looking for doesn't exist or has been moved.
          </p>
          <Link to="/">
            <Button variant="primary" size="lg">
              Go Back Home
            </Button>
          </Link>
        </div>
      </div>
    </BlankLayout>
  );
};
