// src/hooks/useNotifications.js
import { useState } from 'react';

const INITIAL_NOTIFICATIONS = [
  { id: '1', type: 'alert', message: 'Leaf blight detected in Tomato crop. Immediate action recommended.', time: '10 min ago', read: false },
  { id: '2', type: 'info', message: 'PM Kisan installment of ₹2000 received.', time: '2 hr ago', read: false },
  { id: '3', type: 'warning', message: 'Soil moisture below 30% in North Field. Irrigation needed.', time: '3 hr ago', read: false },
  { id: '4', type: 'success', message: 'Crop recommendation report generated successfully.', time: 'Yesterday', read: true },
  { id: '5', type: 'info', message: 'Heavy rainfall predicted in next 48 hours.', time: 'Yesterday', read: true },
];

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
