import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import NotificationInbox from './NotificationInbox';
import { fetchWithRetry } from '../../../shared/utils/api';

interface Notification {
  id: string;
  is_read: number;
}

interface Props {
  currentUserId: string;
}

const NotificationBell: React.FC<Props> = ({ currentUserId }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isInboxOpen, setIsInboxOpen] = useState(false);

  const fetchUnreadCount = async () => {
    try {
      const res = await fetchWithRetry(`/api/notifications?user_id=${currentUserId}`, {
        retries: 3
      });
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        const unread = data.filter(n => n.is_read === 0).length;
        setUnreadCount(unread);
      }
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  };

  useEffect(() => {
    if (currentUserId) {
      fetchUnreadCount();
      // Poll for new notifications every 30 seconds
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [currentUserId]);

  return (
    <div className="relative">
      <button 
        onClick={() => setIsInboxOpen(true)}
        className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-all relative group active:scale-95"
      >
        <Bell size={20} className="group-hover:rotate-12 transition-transform" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <NotificationInbox 
        isOpen={isInboxOpen} 
        onClose={() => setIsInboxOpen(false)} 
        currentUserId={currentUserId}
        onRefresh={fetchUnreadCount}
      />
    </div>
  );
};

export default NotificationBell;
