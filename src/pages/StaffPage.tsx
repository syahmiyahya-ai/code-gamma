import React, { useEffect, useState } from 'react';
import { Search, Mail, Phone, User, Shield, BadgeCheck, Trash2, AlertTriangle } from 'lucide-react';
import { supabase } from '../shared/db/supabase';
import { useAuth } from '../shared/auth/AuthContext';
import { isAdministrator } from '../shared/auth/permissions';
import { motion, AnimatePresence } from 'motion/react';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url?: string;
}

export const StaffPage: React.FC = () => {
  const { profile } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const isAdmin = isAdministrator(profile?.role as any);

  const fetchStaff = async () => {
    try {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Failed to fetch staff');
      const data = await res.json();
      setStaff(data || []);
    } catch (err) {
      console.error('Error fetching staff:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleDeleteStaff = async (id: string) => {
    if (!profile?.id) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': profile.id
        }
      });

      if (res.ok) {
        setStaff(prev => prev.filter(s => s.id !== id));
        setConfirmDelete(null);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete staff member');
      }
    } catch (err) {
      console.error('Error deleting staff:', err);
      alert('Failed to connect to server');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredStaff = staff.filter(member => 
    member.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.role?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {confirmDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDelete(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden p-6"
            >
              <div className="flex items-center gap-3 text-rose-600 mb-4">
                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                  <AlertTriangle size={20} />
                </div>
                <h3 className="text-lg font-bold">Delete Staff Member?</h3>
              </div>
              
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                Are you sure you want to delete <span className="font-bold text-slate-900">{staff.find(s => s.id === confirmDelete)?.name}</span>? This action cannot be undone and will remove all their associated data.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 px-4 py-3 rounded-2xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteStaff(confirmDelete)}
                  disabled={!!deletingId}
                  className="flex-1 px-4 py-3 rounded-2xl bg-rose-600 text-white font-bold text-sm hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 disabled:opacity-50"
                >
                  {deletingId === confirmDelete ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Staff Directory</h1>
          <p className="text-slate-500 text-sm">View and contact your colleagues</p>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search staff..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 w-full md:w-64 transition-all"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStaff.map((member) => (
            <div 
              key={member.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all group relative"
            >
              {isAdmin && member.id !== profile?.id && (
                <button
                  onClick={() => setConfirmDelete(member.id)}
                  className="absolute top-4 right-4 p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                  title="Delete Staff"
                >
                  <Trash2 size={16} />
                </button>
              )}

              <div className="flex items-start gap-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 overflow-hidden border-2 border-white shadow-sm">
                    {member.avatar_url ? (
                      <img 
                        src={member.avatar_url} 
                        alt={member.name} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-emerald-100 text-emerald-600 font-bold text-xl">
                        {member.name?.charAt(0)}
                      </div>
                    )}
                  </div>
                  {member.role === 'Administrator' && (
                    <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-lg shadow-lg">
                      <Shield size={10} />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <h3 className="font-bold text-slate-800 truncate">{member.name}</h3>
                    {member.role === 'Administrator' && (
                      <BadgeCheck size={14} className="text-blue-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs font-medium text-slate-500 mb-3">{member.role}</p>
                  
                  <div className="space-y-2">
                    <a 
                      href={`mailto:${member.email}`}
                      className="flex items-center gap-2 text-xs text-slate-600 hover:text-emerald-600 transition-colors"
                    >
                      <Mail size={14} className="text-slate-400" />
                      <span className="truncate">{member.email}</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filteredStaff.length === 0 && (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Search size={24} className="text-slate-300" />
          </div>
          <p className="text-slate-500 font-medium">No staff members found matching your search</p>
        </div>
      )}
    </div>
  );
};
