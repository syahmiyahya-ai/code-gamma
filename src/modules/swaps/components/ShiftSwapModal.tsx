import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowRightLeft, User as UserIcon, Calendar as CalendarIcon, MessageSquare, Loader2, CheckCircle2 } from 'lucide-react';

interface User {
  id: string;
  name: string;
  role: 'Admin' | 'Staff';
}

interface Shift {
  id?: number;
  user_id: string;
  date: string;
  shift_code: string;
  is_code_blue: number;
}

interface ShiftSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  requesterShift: Shift;
  users: User[];
  allShifts: Shift[];
  currentUserId: string;
  onSuccess: () => void;
}

export const ShiftSwapModal: React.FC<ShiftSwapModalProps> = ({
  isOpen,
  onClose,
  requesterShift,
  users,
  allShifts,
  currentUserId,
  onSuccess
}) => {
  const [swapType, setSwapType] = useState<'specific' | 'giveaway'>('specific');
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [targetShiftId, setTargetShiftId] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetUsers = useMemo(() => users.filter(u => u.id !== currentUserId), [users, currentUserId]);

  const availableTargetShifts = useMemo(() => {
    if (!targetUserId || swapType === 'giveaway') return [];
    return allShifts.filter(s => s.user_id === targetUserId && s.date !== requesterShift.date);
  }, [targetUserId, allShifts, requesterShift.date, swapType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (swapType === 'specific' && !targetUserId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/shift-swaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requester_id: currentUserId,
          requester_shift_id: requesterShift.id,
          target_user_id: swapType === 'specific' ? targetUserId : null,
          target_shift_id: swapType === 'specific' ? targetShiftId : null,
          reason
        })
      });

      if (!res.ok) throw new Error('Failed to submit swap request');
      
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                  <ArrowRightLeft size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Request Shift Swap</h2>
                  <p className="text-xs text-slate-500 font-medium">Propose a shift exchange with a colleague</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Requester Shift Info */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Your Shift</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white rounded-lg border border-slate-200 flex items-center justify-center text-emerald-600">
                      <CalendarIcon size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700">{requesterShift.date}</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">{requesterShift.shift_code} Shift</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {/* Swap Type Selection */}
                <div className="flex p-1 bg-slate-100 rounded-xl gap-1">
                  <button
                    type="button"
                    onClick={() => setSwapType('specific')}
                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${swapType === 'specific' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Swap with Colleague
                  </button>
                  <button
                    type="button"
                    onClick={() => setSwapType('giveaway')}
                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${swapType === 'giveaway' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Open Giveaway
                  </button>
                </div>

                {/* Target User Selection */}
                {swapType === 'specific' && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Swap With</label>
                    <div className="relative group">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-emerald-500 transition-colors" />
                      <select
                        required
                        value={targetUserId}
                        onChange={(e) => {
                          setTargetUserId(e.target.value);
                          setTargetShiftId(null);
                        }}
                        className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-sm focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all appearance-none cursor-pointer"
                      >
                        <option value="">Select a colleague...</option>
                        {targetUsers.map(user => (
                          <option key={user.id} value={user.id}>{user.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Target Shift Selection */}
                <AnimatePresence>
                  {swapType === 'specific' && targetUserId && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-1.5"
                    >
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Colleague's Shift (Optional)</label>
                      <div className="relative group">
                        <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-emerald-500 transition-colors" />
                        <select
                          value={targetShiftId || ''}
                          onChange={(e) => setTargetShiftId(e.target.value ? Number(e.target.value) : null)}
                          className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-sm focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all appearance-none cursor-pointer"
                        >
                          <option value="">Giveaway (No exchange shift)</option>
                          {availableTargetShifts.map(shift => (
                            <option key={shift.id} value={shift.id}>
                              {shift.date} - {shift.shift_code} Shift
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className="text-[10px] text-slate-400 ml-1 italic">Leave empty if you just want this specific person to take your shift.</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {swapType === 'giveaway' && (
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                    <p className="text-xs text-emerald-700 font-medium leading-relaxed">
                      Posting as an <span className="font-bold">Open Giveaway</span> means any colleague will be able to see and claim this shift. Once claimed, it will await admin approval.
                    </p>
                  </div>
                )}

                {/* Reason */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Reason (Optional)</label>
                  <div className="relative group">
                    <MessageSquare className="absolute left-4 top-4 text-slate-400 w-5 h-5 group-focus-within:text-emerald-500 transition-colors" />
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-sm focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all resize-none"
                      placeholder="e.g., Family emergency, medical appointment..."
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-xs text-rose-600 font-medium">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-6 py-3.5 rounded-2xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || (swapType === 'specific' && !targetUserId)}
                  className="flex-[2] px-6 py-3.5 rounded-2xl text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>
                      <span>Send Request</span>
                      <CheckCircle2 size={18} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
