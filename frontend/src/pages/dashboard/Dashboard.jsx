import { useAuth } from '../../context/AuthContext';
import AdminDashboard from './AdminDashboard';
import StaffDashboard from './StaffDashboard';
import MemberDashboard from './MemberDashboard';

export default function Dashboard() {
  const { role } = useAuth();
  if (role === 'member') return <MemberDashboard />;
  if (role === 'staff') return <StaffDashboard />;
  return <AdminDashboard />;
}
