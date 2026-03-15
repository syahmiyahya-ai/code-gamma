import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { DashboardLayout } from './layouts/DashboardLayout';
import { DashboardHome } from './pages/DashboardHome';
import { RosterPage } from './pages/RosterPage';
import ProfilePage from './pages/ProfilePage';
import { StaffPage } from './pages/StaffPage';

// Placeholder components for other routes
const TasksPage = () => <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">Tasks Page - Coming Soon</div>;
const IntranetPage = () => <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">Intranet Page - Coming Soon</div>;

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
  
  if (!user) return <Navigate to="/login" />;

  return <>{children}</>;
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <Routes>
                <Route index element={<DashboardHome />} />
                <Route path="roster" element={<RosterPage />} />
                <Route path="tasks" element={<TasksPage />} />
                <Route path="intranet" element={<IntranetPage />} />
                <Route path="staff" element={<StaffPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
