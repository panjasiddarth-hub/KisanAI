// src/hooks/useNotifications.js
import { useState } from 'react';

// Notification delivery is not connected yet; do not seed the UI with demo alerts.
const INITIAL_NOTIFICATIONS = [];

export function useNotifications() {
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const dismiss = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return { notifications, unreadCount, markRead, markAllRead, dismiss };
}
