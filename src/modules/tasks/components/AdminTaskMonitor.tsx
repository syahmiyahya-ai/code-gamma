import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  CheckCircle2, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Users, 
  Bell, 
  Calendar,
  X,
  Check,
  Loader2,
  AlertCircle,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Task {
  id: number;
  title: string;
  description: string;
  due_date: string | null;
  created_by: string;
  creator_name: string;
  created_at: string;
  total_assigned: number;
  completed_count: number;
  is_edited: number;
  is_deleted: number;
}

interface Assignment {
  id: number;
  task_id: number;
  user_id: string;
  user_name: string;
  status: 'PENDING' | 'COMPLETED';
  completed_at: string | null;
}

interface User {
  id: string;
  name: string;
  role: string;
}

interface Props {
  currentUser: { id: string; role: string } | null;
  users: User[];
}

const AdminTaskMonitor: React.FC<Props> = ({ currentUser, users }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<Record<number, Assignment[]>>({});
  const [loadingAssignments, setLoadingAssignments] = useState<Record<number, boolean>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/tasks');
      const data = await res.json();
      setTasks(data);
    } catch (err) {
      console.error("Failed to fetch tasks", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async (taskId: number) => {
    if (assignments[taskId]) return;
    try {
      setLoadingAssignments(prev => ({ ...prev, [taskId]: true }));
      const res = await fetch(`/api/tasks/${taskId}/assignments`);
      const data = await res.json();
      setAssignments(prev => ({ ...prev, [taskId]: data }));
    } catch (err) {
      console.error("Failed to fetch assignments", err);
    } finally {
      setLoadingAssignments(prev => ({ ...prev, [taskId]: false }));
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleCreateTask = async () => {
    if (!newTitle || (editingTask ? false : selectedUserIds.length === 0) || !currentUser) return;
    try {
      setIsSubmitting(true);
      const url = editingTask ? `/api/tasks/${editingTask.id}` : '/api/tasks';
      const method = editingTask ? 'PATCH' : 'POST';
      const body = editingTask 
        ? { title: newTitle, description: newDesc, due_date: newDueDate || null }
        : {
            title: newTitle,
            description: newDesc,
            due_date: newDueDate || null,
            created_by: currentUser.id,
            user_ids: selectedUserIds
          };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        setShowCreateModal(false);
        setEditingTask(null);
        setNewTitle('');
        setNewDesc('');
        setNewDueDate('');
        setSelectedUserIds([]);
        fetchTasks();
      }
    } catch (err) {
      console.error("Failed to save task", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm("Are you sure you want to delete this task? It will be marked as deleted for everyone.")) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (res.ok) fetchTasks();
    } catch (err) {
      console.error("Failed to delete task", err);
    }
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setNewTitle(task.title);
    setNewDesc(task.description);
    setNewDueDate(task.due_date || '');
    setShowCreateModal(true);
  };

  const handleNudge = async (userId: string, taskTitle: string) => {
    try {
      await fetch('/api/tasks/nudge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, task_title: taskTitle })
      });
      showToast("Nudge sent successfully!");
    } catch (err) {
      console.error("Failed to nudge user", err);
      showToast("Failed to send nudge", "error");
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const selectAllStaff = () => {
    setSelectedUserIds(users.map(u => u.id));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-xs font-bold ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}
          >
            {toast.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Task Monitor</h3>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Assign & Track Progress</p>
          </div>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2"
        >
          <Plus size={16} />
          New Task
        </button>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-xs font-medium">Loading tasks...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-4 text-center px-8">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
              <CheckCircle2 size={32} strokeWidth={1} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-600">No tasks created yet</p>
              <p className="text-xs">Start by assigning tasks to your staff.</p>
            </div>
          </div>
        ) : (
          tasks.map(task => {
            const isExpanded = expandedTaskId === task.id;
            const progress = task.total_assigned > 0 
              ? Math.round((task.completed_count / task.total_assigned) * 100) 
              : 0;

            return (
              <div 
                key={task.id} 
                className={`border rounded-2xl overflow-hidden shadow-sm transition-all hover:shadow-md ${
                  task.is_deleted 
                    ? 'opacity-60 grayscale-[0.5] bg-slate-50 border-slate-200' 
                    : progress === 100 
                      ? 'bg-emerald-50/30 border-emerald-100' 
                      : 'bg-white border-slate-100'
                }`}
              >
                {/* Task Summary Row */}
                <div 
                  onClick={() => {
                    if (isExpanded) setExpandedTaskId(null);
                    else {
                      setExpandedTaskId(task.id);
                      fetchAssignments(task.id);
                    }
                  }}
                  className="p-5 cursor-pointer flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {progress === 100 ? (
                        <div className="w-5 h-5 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      ) : (
                        <div className="w-5 h-5 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center shrink-0">
                          <Clock size={12} strokeWidth={3} />
                        </div>
                      )}
                      <h4 className={`text-sm font-bold text-slate-800 truncate ${task.is_deleted ? 'line-through' : ''}`}>{task.title}</h4>
                      {task.due_date && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded">
                          <Clock size={10} />
                          {new Date(task.due_date).toLocaleDateString()}
                        </span>
                      )}
                      {task.is_edited === 1 && (
                        <span className="text-[9px] font-bold text-indigo-400 italic">(edited)</span>
                      )}
                      {task.is_deleted === 1 && (
                        <span className="text-[9px] font-bold text-rose-400 italic">(deleted)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          className={`h-full ${progress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded-md ${progress === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                          {progress}%
                        </span>
                        <span className="text-slate-300">|</span>
                        <span>{task.completed_count}/{task.total_assigned} Done</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!task.is_deleted && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); openEditModal(task); }}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        <FileText size={16} />
                      </button>
                    )}
                    {!task.is_deleted && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    )}
                    <div className="text-slate-400 ml-2">
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-slate-50 bg-slate-50/30 overflow-hidden"
                    >
                      <div className="p-5 space-y-6">
                        {task.description && (
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Description</p>
                            <p className="text-xs text-slate-600 leading-relaxed">{task.description}</p>
                          </div>
                        )}

                        {loadingAssignments[task.id] ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Completed List */}
                            <div>
                              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Check size={12} /> Completed By
                              </p>
                              <div className="space-y-2">
                                {assignments[task.id]?.filter(a => a.status === 'COMPLETED').length === 0 ? (
                                  <p className="text-[10px] text-slate-400 italic">No completions yet</p>
                                ) : (
                                  assignments[task.id]?.filter(a => a.status === 'COMPLETED').map(a => (
                                    <div key={a.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100">
                                      <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
                                          <Check size={12} />
                                        </div>
                                        <span className="text-xs font-bold text-slate-700">{a.user_name}</span>
                                      </div>
                                      <span className="text-[9px] text-slate-400">{new Date(a.completed_at!).toLocaleDateString()}</span>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>

                            {/* Pending List */}
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider flex items-center gap-2">
                                  <AlertCircle size={12} /> Pending
                                </p>
                                {assignments[task.id]?.filter(a => a.status === 'PENDING').length > 1 && (
                                  <button 
                                    onClick={async () => {
                                      const pending = assignments[task.id]?.filter(a => a.status === 'PENDING') || [];
                                      try {
                                        await Promise.all(pending.map(a => 
                                          fetch('/api/tasks/nudge', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ user_id: a.user_id, task_title: task.title })
                                          })
                                        ));
                                        showToast(`Nudged all ${pending.length} pending staff!`);
                                      } catch (err) {
                                        showToast("Failed to nudge some staff", "error");
                                      }
                                    }}
                                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-lg transition-colors"
                                  >
                                    <Bell size={10} /> Nudge All Pending
                                  </button>
                                )}
                              </div>
                              <div className="space-y-2">
                                {assignments[task.id]?.filter(a => a.status === 'PENDING').length === 0 ? (
                                  <p className="text-[10px] text-slate-400 italic">Everyone finished!</p>
                                ) : (
                                  assignments[task.id]?.filter(a => a.status === 'PENDING').map(a => (
                                    <div key={a.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100">
                                      <span className="text-xs font-bold text-slate-700">{a.user_name}</span>
                                      <button 
                                        onClick={() => handleNudge(a.user_id, task.title)}
                                        className="text-[9px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
                                      >
                                        <Bell size={10} /> Nudge
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>

      {/* Create Task Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800">{editingTask ? 'Edit Task' : 'Create New Task'}</h3>
                <button onClick={() => { setShowCreateModal(false); setEditingTask(null); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Task Title</label>
                    <input 
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="e.g., Update CPR Certification"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description</label>
                    <textarea 
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder="Provide details about the task..."
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Due Date (Optional)</label>
                    <input 
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

                {!editingTask && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Assign To Staff</label>
                      <button 
                        onClick={selectAllStaff}
                        className="text-[10px] font-bold text-indigo-600 hover:underline"
                      >
                        Select All Staff
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                      {users.map(user => (
                        <button
                          key={user.id}
                          onClick={() => toggleUserSelection(user.id)}
                          className={`p-3 rounded-xl text-xs font-bold transition-all border text-left flex items-center justify-between ${selectedUserIds.includes(user.id) ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50'}`}
                        >
                          <span className="truncate">{user.name}</span>
                          {selectedUserIds.includes(user.id) && <Check size={14} />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={() => { setShowCreateModal(false); setEditingTask(null); }}
                  className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateTask}
                  disabled={isSubmitting || !newTitle || (!editingTask && selectedUserIds.length === 0)}
                  className="flex-1 py-3 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check size={18} />}
                  {editingTask ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminTaskMonitor;
