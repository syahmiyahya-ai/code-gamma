import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  Calendar, 
  Check, 
  Loader2, 
  AlertCircle,
  Inbox
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TaskAssignment {
  id: number;
  task_id: number;
  user_id: string;
  status: 'PENDING' | 'COMPLETED';
  completed_at: string | null;
  title: string;
  description: string;
  due_date: string | null;
  is_edited: number;
  is_deleted: number;
}

interface Props {
  currentUserId: string;
}

const StaffTaskList: React.FC<Props> = ({ currentUserId }) => {
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'todo' | 'completed'>('todo');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const fetchMyTasks = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/my-tasks?user_id=${currentUserId}`);
      const data = await res.json();
      setAssignments(data);
    } catch (err) {
      console.error("Failed to fetch tasks", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUserId) fetchMyTasks();
  }, [currentUserId]);

  const handleMarkAsDone = async (id: number) => {
    try {
      setUpdatingId(id);
      const res = await fetch(`/api/task-assignments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' })
      });
      if (res.ok) {
        // Optimistic update
        setAssignments(prev => prev.map(a => 
          a.id === id ? { ...a, status: 'COMPLETED', completed_at: new Date().toISOString() } : a
        ));
      }
    } catch (err) {
      console.error("Failed to update task", err);
    } finally {
      setUpdatingId(null);
    }
  };

  // KL Time Logic
  const todayStr = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kuala_Lumpur',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  }, []);

  const filteredTasks = useMemo(() => {
    return assignments.filter(a => 
      activeTab === 'todo' ? a.status === 'PENDING' : a.status === 'COMPLETED'
    );
  }, [assignments, activeTab]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">My Tasks</h3>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Your Personal Checklist</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-slate-50 border-b border-slate-100">
        <button 
          onClick={() => setActiveTab('todo')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'todo' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          To Do ({assignments.filter(a => a.status === 'PENDING').length})
        </button>
        <button 
          onClick={() => setActiveTab('completed')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'completed' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Completed ({assignments.filter(a => a.status === 'COMPLETED').length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            <p className="text-xs font-medium">Loading your tasks...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-4 text-center px-8">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
              <Inbox size={32} strokeWidth={1} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-600">
                {activeTab === 'todo' ? 'All caught up!' : 'No completed tasks'}
              </p>
              <p className="text-xs">
                {activeTab === 'todo' ? 'Enjoy your free time.' : 'Complete tasks to see them here.'}
              </p>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredTasks.map(task => {
              const isOverdue = task.due_date && task.due_date < todayStr && task.status === 'PENDING';
              
              return (
                <motion.div 
                  layout
                  key={task.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`p-4 rounded-2xl border transition-all ${activeTab === 'todo' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-70'} ${task.is_deleted ? 'grayscale opacity-60' : ''}`}
                >
                  <div className="flex gap-4">
                    {activeTab === 'todo' ? (
                      <button 
                        onClick={() => !task.is_deleted && handleMarkAsDone(task.id)}
                        disabled={updatingId === task.id || task.is_deleted === 1}
                        className={`w-11 h-11 rounded-xl border-2 flex items-center justify-center transition-all shrink-0 ${updatingId === task.id ? 'bg-slate-50 border-slate-200' : task.is_deleted ? 'border-slate-100 text-slate-300 cursor-not-allowed' : 'border-emerald-100 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 shadow-sm active:scale-95'}`}
                      >
                        {updatingId === task.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check size={22} />}
                      </button>
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                        <CheckCircle2 size={22} />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className={`text-sm font-bold ${activeTab === 'completed' || task.is_deleted ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                          {task.title}
                        </h4>
                        {task.is_edited === 1 && (
                          <span className="text-[9px] font-bold text-indigo-400 italic">(edited)</span>
                        )}
                        {task.is_deleted === 1 && (
                          <span className="text-[9px] font-bold text-rose-400 italic">(deleted)</span>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-xs text-slate-500 leading-relaxed mb-3 line-clamp-2">
                          {task.description}
                        </p>
                      )}
                      
                      <div className="flex items-center justify-between">
                        {task.due_date && (
                          <div className={`flex items-center gap-1.5 text-[10px] font-bold ${isOverdue ? 'text-rose-600' : 'text-slate-400'}`}>
                            {isOverdue ? <AlertCircle size={12} /> : <Calendar size={12} />}
                            {isOverdue ? 'OVERDUE: ' : 'Due: '}
                            {new Date(task.due_date).toLocaleDateString()}
                          </div>
                        )}
                        {activeTab === 'completed' && task.completed_at && (
                          <span className="text-[9px] font-medium text-slate-400">
                            Done on {new Date(task.completed_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default StaffTaskList;
