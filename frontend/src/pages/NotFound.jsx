import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '../components/ui';

export default function NotFound() {
  return (
    <div className="card">
      <EmptyState
        icon={Compass}
        title="Page not found"
        message="The page you are looking for doesn't exist or you don't have access to it."
        action={
          <Link to="/dashboard" className="btn-primary">
            Back to dashboard
          </Link>
        }
      />
    </div>
  );
}
