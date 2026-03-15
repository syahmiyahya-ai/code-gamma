import React, { useState, useMemo } from 'react';
import { X, Check, AlertCircle, Download, ArrowRightLeft, CalendarDays, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ShiftSwapModal } from './ShiftSwapModal';

import { UserRole } from '../utils/permissions';

interface User {
  id: string;
  name: string;
  role: UserRole;
  google_access_token?: string;
}

interface ShiftType {
  code: string;
  background_color: string;
  text_color: string;
}

interface Shift {
  id?: number;
  user_id: string;
  date: string;
  shift_code: string;
  is_code_blue: number;
}

interface AdminRosterTableProps {
  users: User[];
  dates: Date[];
  shifts: Shift[];
  shiftTypes: ShiftType[];
  onUpdateShift: (userId: string, date: string, shiftCode: string | null, isCodeBlue: boolean) => Promise<void>;
  isAdmin: boolean;
  currentUserId?: string;
  onRefresh?: () => void;
  pendingSwaps?: any[];
}

export const AdminRosterTable: React.FC<AdminRosterTableProps> = ({
  users,
  dates,
  shifts,
  shiftTypes,
  onUpdateShift,
  isAdmin,
  currentUserId,
  onRefresh,
  pendingSwaps = []
}) => {
  const [selectedCell, setSelectedCell] = useState<{ userId: string; date: string } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [syncedIds, setSyncedIds] = useState<number[]>([]);
  
  // Swap Modal State
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [swapRequesterShift, setSwapRequesterShift] = useState<Shift | null>(null);

  const currentUser = useMemo(() => users.find(u => u.id === currentUserId), [users, currentUserId]);

  const handleSyncCalendar = async (shift: Shift) => {
    if (!shift.id || !currentUserId) return;
    setSyncingId(shift.id);
    try {
      const res = await fetch('/api/shifts/sync-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift_id: shift.id, user_id: currentUserId })
      });
      if (res.ok) {
        setSyncedIds(prev => [...prev, shift.id!]);
        setTimeout(() => setSyncedIds(prev => prev.filter(id => id !== shift.id)), 3000);
      }
    } catch (err) {
      console.error("Failed to sync calendar", err);
    } finally {
      setSyncingId(null);
    }
  };

  // Bulk Edit State
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [selectedCells, setSelectedCells] = useState<{ userId: string; date: string }[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Paint Mode State (Quick Assign)
  const [paintMode, setPaintMode] = useState(false);
  const [activePaintShift, setActivePaintShift] = useState<string | null>(null);
  const [activePaintIsCodeBlue, setActivePaintIsCodeBlue] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // Drag Selection State
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ userIdx: number; dateIdx: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ userIdx: number; dateIdx: number } | null>(null);

  // Local state for the modal/dropdown
  const [pendingShiftCode, setPendingShiftCode] = useState<string | null>(null);
  const [pendingIsCodeBlue, setPendingIsCodeBlue] = useState(false);

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getShift = (userId: string, dateStr: string) => {
    return shifts.find(s => s.user_id === userId && s.date === dateStr);
  };

  const getCounts = (userId: string) => {
    const userShifts = shifts.filter(s => s.user_id === userId);
    return {
      pm: userShifts.filter(s => s.shift_code === 'PM').length,
      ns: userShifts.filter(s => s.shift_code === 'NS').length
    };
  };

  const handleMouseDown = (userIdx: number, dateIdx: number) => {
    if (!isAdmin) return;
    setIsDragging(true);
    setDragStart({ userIdx, dateIdx });
    setDragEnd({ userIdx, dateIdx });
    
    // If not in bulk mode and we start dragging, we might want to clear single selection
    if (!bulkEditMode) {
      setSelectedCell(null);
    }
  };

  const handleMouseEnter = (userIdx: number, dateIdx: number) => {
    if (isDragging) {
      setDragEnd({ userIdx, dateIdx });
    }
  };

  const handleMouseUp = (userIdx: number, dateIdx: number) => {
    if (isDragging && dragStart) {
      const minUser = Math.min(dragStart.userIdx, userIdx);
      const maxUser = Math.max(dragStart.userIdx, userIdx);
      const minDate = Math.min(dragStart.dateIdx, dateIdx);
      const maxDate = Math.max(dragStart.dateIdx, dateIdx);

      const isSingleCell = dragStart.userIdx === userIdx && dragStart.dateIdx === dateIdx;

      if (isSingleCell) {
        if (bulkEditMode) {
          const userId = users[userIdx].id;
          const dateStr = formatDate(dates[dateIdx]);
          const isAlreadySelected = selectedCells.some(c => c.userId === userId && c.date === dateStr);
          if (isAlreadySelected) {
            setSelectedCells(selectedCells.filter(c => !(c.userId === userId && c.date === dateStr)));
          } else {
            setSelectedCells([...selectedCells, { userId, date: dateStr }]);
          }
        } else {
          // Normal click behavior is handled by handleCellClick
        }
      } else {
        // Multi-cell selection
        const newSelections: { userId: string; date: string }[] = [];
        for (let u = minUser; u <= maxUser; u++) {
          for (let d = minDate; d <= maxDate; d++) {
            const userId = users[u].id;
            const dateStr = formatDate(dates[d]);
            if (!newSelections.some(c => c.userId === userId && c.date === dateStr)) {
              newSelections.push({ userId, date: dateStr });
            }
          }
        }

        setBulkEditMode(true);
        setSelectedCells(prev => {
          const merged = [...prev];
          newSelections.forEach(cell => {
            if (!merged.some(c => c.userId === cell.userId && c.date === cell.date)) {
              merged.push(cell);
            }
          });
          return merged;
        });
      }
    }
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [users, searchQuery]);

  const handleCellClick = async (userId: string, dateStr: string) => {
    if (!isAdmin) return;

    // Paint Mode Logic
    if (paintMode && activePaintShift !== undefined) {
      setIsUpdating(true);
      try {
        await onUpdateShift(userId, dateStr, activePaintShift, activePaintIsCodeBlue);
      } finally {
        setIsUpdating(false);
      }
      return;
    }

    // If we just finished a drag that wasn't a single cell, don't open the modal
    if (bulkEditMode) return;

    const currentShift = getShift(userId, dateStr);
    setSelectedCell({ userId, date: dateStr });
    setPendingShiftCode(currentShift?.shift_code || null);
    setPendingIsCodeBlue(currentShift?.is_code_blue === 1);
  };

  const handleBulkSave = async () => {
    if (selectedCells.length === 0) return;
    setIsUpdating(true);
    try {
      await Promise.all(selectedCells.map(cell => 
        onUpdateShift(cell.userId, cell.date, pendingShiftCode, pendingIsCodeBlue)
      ));
      setSelectedCells([]);
      setBulkEditMode(false);
      setShowBulkModal(false);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleExportCSV = () => {
    // 1. Prepare headers
    const headers = ['Doctor', ...dates.map(d => d.toLocaleDateString('default', { day: 'numeric', month: 'short' }))];
    
    // 2. Prepare rows
    const rows = users.map(user => {
      const rowData = [user.name];
      dates.forEach(date => {
        const dateStr = formatDate(date);
        const shift = getShift(user.id, dateStr);
        let cellValue = shift?.shift_code || '-';
        if (shift?.is_code_blue === 1) {
          cellValue += ' (CB)';
        }
        rowData.push(cellValue);
      });
      return rowData;
    });

    // 3. Construct CSV string
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // 4. Trigger Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `roster_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSave = async () => {
    if (!selectedCell) return;
    setIsUpdating(true);
    try {
      await onUpdateShift(
        selectedCell.userId,
        selectedCell.date,
        pendingShiftCode,
        pendingIsCodeBlue
      );
      setSelectedCell(null);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="relative bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header with Bulk Toggle and Search */}
      {isAdmin && (
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setBulkEditMode(!bulkEditMode);
                  setSelectedCells([]);
                  setPaintMode(false);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${bulkEditMode ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
              >
                <div className={`w-2 h-2 rounded-full ${bulkEditMode ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'}`}></div>
                {bulkEditMode ? 'Exit Bulk Edit' : 'Bulk Edit Mode'}
              </button>

              <button
                onClick={() => {
                  setPaintMode(!paintMode);
                  setBulkEditMode(false);
                  setSelectedCells([]);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${paintMode ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
              >
                <div className={`w-2 h-2 rounded-full ${paintMode ? 'bg-indigo-300 animate-pulse' : 'bg-slate-300'}`}></div>
                {paintMode ? 'Exit Paint Mode' : 'Paint Mode (Quick Assign)'}
              </button>

              {bulkEditMode && selectedCells.length > 0 && (
                <motion.button
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => setShowBulkModal(true)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center gap-2"
                >
                  Assign to {selectedCells.length} Cells
                </motion.button>
              )}
              {!bulkEditMode && !paintMode && (
                <button
                  onClick={handleExportCSV}
                  className="px-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-2"
                >
                  <Download size={14} />
                  Export CSV
                </button>
              )}
            </div>

            <div className="relative flex-1 max-w-xs">
              <input
                type="text"
                placeholder="Search Doctor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
              <CalendarDays size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {/* Paint Mode Palette */}
          <AnimatePresence>
            {paintMode && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 flex flex-wrap items-center gap-4">
                  <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Select Paint Tool:</div>
                  <div className="flex flex-wrap items-center gap-2">
                    {shiftTypes.map(type => (
                      <button
                        key={type.code}
                        onClick={() => setActivePaintShift(type.code)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all border-2 ${activePaintShift === type.code ? 'border-indigo-600 scale-110 shadow-md' : 'border-transparent opacity-70 hover:opacity-100'}`}
                        style={{ backgroundColor: type.background_color, color: type.text_color }}
                      >
                        {type.code}
                      </button>
                    ))}
                    <button
                      onClick={() => setActivePaintShift(null)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all border-2 ${activePaintShift === null ? 'border-indigo-600 bg-white' : 'border-dashed border-indigo-200 text-indigo-400'}`}
                    >
                      CLEAR
                    </button>
                  </div>
                  <div className="h-6 w-px bg-indigo-200 mx-2" />
                  <button
                    onClick={() => setActivePaintIsCodeBlue(!activePaintIsCodeBlue)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${activePaintIsCodeBlue ? 'bg-rose-500 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-200'}`}
                  >
                    <AlertCircle size={12} />
                    CODE BLUE
                  </button>
                  <div className="ml-auto text-[10px] font-bold text-indigo-500 italic">
                    * Click cells to apply "{activePaintShift || 'CLEAR'}" {activePaintIsCodeBlue ? '+ CB' : ''}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div 
        className="overflow-auto max-h-[70vh] relative"
        onMouseLeave={() => {
          if (isDragging) {
            setIsDragging(false);
            setDragStart(null);
            setDragEnd(null);
          }
        }}
      >
        {isUpdating && (
          <div className="absolute inset-0 z-[60] bg-white/10 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
            <div className="bg-white/80 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-white/20 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
              <span className="text-xs font-bold text-slate-600">Updating...</span>
            </div>
          </div>
        )}
        <table role="grid" className="w-full border-separate border-spacing-0 border-t border-l border-slate-300">
          <thead>
            {/* Row 1: TARIKH */}
            <tr className="bg-slate-100">
              <th className="sticky top-0 left-0 z-40 bg-slate-200 p-1 text-center border-b border-r border-slate-300 lg:min-w-[120px] min-w-[80px] text-[10px] font-bold uppercase">TARIKH</th>
              {dates.map(date => (
                <th key={`h1-${date.toISOString()}`} className="sticky top-0 z-20 bg-slate-100 p-1 text-center border-b border-r border-slate-300 min-w-[60px] text-[10px] font-bold">
                  {date.getDate()}-{date.toLocaleDateString('default', { month: 'short' })}
                </th>
              ))}
            </tr>
            {/* Row 2: HARI */}
            <tr className="bg-slate-100">
              <th className="sticky top-[25px] left-0 z-40 bg-slate-200 p-1 text-center border-b border-r border-slate-300 text-[10px] font-bold uppercase">HARI</th>
              {dates.map(date => (
                <th key={`h2-${date.toISOString()}`} className="sticky top-[25px] z-20 bg-slate-100 p-1 text-center border-b border-r border-slate-300 text-[10px] font-bold">
                  {date.toLocaleDateString('default', { weekday: 'short' })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user, userIdx) => {
              return (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="sticky left-0 z-10 bg-white p-1 border-b border-r border-slate-300 text-[10px] font-bold uppercase text-slate-700 truncate lg:max-w-[120px] max-w-[80px]">
                    {user.name}
                  </td>
                  {dates.map((date, dateIdx) => {
                    const dateStr = formatDate(date);
                    const shift = getShift(user.id, dateStr);
                    const type = shiftTypes.find(t => t.code === shift?.shift_code);
                    const isSelected = selectedCell?.userId === user.id && selectedCell?.date === dateStr;
                    const isBulkSelected = selectedCells.some(c => c.userId === user.id && c.date === dateStr);
                    
                    const hasPendingSwap = pendingSwaps.some(s => 
                      (s.requester_id === user.id && s.requester_shift_date === dateStr) ||
                      (s.target_user_id === user.id && s.target_shift_date === dateStr)
                    );

                    let isInDragRange = false;
                    if (isDragging && dragStart && dragEnd) {
                      const minU = Math.min(dragStart.userIdx, dragEnd.userIdx);
                      const maxU = Math.max(dragStart.userIdx, dragEnd.userIdx);
                      const minD = Math.min(dragStart.dateIdx, dragEnd.dateIdx);
                      const maxD = Math.max(dragStart.dateIdx, dragEnd.dateIdx);
                      isInDragRange = userIdx >= minU && userIdx <= maxU && dateIdx >= minD && dateIdx <= maxD;
                    }

                    return (
                      <td 
                        key={dateStr} 
                        className={`p-0 border-b border-r border-slate-300 text-center transition-all relative group select-none h-8 ${isSelected ? 'ring-2 ring-emerald-500 z-20' : ''} ${isAdmin ? 'cursor-pointer' : ''}`}
                        onClick={() => handleCellClick(user.id, dateStr)}
                        onMouseDown={() => handleMouseDown(userIdx, dateIdx)}
                        onMouseEnter={() => handleMouseEnter(userIdx, dateIdx)}
                        onMouseUp={() => handleMouseUp(userIdx, dateIdx)}
                      >
                        <div 
                          className={`w-full h-full flex items-center justify-center text-[10px] font-bold transition-all ${hasPendingSwap ? 'ring-1 ring-inset ring-amber-400' : ''}`}
                          style={type ? { 
                            backgroundColor: type.background_color, 
                            color: type.text_color,
                            boxShadow: isSelected ? 'inset 0 0 0 2px rgba(16, 185, 129, 0.5)' : 'none'
                          } : {}}
                        >
                          {shift?.shift_code || ''}
                          {shift?.is_code_blue === 1 && (
                            <div className="absolute top-0 right-0 w-0 h-0 border-t-[8px] border-l-[8px] border-l-transparent border-t-rose-600 z-10" title="Code Blue Duty" />
                          )}
                          {hasPendingSwap && (
                            <div className="absolute bottom-0.5 right-0.5 text-amber-500 animate-pulse" title="Pending Swap Request">
                              <ArrowRightLeft size={8} strokeWidth={3} />
                            </div>
                          )}
                        </div>
                        {(bulkEditMode || isDragging) && (isBulkSelected || isInDragRange) && (
                          <div className="absolute inset-0 bg-emerald-500/20 border border-emerald-500 z-10 pointer-events-none" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Floating Bulk Action Bar */}
      <AnimatePresence>
        {bulkEditMode && selectedCells.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-4 rounded-[2rem] shadow-2xl flex items-center gap-6 border border-white/10 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 pr-6 border-r border-white/10">
              <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Check size={20} />
              </div>
              <div>
                <p className="text-sm font-bold">{selectedCells.length} Cells Selected</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Bulk Edit Active</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setPendingShiftCode(null);
                  setPendingIsCodeBlue(false);
                  setShowBulkModal(true);
                }}
                className="px-6 py-2.5 bg-white text-slate-900 rounded-xl text-xs font-bold hover:bg-slate-100 transition-all flex items-center gap-2"
              >
                Assign Shift
              </button>
              <button
                onClick={() => {
                  setSelectedCells([]);
                  setBulkEditMode(false);
                }}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
              >
                <X size={14} />
                Clear
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Bulk Edit Modal */}
      <AnimatePresence>
        {showBulkModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBulkModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Bulk Assignment</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Assigning to {selectedCells.length} selected slots
                  </p>
                </div>
                <button onClick={() => setShowBulkModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Shift</label>
                  <div className="grid grid-cols-4 gap-2">
                    {shiftTypes.map(type => (
                      <button
                        key={type.code}
                        onClick={() => setPendingShiftCode(type.code)}
                        className={`h-12 rounded-xl flex items-center justify-center text-xs font-bold transition-all border-2 ${pendingShiftCode === type.code ? 'border-slate-900 scale-105 shadow-md' : 'border-transparent opacity-70 hover:opacity-100'}`}
                        style={{ backgroundColor: type.background_color, color: type.text_color }}
                      >
                        {type.code}
                      </button>
                    ))}
                    <button
                      onClick={() => setPendingShiftCode(null)}
                      className={`h-12 rounded-xl flex items-center justify-center text-[10px] font-bold transition-all border-2 ${pendingShiftCode === null ? 'border-slate-900 bg-slate-100' : 'border-dashed border-slate-200 text-slate-400'}`}
                    >
                      CLEAR
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${pendingIsCodeBlue ? 'bg-rose-100 text-rose-600' : 'bg-slate-200 text-slate-400'}`}>
                      <AlertCircle size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">Code Blue Duty</p>
                      <p className="text-[10px] text-slate-500 font-medium">Apply to all selected</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setPendingIsCodeBlue(!pendingIsCodeBlue)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${pendingIsCodeBlue ? 'bg-rose-500' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${pendingIsCodeBlue ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={() => setShowBulkModal(false)}
                  className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleBulkSave}
                  disabled={isUpdating}
                  className="flex-1 py-3 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isUpdating ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Check size={18} />
                  )}
                  Apply Bulk
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {selectedCell && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCell(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Edit Assignment</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {users.find(u => u.id === selectedCell.userId)?.name} • {new Date(selectedCell.date).toLocaleDateString('default', { dateStyle: 'long' })}
                  </p>
                </div>
                <button onClick={() => setSelectedCell(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Shift Selection */}
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Shift</label>
                  <div className="grid grid-cols-4 gap-2">
                    {shiftTypes.map(type => (
                      <button
                        key={type.code}
                        onClick={() => setPendingShiftCode(type.code)}
                        className={`h-12 rounded-xl flex items-center justify-center text-xs font-bold transition-all border-2 ${pendingShiftCode === type.code ? 'border-slate-900 scale-105 shadow-md' : 'border-transparent opacity-70 hover:opacity-100'}`}
                        style={{ backgroundColor: type.background_color, color: type.text_color }}
                      >
                        {type.code}
                      </button>
                    ))}
                    <button
                      onClick={() => setPendingShiftCode(null)}
                      className={`h-12 rounded-xl flex items-center justify-center text-[10px] font-bold transition-all border-2 ${pendingShiftCode === null ? 'border-slate-900 bg-slate-100' : 'border-dashed border-slate-200 text-slate-400'}`}
                    >
                      CLEAR
                    </button>
                  </div>
                </div>

                {/* Code Blue Toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${pendingIsCodeBlue ? 'bg-rose-100 text-rose-600' : 'bg-slate-200 text-slate-400'}`}>
                      <AlertCircle size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">Code Blue Duty</p>
                      <p className="text-[10px] text-slate-500 font-medium">Prioritize in daily summary</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setPendingIsCodeBlue(!pendingIsCodeBlue)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${pendingIsCodeBlue ? 'bg-rose-500' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${pendingIsCodeBlue ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={() => setSelectedCell(null)}
                  className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave}
                  disabled={isUpdating}
                  className="flex-1 py-3 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isUpdating ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Check size={18} />
                  )}
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {swapRequesterShift && (
        <ShiftSwapModal
          isOpen={isSwapModalOpen}
          onClose={() => setIsSwapModalOpen(false)}
          requesterShift={swapRequesterShift}
          users={users}
          allShifts={shifts}
          currentUserId={currentUserId || ''}
          onSuccess={() => onRefresh?.()}
        />
      )}
    </div>
  );
};
