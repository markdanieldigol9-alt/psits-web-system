import { Link } from 'react-router-dom';
import { BlankLayout } from '@/shared/layouts';
import { Button } from '@/shared/components/Form';

export const UnauthorizedPage = () => {
  return (
    <BlankLayout>
      <div className="w-full max-w-md bg-white dark:bg-obsidian-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-card p-8 text-center space-y-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 text-balance">Unauthorized</h1>
        <p className="text-slate-600 dark:text-slate-400">
          You do not have permission to access this page.
        </p>
        <Link to="/dashboard" className="inline-block">
          <Button variant="primary">
            Go to Dashboard
          </Button>
        </Link>
      </div>
    </BlankLayout>
  );
};

