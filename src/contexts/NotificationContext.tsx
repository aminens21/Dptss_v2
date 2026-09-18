import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../firebase/config';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { AppNotification } from '../types';
import { DataService } from '../lib/dataService';
import toast from 'react-hot-toast';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  permission: NotificationPermission;
  requestPermission: () => Promise<boolean>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  permission: 'default',
  requestPermission: async () => false,
  markAsRead: async () => {},
  markAllAsRead: async () => {},
});

export const useNotifications = () => useContext(NotificationContext);

// Generates a pleasant synthetic chime
const playNotificationSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);  // A5
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (err) {
    console.warn("Audio chime play warning:", err);
  }
};

// Dispatches a system/mobile push notification via ServiceWorker or standard Notification API
const showSystemNotification = async (title: string, body: string, sportId?: string) => {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const options: NotificationOptions & Record<string, any> = {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: `taourirt-sports-${Date.now()}`,
    renotify: true,
    data: {
      url: '/matches',
      sportId: sportId || 'all',
      date: new Date().toISOString()
    }
  };

  try {
    // 1. Prefer Service Worker registration showNotification (Required for Mobile Android/PWA)
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, options);
        return;
      }
    }
    // 2. Fallback to standard window Notification
    new Notification(title, options);
  } catch (err) {
    console.warn("System notification display fallback:", err);
    try {
      new Notification(title, options);
    } catch {}
  }
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile } = useAuth();
  const [allRawNotifications, setAllRawNotifications] = useState<AppNotification[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  
  const isFirstLoad = useRef(true);

  // Request browser Notification permissions
  const requestPermission = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('المتصفح لا يدعم إشعارات النظام.');
      return false;
    }

    try {
      const res = await Notification.requestPermission();
      setPermission(res);
      if (res === 'granted') {
        toast.success('تم تفعيل إشعارات الهاتف والويب بنجاح! 🔔');
        playNotificationSound();
        await showSystemNotification(
          'الرياضة المدرسية – مديرية تاوريرت 🏆',
          'تم تفعيل إشعارات الهاتف بنجاح! ستتلقى تنبيهات المباريات والنتائج فوراً هنا.'
        );
        return true;
      } else {
        toast.error('تم رفض صلاحية الإشعارات.');
        return false;
      }
    } catch (err) {
      console.error('Error requesting notification permission:', err);
      return false;
    }
  };

  // 1. Subscribe to Firestore real-time notifications
  useEffect(() => {
    if (!userProfile) {
      setAllRawNotifications([]);
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    // Set up Firestore snapshot listener
    const q = query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched: AppNotification[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          let createdAtStr = new Date().toISOString();
          if (data.createdAt) {
            if (typeof data.createdAt.toDate === 'function') {
              createdAtStr = data.createdAt.toDate().toISOString();
            } else if (data.createdAt.seconds) {
              createdAtStr = new Date(data.createdAt.seconds * 1000).toISOString();
            } else {
              createdAtStr = new Date(data.createdAt).toISOString();
            }
          }
          fetched.push({
            id: doc.id,
            title: data.title || '',
            body: data.body || '',
            sportId: data.sportId,
            role: data.role,
            userIds: data.userIds || [],
            createdAt: createdAtStr,
            readBy: data.readBy || [],
          });
        });

        setAllRawNotifications(fetched);
      },
      (error) => {
        console.warn('Real-time notifications Firestore error, loading fallback local storage:', error);
        DataService.getNotifications().then((localData) => {
          setAllRawNotifications(localData);
        });
      }
    );

    return () => unsubscribe();
  }, [userProfile]);

  // 2. Filter notifications based on logged-in user profile & specialty
  useEffect(() => {
    if (!userProfile) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const userId = userProfile.id;
    const userRole = userProfile.role;
    const specialties = userProfile.refereeSpecialty || [];
    const techSports = userProfile.techCommitteeSports || [];
    const techSportsMemberOf = userProfile.techCommitteeSportsMemberOf || [];

    // Filter logic based on user's role and assigned sports
    const filtered = allRawNotifications.filter((notif) => {
      // Central Admins see all announcements and sports notifications
      if (userRole === 'CENTRAL_ADMIN') return true;

      // Specifically targeted notifications to this user
      if (Array.isArray(notif.userIds) && notif.userIds.includes(userId)) return true;

      // Filter by Role
      if (notif.role && notif.role !== 'ALL' && notif.role !== userRole) {
        if (notif.role === 'REFEREE' && userRole === 'TEACHER' && specialties.length > 0) {
          // allow teacher-referees
        } else {
          return false;
        }
      }

      // Filter by Sport Specialty (التخصص الرياضي)
      if (notif.sportId && notif.sportId !== 'ALL') {
        // Referee: check if sport is in referee specialties
        if (userRole === 'REFEREE') {
          return specialties.includes(notif.sportId);
        }

        // Sport Manager: check if sport matches
        if (userRole === 'SPORT_MANAGER') {
          return userProfile.sportId === notif.sportId;
        }

        // Teacher / Tech Committee
        if (userRole === 'TEACHER') {
          if (userProfile.isTechCommitteeHead) {
            // Head only receives updates for their assigned sports or general
            return techSports.includes(notif.sportId) || (userProfile.sportId === notif.sportId);
          }
          if (userProfile.isTechCommitteeMember) {
            return techSportsMemberOf.includes(notif.sportId);
          }
          // Regular teacher: can view notifications
          return true;
        }
      }

      return true;
    });

    // Check if a brand-new notification arrived for browser/mobile push
    if (!isFirstLoad.current && filtered.length > 0) {
      const prevIds = notifications.map((n) => n.id);
      const newlyArrived = filtered.filter((n) => !prevIds.includes(n.id));

      if (newlyArrived.length > 0) {
        const absoluteNewest = newlyArrived[0];
        const timeDiffMs = Date.now() - new Date(absoluteNewest.createdAt).getTime();

        if (timeDiffMs < 45000) {
          playNotificationSound();
          toast(absoluteNewest.title, {
            icon: '🔔',
            duration: 6000,
          });

          showSystemNotification(absoluteNewest.title, absoluteNewest.body, absoluteNewest.sportId);
        }
      }
    }

    setNotifications(filtered);
    
    // Count unread
    const unread = filtered.filter((n) => !n.readBy?.includes(userId)).length;
    setUnreadCount(unread);

    if (isFirstLoad.current) {
      isFirstLoad.current = false;
    }
  }, [allRawNotifications, userProfile]);

  const markAsRead = async (id: string) => {
    if (!userProfile) return;
    
    // Update local notifications state and recalculate unreadCount immediately
    setNotifications((prev) => {
      const updated = prev.map((n) => {
        if (n.id === id) {
          const currentReadBy = n.readBy || [];
          if (!currentReadBy.includes(userProfile.id)) {
            return { ...n, readBy: [...currentReadBy, userProfile.id] };
          }
        }
        return n;
      });
      const unread = updated.filter((n) => !n.readBy?.includes(userProfile.id)).length;
      setUnreadCount(unread);
      return updated;
    });

    // Sync allRawNotifications so background effect doesn't revert unread state
    setAllRawNotifications((prev) =>
      prev.map((n) => {
        if (n.id === id) {
          const currentReadBy = n.readBy || [];
          if (!currentReadBy.includes(userProfile.id)) {
            return { ...n, readBy: [...currentReadBy, userProfile.id] };
          }
        }
        return n;
      })
    );

    await DataService.markNotificationAsRead(id, userProfile.id);
  };

  const markAllAsRead = async () => {
    if (!userProfile) return;
    const unreadNotifs = notifications.filter((n) => !n.readBy?.includes(userProfile.id));

    // Immediately clear unreadCount so badge on bell disappears instantly
    setUnreadCount(0);

    setNotifications((prev) =>
      prev.map((n) => {
        const currentReadBy = n.readBy || [];
        if (!currentReadBy.includes(userProfile.id)) {
          return { ...n, readBy: [...currentReadBy, userProfile.id] };
        }
        return n;
      })
    );

    setAllRawNotifications((prev) =>
      prev.map((n) => {
        const currentReadBy = n.readBy || [];
        if (!currentReadBy.includes(userProfile.id)) {
          return { ...n, readBy: [...currentReadBy, userProfile.id] };
        }
        return n;
      })
    );

    await Promise.all(unreadNotifs.map((n) => DataService.markNotificationAsRead(n.id, userProfile.id)));
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        permission,
        requestPermission,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
