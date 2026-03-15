import React, { useState, useEffect } from 'react';
import { 
  User as UserIcon, 
  Phone, 
  Mail, 
  Briefcase, 
  Calendar, 
  CheckSquare, 
  Save, 
  Plus, 
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Shield,
  CalendarDays
} from 'lucide-react';
import { motion } from 'motion/react';
import StaffTaskList from '../../tasks/components/StaffTaskList';

import { UserRole } from '../../../shared/auth/permissions';

interface User {
  id: string;
  name: string;
  role: UserRole;
  phone_number?: string;
  email?: string;
  avatar_url?: string;
  google_access_token?: string;
}

interface LeaveRequest {
  id: number;
  user_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
}

interface UserProfileProps {
  currentUser: User;
  onUpdateUser: (updatedUser: User) => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ currentUser, onUpdateUser }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [phone, setPhone] = useState(currentUser.phone_number || '');
  const [email, setEmail] = useState(currentUser.email || '');
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [newLeave, setNewLeave] = useState({ start_date: '', end_date: '', reason: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLeaveRequests();
  }, [currentUser.id]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        onUpdateUser({ ...currentUser }); // Trigger refresh
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [currentUser, onUpdateUser]);

  const fetchLeaveRequests = async () => {
    try {
      const res = await fetch(`/api/leave-requests?user_id=${currentUser.id}`);
      const data = await res.json();
      setLeaveRequests(data);
    } catch (err) {
      console.error("Failed to fetch leave requests", err);
    }
  };

  const handleConnectGoogle = async () => {
    try {
      const res = await fetch(`/api/auth/google/url?userId=${currentUser.id}`);
      const { url } = await res.json();
      window.open(url, 'google_oauth', 'width=600,height=700');
    } catch (err) {
      console.error("Failed to get Google Auth URL", err);
    }
  };

  const handleUpdateProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${currentUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone, email })
      });
      if (res.ok) {
        onUpdateUser({ ...currentUser, phone_number: phone, email });
        setIsEditing(false);
      }
    } catch (err) {
      console.error("Failed to update profile", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id,
          ...newLeave
        })
      });
      if (res.ok) {
        setShowLeaveForm(false);
        setNewLeave({ start_date: '', end_date: '', reason: '' });
        fetchLeaveRequests();
      }
    } catch (err) {
      console.error("Failed to request leave", err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED': return <CheckCircle2 size={16} className="text-emerald-500" />;
      case 'REJECTED': return <XCircle size={16} className="text-rose-500" />;
      default: return <Clock size={16} className="text-amber-500" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'REJECTED': return 'bg-rose-50 text-rose-700 border-rose-100';
      default: return 'bg-amber-50 text-amber-700 border-amber-100';
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Profile Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden"
      >
        <div className="h-48 bg-slate-900 relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-emerald-500/30 to-transparent" />
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
          </div>
          
          <div className="absolute bottom-6 left-8 flex items-center gap-4">
            <div className="px-3 py-1 bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 rounded-full">
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em]">Medical Professional Profile</p>
            </div>
          </div>
        </div>

        <div className="px-8 pb-8">
          <div className="relative flex justify-between items-end -mt-16 mb-8">
            <div className="w-32 h-32 rounded-[2.5rem] bg-white p-2 shadow-2xl">
              <div className="w-full h-full rounded-[2rem] bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden border border-slate-100">
                {currentUser.avatar_url ? (
                  <img src={currentUser.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon size={48} />
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => isEditing ? handleUpdateProfile() : setIsEditing(true)}
                disabled={loading}
                className={`px-6 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg ${
                  isEditing 
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-500/20' 
                    : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/20'
                }`}
              >
                {isEditing ? (
                  <>
                    <Save size={18} />
                    {loading ? 'Saving...' : 'Save Changes'}
                  </>
                ) : (
                  <>
                    <Briefcase size={18} />
                    Edit Profile
                  </>
                )}
              </button>
              {isEditing && (
                <button 
                  onClick={() => setIsEditing(false)}
                  className="px-6 py-3 rounded-2xl text-sm font-bold bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition-all shadow-sm"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-8">
              <div>
                <h2 className="text-4xl font-bold text-slate-900 tracking-tight">{currentUser.name}</h2>
                <div className="flex items-center gap-3 mt-3">
                  <span className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 text-[11px] font-bold uppercase tracking-wider border border-emerald-100">
                    {currentUser.role}
                  </span>
                  <div className="h-1 w-1 bg-slate-300 rounded-full" />
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Employee ID: {currentUser.id}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-emerald-500 transition-colors" />
                    {isEditing ? (
                      <input 
                        type="email" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-sm focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all shadow-sm"
                        placeholder="Email Address"
                      />
                    ) : (
                      <div className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-4 py-4 text-sm text-slate-600 font-medium">
                        {currentUser.email || 'No email provided'}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                  <div className="relative group">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-emerald-500 transition-colors" />
                    {isEditing ? (
                      <input 
                        type="tel" 
                        value={phone} 
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-sm focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all shadow-sm"
                        placeholder="Phone Number"
                      />
                    ) : (
                      <div className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-4 py-4 text-sm text-slate-600 font-medium">
                        {currentUser.phone_number || 'No phone number provided'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 rounded-3xl p-8 flex flex-col justify-between relative overflow-hidden shadow-2xl shadow-slate-900/20">
              {/* Card Background Decoration */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
              
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl flex items-center justify-center text-emerald-400 shadow-sm">
                    <CalendarDays size={24} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Calendar Sync</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Google Integration</p>
                  </div>
                </div>
                
                {currentUser.google_access_token ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 size={16} />
                      <span className="text-xs font-bold uppercase tracking-wider">Connected</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed font-medium">
                      Your shifts will now be automatically synced to your Google Calendar.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-400 leading-relaxed font-medium">
                      Connect your Google account to automatically sync your assigned shifts to your personal calendar.
                    </p>
                    <button 
                      onClick={handleConnectGoogle}
                      className="w-full py-3 bg-white text-slate-900 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
                    >
                      Connect Google Calendar
                    </button>
                  </div>
                )}
              </div>

              <div className="relative z-10 mt-8 pt-6 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</span>
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${currentUser.google_access_token ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {currentUser.google_access_token ? 'Active' : 'Not Connected'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* My Tasks Section */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <CheckSquare size={20} className="text-emerald-500" />
              My Tasks
            </h3>
          </div>
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden h-[500px]">
            <StaffTaskList currentUserId={currentUser.id} />
          </div>
        </motion.div>

        {/* My Leave Requests Section */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Calendar size={20} className="text-emerald-500" />
              My Leave Requests
            </h3>
            <button 
              onClick={() => setShowLeaveForm(!showLeaveForm)}
              className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all shadow-sm"
              title="Request Leave"
            >
              <Plus size={20} />
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden h-[500px] flex flex-col">
            {showLeaveForm ? (
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">New Leave Request</h4>
                  <button onClick={() => setShowLeaveForm(false)} className="text-slate-400 hover:text-slate-600">
                    <XCircle size={20} />
                  </button>
                </div>
                <form onSubmit={handleRequestLeave} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Date</label>
                      <input 
                        type="date" 
                        required
                        value={newLeave.start_date}
                        onChange={(e) => setNewLeave({ ...newLeave, start_date: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">End Date</label>
                      <input 
                        type="date" 
                        required
                        value={newLeave.end_date}
                        onChange={(e) => setNewLeave({ ...newLeave, end_date: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reason</label>
                    <textarea 
                      required
                      rows={3}
                      value={newLeave.reason}
                      onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })}
                      placeholder="Briefly explain your reason for leave..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all resize-none"
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
                  >
                    {loading ? 'Submitting...' : 'Submit Request'}
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {leaveRequests.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                    <Calendar size={48} strokeWidth={1} />
                    <p className="text-sm font-medium">No leave requests found.</p>
                  </div>
                ) : (
                  leaveRequests.map(request => (
                    <div key={request.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(request.status)}
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${getStatusBadgeClass(request.status)}`}>
                            {request.status}
                          </span>
                        </div>
                        <span className="text-[10px] font-medium text-slate-400">
                          Requested on {new Date(request.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-700">
                          {new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-slate-500 line-clamp-2 italic">"{request.reason}"</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};
