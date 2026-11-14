import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../firebase/config';
import { collection, doc, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
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
  deleteNotification: (id: string) => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
  resetAllBellsForAllUsers: () => Promise<{ deletedCount: number }>;
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  permission: 'default',
  requestPermission: async () => false,
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  deleteNotification: async () => {},
  deleteAllNotifications: async () => {},
  resetAllBellsForAllUsers: async () => ({ deletedCount: 0 }),
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
  const [globalResetAtMs, setGlobalResetAtMs] = useState<number>(() =>
    DataService.getLocalGlobalNotificationResetAt()
  );
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  
  const isFirstLoad = useRef(true);

  // Request browser Notification permissions
  const requestPermission = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('المتصفح أو النظام لا يدعم إشعارات الويب.');
      return false;
    }

    // Check if running inside an embedded iframe (like AI Studio preview)
    const isIframe = window.self !== window.top;
    if (isIframe && Notification.permission !== 'granted') {
      toast.error('لا يمكن تفعيل الإشعارات داخل المعاينة المضمنة (iFrame). المرجو فتح التطبيق في نافذة/تبويب جديد مستقل لطلب الصلاحية.', {
        duration: 6000
      });
      return false;
    }

    // If permission was previously blocked/denied in browser settings
    if (Notification.permission === 'denied') {
      toast.error('تم حظر الإشعارات سابقاً في متصفحك. لفك الحظر: انقر على رمز القفل 🔒 بجانب رابط الموقع بأعلى المتصفح ثم اختر "تسمح بالدخول" للإشعارات.', {
        duration: 7000
      });
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
        toast.error('تم رفض صلاحية الإشعارات. لتفعيلها: انقر على رمز القفل 🔒 بجانب رابط الموقع في شريط العناوين ثم قم بتفعيل الإشعارات.', {
          duration: 6000
        });
        return false;
      }
    } catch (err) {
      console.error('Error requesting notification permission:', err);
      toast.error('تعذر طلب صلاحية الإشعارات من المتصفح.');
      return false;
    }
  };

  // 1. Subscribe to Firestore real-time notifications (respecting Cloud Sync Pause)
  useEffect(() => {
    if (!userProfile) {
      setAllRawNotifications([]);
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    let unsubscribeFirestore: (() => void) | null = null;
    let unsubscribeResetMeta: (() => void) | null = null;

    const handleGlobalResetEvent = (e: Event) => {
      const custom = e as CustomEvent<{ resetAtMs?: number }>;
      const ts = custom.detail?.resetAtMs || Date.now();
      setGlobalResetAtMs(ts);
      setAllRawNotifications([]);
      setNotifications([]);
      setUnreadCount(0);
    };
    window.addEventListener('notificationsGloballyReset', handleGlobalResetEvent);

    const setupSubscription = () => {
      if (unsubscribeFirestore) {
        try {
          unsubscribeFirestore();
        } catch {}
        unsubscribeFirestore = null;
      }
      if (unsubscribeResetMeta) {
        try {
          unsubscribeResetMeta();
        } catch {}
        unsubscribeResetMeta = null;
      }

      if (DataService.isCloudSyncPaused()) {
        DataService.getNotifications().then((localData) => {
          setAllRawNotifications(localData);
        });
        return;
      }

      unsubscribeResetMeta = onSnapshot(
        doc(db, 'settings', 'notifications_meta'),
        (metaSnap) => {
          if (DataService.isCloudSyncPaused() || !metaSnap.exists()) return;
          const data = metaSnap.data();
          let resetMs = 0;
          if (data?.globalResetAt) {
            if (typeof data.globalResetAt.toDate === 'function') {
              resetMs = data.globalResetAt.toDate().getTime();
            } else if (data.globalResetAt.seconds) {
              resetMs = data.globalResetAt.seconds * 1000;
            } else {
              const parsed = new Date(data.globalResetAt).getTime();
              if (Number.isFinite(parsed)) resetMs = parsed;
            }
          }
          if (resetMs > 0) {
            setGlobalResetAtMs(resetMs);
            try {
              localStorage.setItem('taourirt_notifications_global_reset_at', String(resetMs));
            } catch {}
          }
        },
        () => {}
      );

      const q = query(
        collection(db, 'notifications'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      unsubscribeFirestore = onSnapshot(
        q,
        (snapshot) => {
          if (DataService.isCloudSyncPaused()) return;
          if (snapshot.empty && snapshot.metadata?.fromCache) return;
          const fetched: AppNotification[] = [];
          snapshot.forEach((docItem) => {
            const data = docItem.data();
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
              id: docItem.id,
              title: data.title || '',
              body: data.body || '',
              sportId: data.sportId,
              role: data.role,
              userIds: data.userIds || [],
              createdAt: createdAtStr,
              readBy: data.readBy || [],
              deletedBy: data.deletedBy || [],
              isDirectMessage: Boolean(data.isDirectMessage),
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
    };

    setupSubscription();
    window.addEventListener('cloudSyncPausedChanged', setupSubscription);

    return () => {
      window.removeEventListener('cloudSyncPausedChanged', setupSubscription);
      window.removeEventListener('notificationsGloballyReset', handleGlobalResetEvent);
      if (unsubscribeFirestore) {
        try {
          unsubscribeFirestore();
        } catch {}
      }
      if (unsubscribeResetMeta) {
        try {
          unsubscribeResetMeta();
        } catch {}
      }
    };
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

    const localDeletedIds = DataService.getLocalDeletedNotificationIds(userId);

    // Filter logic based on user's role and assigned sports
    const filtered = allRawNotifications.filter((notif) => {
      // Global reset watermark set by Central Admin
      if (globalResetAtMs > 0) {
        const notifMs = new Date(notif.createdAt).getTime();
        if (Number.isFinite(notifMs) && notifMs <= globalResetAtMs) {
          return false;
        }
      }

      // Per-user deletion: hide strictly for the user who deleted it
      if (localDeletedIds.includes(notif.id) || notif.deletedBy?.includes(userId)) {
        return false;
      }

      // Direct private messages ONLY go to the intended recipient userIds
      if (notif.role === 'PRIVATE_MSG' || notif.isDirectMessage) {
        return Array.isArray(notif.userIds) && notif.userIds.includes(userId);
      }

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
  }, [allRawNotifications, userProfile, globalResetAtMs]);

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

  const deleteNotification = async (id: string) => {
    if (!userProfile) return;
    setNotifications((prev) => {
      const updated = prev.filter((n) => n.id !== id);
      const unread = updated.filter((n) => !n.readBy?.includes(userProfile.id)).length;
      setUnreadCount(unread);
      return updated;
    });
    setAllRawNotifications((prev) =>
      prev.map((n) =>
        n.id === id
          ? { ...n, deletedBy: [...(n.deletedBy || []), userProfile.id] }
          : n
      )
    );
    await DataService.deleteNotificationForUser(id, userProfile.id);
  };

  const deleteAllNotifications = async () => {
    if (!userProfile || notifications.length === 0) return;
    const idsToDelete = notifications.map((n) => n.id);
    setNotifications([]);
    setUnreadCount(0);
    setAllRawNotifications((prev) =>
      prev.map((n) =>
        idsToDelete.includes(n.id)
          ? { ...n, deletedBy: [...(n.deletedBy || []), userProfile.id] }
          : n
      )
    );
    await DataService.deleteAllNotificationsForUser(idsToDelete, userProfile.id);
  };

  const resetAllBellsForAllUsers = async (): Promise<{ deletedCount: number }> => {
    const res = await DataService.resetAllNotificationsForAllUsers(userProfile?.fullName);
    setGlobalResetAtMs(res.resetAtMs);
    setAllRawNotifications([]);
    setNotifications([]);
    setUnreadCount(0);
    return { deletedCount: res.deletedCount };
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
        deleteNotification,
        deleteAllNotifications,
        resetAllBellsForAllUsers,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
