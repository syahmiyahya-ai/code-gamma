import React, { useState, useEffect } from 'react';
import { Clock, Plus, Check, X, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { hasPermission, UserRole } from '../../../shared/auth/permissions';

interface OwedDay {
  id: number;
  user_id: string;
  user_name: string;
  type: 'PN' | 'HKO';
  reason: string;
  date_earned: string;
  date_redeemed: string | null;
  status: 'OWED' | 'REDEEMED';
}

interface User {
  id: string;
  name: string;
}

interface Props {
  currentUser: { id: string; role: UserRole } | null;
  users: User[];
}

const OwedDaysManager: React.FC<Props> = ({ currentUser, users }) => {
  const [owedDays, setOwedDays] = useState<OwedDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newOwed, setNewOwed] = useState({
    user_id: '',
    type: 'PN' as 'PN' | 'HKO',
    reason: '',
    date_earned: new Date().toISOString().split('T')[0]
  });

  const fetchOwedDays = async () => {
    try {
      const url = hasPermission(currentUser?.role, 'manage_owed_days') 
        ? '/api/owed-days' 
        : `/api/owed-days?user_id=${currentUser?.id}`;
      const res = await fetch(url);
      const data = await res.json();
      setOwedDays(data);
    } catch (err) {
      console.error("Failed to fetch owed days", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) fetchOwedDays();
  }, [currentUser]);

  const handleAdd = async () => {
    try {
      const res = await fetch('/api/owed-days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOwed)
      });
      if (res.ok) {
        setShowAddModal(false);
        fetchOwedDays();
      }
    } catch (err) {
      console.error("Failed to add owed day", err);
    }
  };

  const handleRedeem = async (id: number) => {
    try {
      const res = await fetch(`/api/owed-days/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: 'REDEEMED',
          date_redeemed: new Date().toISOString().split('T')[0]
        })
      });
      if (res.ok) fetchOwedDays();
    } catch (err) {
      console.error("Failed to redeem owed day", err);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600">
            <Clock size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Owed Days</h3>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">PN & HKO Tracking</p>
          </div>
        </div>
        {hasPermission(currentUser?.role, 'manage_owed_days') && (
          <button 
            onClick={() => setShowAddModal(true)}
            className="p-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors shadow-lg shadow-orange-100"
          >
            <Plus size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="h-40 flex items-center justify-center">
            <Loader2 className="animate-spin text-orange-500" />
          </div>
        ) : owedDays.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-slate-400 text-center px-6">
            <Clock size={32} strokeWidth={1} className="mb-2" />
            <p className="text-xs font-bold">No owed days recorded</p>
          </div>
        ) : (
          owedDays.map(day => (
            <div key={day.id} className={`p-4 rounded-xl border transition-all ${day.status === 'OWED' ? 'bg-orange-50/50 border-orange-100' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${day.type === 'PN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {day.type === 'PN' ? 'Postnight' : 'HK Owed'}
                    </span>
                    <span className="text-xs font-bold text-slate-700 truncate">{day.user_name}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mb-1 font-medium">Earned: {new Date(day.date_earned).toLocaleDateString()}</p>
                  {day.reason && <p className="text-xs text-slate-600 italic">"{day.reason}"</p>}
                  {day.status === 'REDEEMED' && (
                    <p className="text-[10px] text-emerald-600 font-bold mt-2 flex items-center gap-1">
                      <Check size={10} /> Redeemed on {new Date(day.date_redeemed!).toLocaleDateString()}
                    </p>
                  )}
                </div>
                {hasPermission(currentUser?.role, 'manage_owed_days') && day.status === 'OWED' && (
                  <button 
                    onClick={() => handleRedeem(day.id)}
                    className="p-2 bg-white text-emerald-600 border border-emerald-100 rounded-lg hover:bg-emerald-50 transition-colors shadow-sm"
                    title="Mark as Redeemed"
                  >
                    <Check size={16} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800">Record Owed Day</h3>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Staff Member</label>
                  <select 
                    value={newOwed.user_id}
                    onChange={(e) => setNewOwed({...newOwed, user_id: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  >
                    <option value="">Select Staff...</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => setNewOwed({...newOwed, type: 'PN'})}
                      className={`py-3 rounded-xl text-xs font-bold transition-all ${newOwed.type === 'PN' ? 'bg-purple-600 text-white shadow-lg' : 'bg-slate-100 text-slate-500'}`}
                    >
                      Postnight (PN)
                    </button>
                    <button 
                      onClick={() => setNewOwed({...newOwed, type: 'HKO'})}
                      className={`py-3 rounded-xl text-xs font-bold transition-all ${newOwed.type === 'HKO' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-500'}`}
                    >
                      HK Owed (HKO)
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date Earned</label>
                  <input 
                    type="date"
                    value={newOwed.date_earned}
                    onChange={(e) => setNewOwed({...newOwed, date_earned: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Reason (Optional)</label>
                  <textarea 
                    value={newOwed.reason}
                    onChange={(e) => setNewOwed({...newOwed, reason: e.target.value})}
                    placeholder="e.g., Overridden PN due to emergency"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none h-24 resize-none"
                  />
                </div>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAdd}
                  disabled={!newOwed.user_id}
                  className="flex-1 py-3 bg-orange-600 text-white text-sm font-bold rounded-xl hover:bg-orange-700 transition-all shadow-lg shadow-orange-100 disabled:opacity-50"
                >
                  Record Owed Day
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OwedDaysManager;
