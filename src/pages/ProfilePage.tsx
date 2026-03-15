import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Mail, 
  Shield, 
  Phone, 
  LogOut, 
  ChevronRight,
  Camera,
  Bell,
  Lock,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

const ProfilePage: React.FC = () => {
  const { profile, user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = React.useState(false);
  const [showRoleModal, setShowRoleModal] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshProfile();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleRoleUpdate = async (newRole: string) => {
    if (!profile?.id) return;
    setIsUpdatingRole(true);
    try {
      const res = await fetch(`/api/users/${profile.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': profile.id
        },
        body: JSON.stringify({ role: newRole })
      });
      
      if (res.ok) {
        setMessage(`Role updated to ${newRole} successfully!`);
        await refreshProfile();
      } else {
        const err = await res.json();
        setMessage(`Error: ${err.error || 'Failed to update role'}`);
      }
    } catch (err) {
      setMessage('Failed to connect to server');
    } finally {
      setIsUpdatingRole(false);
      setShowRoleModal(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleItemClick = (label: string) => {
    if (label === 'Role') {
      setShowRoleModal(true);
      return;
    }
    setMessage(`${label} feature is coming soon!`);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const sections = [
    {
      title: 'Account Settings',
      items: [
        { icon: User, label: 'Personal Information', value: profile?.name },
        { icon: Mail, label: 'Email Address', value: user?.email },
        { icon: Phone, label: 'Phone Number', value: profile?.phone_number || 'Not set' },
      ]
    },
    {
      title: 'Security',
      items: [
        { icon: Shield, label: 'Role', value: profile?.role },
        { icon: Lock, label: 'Change Password', value: '••••••••' },
      ]
    }
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-8 relative">
      {/* Role Selection Modal */}
      <AnimatePresence>
        {showRoleModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRoleModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-800">Change User Role</h3>
                <p className="text-xs text-slate-500 mt-1">Select a new role for your account</p>
              </div>
              <div className="p-2">
                {['Administrator', 'Manager', 'Doctor', 'Staff'].map((role) => (
                  <button
                    key={role}
                    onClick={() => handleRoleUpdate(role)}
                    disabled={isUpdatingRole}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${
                      profile?.role === role 
                        ? 'bg-emerald-50 text-emerald-700' 
                        : 'hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span className="font-bold">{role}</span>
                    {profile?.role === role && <Shield size={16} className="text-emerald-500" />}
                  </button>
                ))}
              </div>
              <div className="p-4 bg-slate-50 flex justify-end">
                <button 
                  onClick={() => setShowRoleModal(false)}
                  className="px-6 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Message */}
      <AnimatePresence>
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl text-sm font-bold"
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header / Avatar Section */}
      <section className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-emerald-500 to-teal-600"></div>
        
        <div className="relative pt-12">
          <div className="relative inline-block">
            <div className="w-32 h-32 rounded-[2.5rem] bg-white p-1 shadow-xl">
              <div className="w-full h-full rounded-[2.2rem] bg-slate-100 overflow-hidden flex items-center justify-center border-4 border-white">
                {profile?.avatar_url ? (
                  <img 
                    src={profile.avatar_url} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <User size={48} className="text-slate-300" />
                )}
              </div>
            </div>
            <button className="absolute bottom-0 right-0 w-10 h-10 bg-white rounded-2xl shadow-lg border border-slate-100 flex items-center justify-center text-slate-600 hover:text-emerald-600 transition-colors">
              <Camera size={18} />
            </button>
          </div>

          <div className="mt-6 space-y-1">
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">{profile?.name}</h1>
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">{profile?.role} • ACCU Division</p>
            <button 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="mt-2 flex items-center gap-2 mx-auto px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-[10px] font-bold transition-all disabled:opacity-50"
            >
              <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
              {isRefreshing ? 'Refreshing...' : 'Sync Profile Data'}
            </button>
          </div>
        </div>
      </section>

      {/* Settings Sections */}
      <div className="space-y-6">
        {sections.map((section, idx) => (
          <section key={idx} className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-8 py-4 bg-slate-50/50 border-b border-slate-100">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{section.title}</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {section.items.map((item, itemIdx) => (
                <button 
                  key={itemIdx}
                  onClick={() => handleItemClick(item.label)}
                  className="w-full px-8 py-5 flex items-center justify-between hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-white group-hover:shadow-sm transition-all">
                      <item.icon size={18} />
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.label}</p>
                      <p className="text-sm font-bold text-slate-700">{item.value}</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                </button>
              ))}
            </div>
          </section>
        ))}

        {/* Logout Button (Mobile Only visible or just always here as requested) */}
        <section className="lg:hidden pt-4">
          <button 
            onClick={handleLogout}
            className="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 font-black py-5 rounded-[2rem] border border-rose-100 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </section>
      </div>
    </div>
  );
};

export default ProfilePage;
