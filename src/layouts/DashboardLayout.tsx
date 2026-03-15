import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  Calendar, 
  CheckSquare, 
  Globe, 
  Users, 
  LogOut, 
  Bell,
  Menu,
  X,
  User,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../shared/auth/AuthContext';
import { hasPermission } from '../shared/auth/permissions';
import { supabase } from '../shared/db/supabase';
import NotificationBell from '../modules/notifications/components/NotificationBell';

interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  mobile?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon: Icon, label, mobile }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  if (mobile) {
    return (
      <Link 
        to={to} 
        className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors relative ${
          isActive ? 'text-emerald-600' : 'text-slate-400'
        }`}
      >
        <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
        <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
        {isActive && (
          <motion.div 
            layoutId="mobile-nav-indicator"
            className="absolute top-0 w-8 h-0.5 bg-emerald-600 rounded-b-full"
          />
        )}
      </Link>
    );
  }

  return (
    <Link 
      to={to} 
      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all relative group ${
        isActive 
          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
          : 'text-slate-400 hover:text-white hover:bg-white/5'
      }`}
    >
      <Icon size={20} className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
      {label}
      {isActive && (
        <motion.div 
          layoutId="sidebar-active-indicator"
          className="absolute left-0 w-1.5 h-6 bg-white rounded-r-full"
        />
      )}
    </Link>
  );
};

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-72 bg-slate-900 h-screen sticky top-0 z-40">
        <div className="p-8 border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <Globe size={24} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">WardRoster</h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">ACCU Division</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-6 space-y-2">
          <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">Main Menu</p>
          <NavItem to="/" icon={Home} label="Home" />
          <NavItem to="/roster" icon={Calendar} label="My Roster" />
          <NavItem to="/tasks" icon={CheckSquare} label="Tasks" />
          <NavItem to="/intranet" icon={Globe} label="Intranet" />
          <NavItem to="/staff" icon={Users} label="Staff" />
          
          {hasPermission(profile?.role, 'view_admin_dashboard') && (
            <>
              <div className="pt-4 pb-2 px-4">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Management</p>
              </div>
              <NavItem to="/roster" icon={Settings} label="Roster Builder" />
            </>
          )}
        </nav>

        <div className="p-6 border-t border-white/5">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition-all border border-rose-500/20"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header (Universal) */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="lg:hidden w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-emerald-200">
              <Globe size={18} />
            </div>
            <span className="lg:hidden font-bold text-slate-800 tracking-tight">ACCU Ward</span>
            <div className="hidden lg:block">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Dashboard / {location.pathname === '/' ? 'Home' : location.pathname.split('/')[1]}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <NotificationBell currentUserId={profile?.id || ''} />
            <Link 
              to="/profile"
              className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden border-2 border-white shadow-sm hover:ring-2 hover:ring-emerald-500/20 transition-all"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-emerald-100 text-emerald-600 font-bold text-xs uppercase">
                  {profile?.name?.charAt(0)}
                </div>
              )}
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col relative">
          <div className="flex-1 p-4 lg:p-8 pb-24 lg:pb-8 max-w-[1600px] mx-auto w-full">
            {children}
          </div>

          {/* Mobile Bottom Navigation */}
          <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 px-2 h-16 flex items-center justify-around z-40 pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
            <NavItem to="/" icon={Home} label="Home" mobile />
            <NavItem to="/roster" icon={Calendar} label="Roster" mobile />
            <NavItem to="/staff" icon={Users} label="Staff" mobile />
            <NavItem to="/intranet" icon={Globe} label="Docs" mobile />
            <NavItem to="/profile" icon={User} label="Profile" mobile />
          </nav>
        </main>
      </div>
    </div>
  );
};
