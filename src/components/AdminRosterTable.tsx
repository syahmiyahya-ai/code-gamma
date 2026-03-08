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
}

export const AdminRosterTable: React.FC<AdminRosterTableProps> = ({
  users,
  dates,
  shifts,
  shiftTypes,
  onUpdateShift,
  isAdmin,
  currentUserId,
  onRefresh
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

  const handleCellClick = (userId: string, dateStr: string) => {
    if (!isAdmin) return;

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
      {/* Header with Bulk Toggle */}
      {isAdmin && (
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setBulkEditMode(!bulkEditMode);
                setSelectedCells([]);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${bulkEditMode ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
            >
              <div className={`w-2 h-2 rounded-full ${bulkEditMode ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'}`}></div>
              {bulkEditMode ? 'Exit Bulk Edit' : 'Bulk Edit Mode'}
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
            {!bulkEditMode && (
              <button
                onClick={handleExportCSV}
                className="px-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-2"
              >
                <Download size={14} />
                Export CSV
              </button>
            )}
          </div>
          {bulkEditMode && (
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Click cells to select/deselect
            </p>
          )}
        </div>
      )}

      <div 
        className="overflow-auto max-h-[70vh]"
        onMouseLeave={() => {
          if (isDragging) {
            setIsDragging(false);
            setDragStart(null);
            setDragEnd(null);
          }
        }}
      >
        <table role="grid" className="w-full border-separate border-spacing-0">
          <thead>
            <tr className="bg-slate-50">
              {/* Sticky Top-Left Corner */}
              <th 
                role="columnheader"
                className="sticky top-0 left-0 z-30 bg-slate-50 p-4 text-left border-b border-r border-slate-200 min-w-[200px] shadow-[2px_2px_0_rgba(0,0,0,0.05)]"
              >
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Doctor / Date</div>
              </th>
              {/* Sticky Top Row (Dates) */}
              {dates.map(date => (
                <th 
                  key={date.toISOString()} 
                  role="columnheader"
                  className="sticky top-0 z-20 bg-slate-50 p-4 text-center border-b border-r border-slate-200 min-w-[70px]"
                >
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                    {date.toLocaleDateString('default', { weekday: 'short' })}
                  </div>
                  <div className={`text-sm font-bold ${[0, 6].includes(date.getDay()) ? 'text-rose-500' : 'text-slate-700'}`}>
                    {date.getDate()}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((user, userIdx) => (
              <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                {/* Sticky First Column (Doctors) */}
                <td 
                  role="rowheader"
                  className="sticky left-0 z-10 bg-white p-4 border-b border-r border-slate-200 font-medium text-slate-700 shadow-[2px_0_0_rgba(0,0,0,0.05)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-bold">
                      {user.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="text-sm font-bold truncate max-w-[120px]">{user.name}</p>
                      <p className="text-[10px] text-slate-400 font-medium uppercase">{user.role}</p>
                    </div>
                  </div>
                </td>
                {/* Data Cells */}
                {dates.map((date, dateIdx) => {
                  const dateStr = formatDate(date);
                  const shift = getShift(user.id, dateStr);
                  const type = shiftTypes.find(t => t.code === shift?.shift_code);
                  const isSelected = selectedCell?.userId === user.id && selectedCell?.date === dateStr;
                  const isBulkSelected = selectedCells.some(c => c.userId === user.id && c.date === dateStr);
                  
                  // Check if cell is within current drag rectangle
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
                      role="gridcell"
                      aria-label={`${user.name}, ${new Date(dateStr).toLocaleDateString('default', { day: 'numeric', month: 'short', year: 'numeric' })}${shift ? `, Shift: ${shift.shift_code}${shift.is_code_blue ? ' (Code Blue)' : ''}` : ', No shift'}`}
                      className={`p-2 border-b border-r border-slate-100 text-center transition-all relative group select-none ${isSelected ? 'bg-emerald-50/50' : ''} ${isAdmin ? 'cursor-pointer' : ''}`}
                      onClick={() => handleCellClick(user.id, dateStr)}
                      onMouseDown={() => handleMouseDown(userIdx, dateIdx)}
                      onMouseEnter={() => handleMouseEnter(userIdx, dateIdx)}
                      onMouseUp={() => handleMouseUp(userIdx, dateIdx)}
                    >
                      {/* Selection Overlay for Bulk Mode or Dragging */}
                      {(bulkEditMode || isDragging) && (
                        <div className={`absolute inset-0 z-10 transition-all ${isBulkSelected || isInDragRange ? 'bg-emerald-500/20 border-2 border-emerald-500' : 'hover:bg-slate-200/30'}`}>
                          {isBulkSelected && (
                            <div className="absolute top-1 left-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm">
                              <Check size={8} strokeWidth={4} />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Tooltip */}
                      {shift && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900 text-white text-[10px] p-3 rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none shadow-2xl">
                          <p className="font-black border-b border-white/10 pb-1.5 mb-1.5 text-emerald-400 uppercase tracking-wider">{user.name}</p>
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400">Date</span>
                              <span className="font-bold">{new Date(dateStr).toLocaleDateString('default', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400">Shift</span>
                              <span className="px-1.5 py-0.5 rounded bg-white/10 font-bold">{shift.shift_code}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400">Code Blue</span>
                              <span className={`font-bold ${shift.is_code_blue === 1 ? 'text-rose-400' : 'text-slate-300'}`}>
                                {shift.is_code_blue === 1 ? 'ACTIVE' : 'NO'}
                              </span>
                            </div>
                          </div>
                          {/* Arrow */}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900"></div>
                        </div>
                      )}

                      <div 
                        className={`h-10 w-full rounded-lg flex items-center justify-center text-xs font-bold transition-transform active:scale-95 ${!shift ? 'border-2 border-dashed border-slate-100' : ''}`}
                        style={type ? { backgroundColor: type.background_color, color: type.text_color } : {}}
                      >
                        {shift?.shift_code || ''}

                        {user.id === currentUserId && shift && !['HK1', 'HK2', 'HK3', 'HK4', 'HKA', 'HKO', 'CR', 'EL'].includes(shift.shift_code) && !bulkEditMode && (
                          <div className="absolute inset-0 bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col items-center justify-center gap-1 z-20">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSwapRequesterShift(shift);
                                setIsSwapModalOpen(true);
                              }}
                              className="flex items-center gap-1 hover:text-emerald-400 transition-colors"
                              title="Request Swap"
                            >
                              <ArrowRightLeft size={12} />
                              <span className="text-[8px] font-black uppercase tracking-tighter">Swap</span>
                            </button>
                            {currentUser?.google_access_token && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSyncCalendar(shift);
                                }}
                                disabled={syncingId === shift.id}
                                className="flex items-center gap-1 hover:text-blue-400 transition-colors"
                                title="Sync to Google Calendar"
                              >
                                {syncingId === shift.id ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : syncedIds.includes(shift.id!) ? (
                                  <CheckCircle2 size={12} className="text-emerald-400" />
                                ) : (
                                  <CalendarDays size={12} />
                                )}
                                <span className="text-[8px] font-black uppercase tracking-tighter">
                                  {syncedIds.includes(shift.id!) ? 'Synced' : 'Sync'}
                                </span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      {shift?.is_code_blue === 1 && (
                        <div className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full animate-pulse shadow-sm"></div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
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
