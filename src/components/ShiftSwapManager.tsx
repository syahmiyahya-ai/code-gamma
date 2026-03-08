import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRightLeft, CheckCircle2, XCircle, Clock, User as UserIcon, Calendar as CalendarIcon, Shield, Loader2, AlertCircle } from 'lucide-react';

import { hasPermission, UserRole } from '../utils/permissions';

interface ShiftSwap {
  id: number;
  requester_id: string;
  requester_name: string;
  requester_shift_id: number;
  requester_shift_date: string;
  requester_shift_code: string;
  target_user_id: string;
  target_name: string;
  target_shift_id: number | null;
  target_shift_date: string | null;
  target_shift_code: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reason: string;
  created_at: string;
}

interface ShiftSwapManagerProps {
  currentUser: { id: string; role: UserRole };
  onUpdate?: () => void;
}

export const ShiftSwapManager: React.FC<ShiftSwapManagerProps> = ({ currentUser, onUpdate }) => {
  const [swaps, setSwaps] = useState<ShiftSwap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'my-swaps' | 'giveaways' | 'admin-approval'>(
    hasPermission(currentUser.role, 'approve_swaps') ? 'admin-approval' : 'my-swaps'
  );

  const fetchSwaps = async () => {
    setLoading(true);
    try {
      let url = '';
      if (activeTab === 'admin-approval') {
        url = `/api/shift-swaps?is_admin=true&status=ACCEPTED`;
      } else if (activeTab === 'giveaways') {
        url = `/api/shift-swaps?is_giveaway=true&status=PENDING`;
      } else {
        url = `/api/shift-swaps?user_id=${currentUser.id}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setSwaps(data);
    } catch (err) {
      setError("Failed to fetch swap requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSwaps();
  }, [activeTab, currentUser.id]);

  const handleAction = async (swapId: number, status: string) => {
    try {
      const res = await fetch(`/api/shift-swaps/${swapId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, changed_by: currentUser.id })
      });
      if (res.ok) {
        fetchSwaps();
        onUpdate?.();
      }
    } catch (err) {
      console.error("Failed to update swap request", err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'text-yellow-600 bg-yellow-50 border-yellow-100';
      case 'ACCEPTED': return 'text-blue-600 bg-blue-50 border-blue-100';
      case 'APPROVED': return 'text-emerald-600 bg-emerald-50 border-emerald-100';
      case 'REJECTED': return 'text-rose-600 bg-rose-50 border-rose-100';
      default: return 'text-slate-600 bg-slate-50 border-slate-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return <Clock size={14} />;
      case 'ACCEPTED': return <CheckCircle2 size={14} />;
      case 'APPROVED': return <CheckCircle2 size={14} />;
      case 'REJECTED': return <XCircle size={14} />;
      default: return <AlertCircle size={14} />;
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <ArrowRightLeft size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Shift Swaps</h2>
              <p className="text-xs text-slate-500 font-medium">Manage your shift exchanges</p>
            </div>
          </div>
        </div>

        <div className="flex p-1 bg-slate-100 rounded-xl gap-1">
          <button
            onClick={() => setActiveTab('my-swaps')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'my-swaps' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            My Swaps
          </button>
          <button
            onClick={() => setActiveTab('giveaways')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'giveaways' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Giveaways
          </button>
          {hasPermission(currentUser.role, 'approve_swaps') && (
            <button
              onClick={() => setActiveTab('admin-approval')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'admin-approval' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Admin Approval
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            <p className="text-sm font-medium text-slate-400">Loading swap requests...</p>
          </div>
        ) : swaps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-4">
              <ArrowRightLeft size={32} />
            </div>
            <p className="text-sm font-bold text-slate-400">No swap requests found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-[200px]">Requests will appear here once initiated or received.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {swaps.map((swap) => (
              <motion.div
                key={swap.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl border border-slate-100 bg-slate-50/30 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${getStatusColor(swap.status)}`}>
                    {getStatusIcon(swap.status)}
                    {swap.status}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">
                    {new Date(swap.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-4 mb-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <UserIcon size={14} className="text-slate-400" />
                      <span className="text-xs font-bold text-slate-700">{swap.requester_name}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-100">
                      <CalendarIcon size={12} className="text-emerald-500" />
                      <span className="text-[10px] font-bold text-slate-600">{swap.requester_shift_date} ({swap.requester_shift_code})</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center">
                    <ArrowRightLeft size={16} className="text-slate-300" />
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <UserIcon size={14} className="text-slate-400" />
                      <span className="text-xs font-bold text-slate-700">{swap.target_name || 'Open Giveaway'}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-100">
                      <CalendarIcon size={12} className="text-blue-500" />
                      <span className="text-[10px] font-bold text-slate-600">
                        {swap.target_shift_date ? `${swap.target_shift_date} (${swap.target_shift_code})` : 'Giveaway'}
                      </span>
                    </div>
                  </div>
                </div>

                {swap.reason && (
                  <div className="mb-4 p-3 bg-white rounded-xl border border-slate-100 text-[11px] text-slate-500 italic">
                    "{swap.reason}"
                  </div>
                )}

                <div className="flex gap-2">
                  {/* Actions for Giveaway */}
                  {swap.status === 'PENDING' && !swap.target_user_id && swap.requester_id !== currentUser.id && (
                    <button
                      onClick={() => handleAction(swap.id, 'ACCEPTED')}
                      className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all"
                    >
                      Claim Shift
                    </button>
                  )}

                  {/* Actions for Target User */}
                  {swap.status === 'PENDING' && swap.target_user_id === currentUser.id && (
                    <>
                      <button
                        onClick={() => handleAction(swap.id, 'ACCEPTED')}
                        className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all"
                      >
                        Accept Request
                      </button>
                      <button
                        onClick={() => handleAction(swap.id, 'REJECTED')}
                        className="flex-1 py-2 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all"
                      >
                        Decline
                      </button>
                    </>
                  )}

                  {/* Actions for Admin/Manager */}
                  {swap.status === 'ACCEPTED' && hasPermission(currentUser.role, 'approve_swaps') && (
                    <>
                      <button
                        onClick={() => handleAction(swap.id, 'APPROVED')}
                        className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2"
                      >
                        <Shield size={12} />
                        Approve Swap
                      </button>
                      <button
                        onClick={() => handleAction(swap.id, 'REJECTED')}
                        className="flex-1 py-2 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all"
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {/* Cancel for Requester */}
                  {swap.status === 'PENDING' && swap.requester_id === currentUser.id && (
                    <button
                      onClick={() => handleAction(swap.id, 'CANCELLED')}
                      className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all"
                    >
                      Cancel Request
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
