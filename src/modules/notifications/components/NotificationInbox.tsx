import React, { useState, useEffect } from 'react';
import { 
  X, 
  Bell, 
  Calendar, 
  Info, 
  MessageSquare, 
  Check, 
  AlertCircle,
  Loader2,
  Trash2,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchWithRetry } from '../../../shared/utils/api';

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'SYSTEM' | 'LEAVE_UPDATE' | 'SWAP_REQUEST' | 'DIRECT_MESSAGE';
  related_entity_id: string | null;
  is_read: number;
  created_at: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  onRefresh: () => void;
}

const NotificationInbox: React.FC<Props> = ({ isOpen, onClose, currentUserId, onRefresh }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetchWithRetry(`/api/notifications?user_id=${currentUserId}`, {
        retries: 3
      });
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const data = await res.json();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch notifications", err);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && currentUserId) {
      fetchNotifications();
    }
  }, [isOpen, currentUserId]);

  const markAllAsRead = async () => {
    try {
      await fetchWithRetry('/api/notifications/read-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUserId }),
        retries: 2
      });
      fetchNotifications();
      onRefresh();
    } catch (err) {
      console.error("Failed to mark all as read", err);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await fetchWithRetry(`/api/notifications/${id}/read`, { 
        method: 'POST',
        retries: 2
      });
      fetchNotifications();
      onRefresh();
    } catch (err) {
      console.error("Failed to mark as read", err);
    }
  };

  const handleAction = async (id: string, action: 'ACCEPT' | 'DECLINE') => {
    try {
      await fetchWithRetry('/api/notifications/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_id: id, action }),
        retries: 2
      });
      fetchNotifications();
      onRefresh();
    } catch (err) {
      console.error("Failed to process action", err);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'SWAP_REQUEST': return <Calendar className="text-blue-500" size={18} />;
      case 'LEAVE_UPDATE': return <CheckCircle2 className="text-emerald-500" size={18} />;
      case 'DIRECT_MESSAGE': return <MessageSquare className="text-indigo-500" size={18} />;
      case 'SYSTEM': return <Info className="text-slate-500" size={18} />;
      default: return <Bell className="text-slate-400" size={18} />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]"
          />

          {/* Slide-out Panel */}
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-[70] flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                  <Bell size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Notifications</h3>
                  <p className="text-xs text-slate-500 font-medium">Stay updated with your schedule</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            {/* Actions Bar */}
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {notifications.filter(n => n.is_read === 0).length} Unread
              </span>
              <button 
                onClick={markAllAsRead}
                disabled={notifications.every(n => n.is_read === 1)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Check size={14} />
                Mark all as read
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  <p className="text-xs font-medium">Loading inbox...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4 text-center px-8">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                    <Bell size={32} strokeWidth={1} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-600">All caught up!</p>
                    <p className="text-xs">No notifications to show right now.</p>
                  </div>
                </div>
              ) : (
                notifications.map((notification) => (
                  <motion.div 
                    layout
                    key={notification.id}
                    className={`p-4 rounded-2xl border transition-all group relative ${
                      notification.is_read === 0 
                        ? 'bg-blue-50 border-blue-100 shadow-sm' 
                        : 'bg-white border-slate-100 opacity-80'
                    }`}
                  >
                    <div className="flex gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        notification.is_read === 0 ? 'bg-white shadow-sm' : 'bg-slate-50'
                      }`}>
                        {getIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className={`text-sm font-bold truncate ${
                            notification.is_read === 0 ? 'text-slate-800' : 'text-slate-600'
                          }`}>
                            {notification.title}
                          </h4>
                          <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap">
                            {new Date(notification.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className={`text-xs leading-relaxed mb-3 ${
                          notification.is_read === 0 ? 'text-slate-600' : 'text-slate-500'
                        }`}>
                          {notification.message}
                        </p>

                        {/* Special Actions for Swap Requests */}
                        {notification.type === 'SWAP_REQUEST' && notification.is_read === 0 && (
                          <div className="flex gap-2 mt-2">
                            <button 
                              onClick={() => handleAction(notification.id, 'ACCEPT')}
                              className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100"
                            >
                              Accept
                            </button>
                            <button 
                              onClick={() => handleAction(notification.id, 'DECLINE')}
                              className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors"
                            >
                              Decline
                            </button>
                          </div>
                        )}

                        {/* Mark as Read Button for unread notifications */}
                        {notification.is_read === 0 && notification.type !== 'SWAP_REQUEST' && (
                          <button 
                            onClick={() => markAsRead(notification.id)}
                            className="text-[10px] font-bold text-indigo-600 hover:underline"
                          >
                            Mark as read
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default NotificationInbox;
