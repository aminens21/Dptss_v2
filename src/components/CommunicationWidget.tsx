import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  MessageSquare,
  Inbox,
  Send,
  PenSquare,
  X,
  Search,
  Trash2,
  Reply,
  CheckCheck,
  UserCheck,
  Shield,
  Award,
  GraduationCap,
  Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { DataService } from '../lib/dataService';
import { InternalMessage, CommunicationRecipientCategory } from '../types';

type TabKey = 'inbox' | 'sent' | 'compose';

interface RecipientOption {
  id: string;
  name: string;
  category: CommunicationRecipientCategory;
  roleLabel: string;
  subtitle: string;
  email?: string;
  phone?: string;
}

const CATEGORY_CONFIG: Array<{
  key: CommunicationRecipientCategory;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeClass: string;
}> = [
  {
    key: 'CENTRAL_ADMIN',
    label: 'المسير المركزي',
    shortLabel: 'المسير المركزي',
    icon: Shield,
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800'
  },
  {
    key: 'TECH_COMMITTEE_HEAD',
    label: 'رئيس اللجنة التقنية',
    shortLabel: 'رئيس اللجنة التقنية',
    icon: Award,
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-200 dark:border-blue-800'
  },
  {
    key: 'TEACHER',
    label: 'أستاذ آخر',
    shortLabel: 'أستاذ',
    icon: GraduationCap,
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-800'
  },
  {
    key: 'REFEREE',
    label: 'حكم',
    shortLabel: 'حكم',
    icon: UserCheck,
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/50 dark:text-purple-200 dark:border-purple-800'
  }
];

export const CommunicationWidget: React.FC = () => {
  const { userProfile, currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('inbox');
  const [allMessages, setAllMessages] = useState<InternalMessage[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  // Recipients list
  const [recipients, setRecipients] = useState<RecipientOption[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  // Compose state
  const [recipientCategory, setRecipientCategory] = useState<CommunicationRecipientCategory>('CENTRAL_ADMIN');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<RecipientOption[]>([]);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);

  const myId = userProfile?.id || currentUser?.uid || '';
  const myName = userProfile?.fullName || currentUser?.displayName || 'مستخدم';
  const myEmail = userProfile?.email || currentUser?.email || '';

  const getMyRoleLabel = () => {
    if (!userProfile) return 'مستخدم';
    if (userProfile.isTechCommitteeHead) return 'رئيس اللجنة التقنية';
    switch (userProfile.role) {
      case 'CENTRAL_ADMIN':
      case 'SUPER_ADMIN':
        return userProfile.isSuperAdmin ? 'المسؤول المركزي' : 'المسير المركزي / الإقليمي';
      case 'SPORT_MANAGER':
        return 'منسق / مسير رياضي';
      case 'REFEREE':
        return 'حكم معتمد';
      default:
        return 'أستاذ(ة) التربية البدنية';
    }
  };

  // Subscribe to real-time internal messages
  useEffect(() => {
    if (!myId) return;
    const unsub = DataService.subscribeToInternalMessages((msgs) => {
      setAllMessages(msgs);
    });
    return () => unsub();
  }, [myId]);

  // Load recipients whenever modal opens
  useEffect(() => {
    if (!isOpen || !myId) return;
    let cancelled = false;
    setLoadingRecipients(true);
    DataService.getCommunicationRecipients()
      .then((list) => {
        if (!cancelled) {
          setRecipients(list);
        }
      })
      .catch((err) => {
        console.warn('Error loading communication recipients:', err);
      })
      .finally(() => {
        if (!cancelled) setLoadingRecipients(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, myId]);

  const inboxMessages = useMemo(() => {
    if (!myId) return [];
    return allMessages.filter(
      (m) =>
        m.recipientId === myId &&
        !(m.deletedBy || []).includes(myId)
    );
  }, [allMessages, myId]);

  const sentMessages = useMemo(() => {
    if (!myId) return [];
    return allMessages.filter(
      (m) =>
        m.senderId === myId &&
        !(m.deletedBy || []).includes(myId)
    );
  }, [allMessages, myId]);

  const unreadInboxCount = useMemo(() => {
    if (!myId) return 0;
    return inboxMessages.filter((m) => !(m.readBy || []).includes(myId)).length;
  }, [inboxMessages, myId]);

  const activeList = activeTab === 'inbox' ? inboxMessages : sentMessages;
  const selectedMessage = useMemo(
    () => activeList.find((m) => m.id === selectedMessageId) || activeList[0] || null,
    [activeList, selectedMessageId]
  );

  // Mark selected inbox message as read automatically
  useEffect(() => {
    if (!isOpen || activeTab !== 'inbox' || !selectedMessage || !myId) return;
    if (!(selectedMessage.readBy || []).includes(myId)) {
      DataService.markInternalMessageAsRead(selectedMessage.id, myId).catch(() => {});
    }
  }, [isOpen, activeTab, selectedMessage, myId]);

  const filteredRecipients = useMemo(() => {
    const q = recipientSearch.trim().toLowerCase();
    return recipients.filter((r) => {
      if (r.category !== recipientCategory) return false;
      if (r.id === myId) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.subtitle.toLowerCase().includes(q) ||
        r.roleLabel.toLowerCase().includes(q)
      );
    });
  }, [recipients, recipientCategory, recipientSearch, myId]);

  const selectedIdsSet = useMemo(
    () => new Set(selectedRecipients.map((r) => r.id)),
    [selectedRecipients]
  );

  const selectedCountByCategory = useMemo(() => {
    const counts: Record<CommunicationRecipientCategory, number> = {
      CENTRAL_ADMIN: 0,
      TECH_COMMITTEE_HEAD: 0,
      TEACHER: 0,
      REFEREE: 0
    };
    selectedRecipients.forEach((r) => {
      counts[r.category] = (counts[r.category] || 0) + 1;
    });
    return counts;
  }, [selectedRecipients]);

  const allFilteredSelected = useMemo(
    () =>
      filteredRecipients.length > 0 &&
      filteredRecipients.every((r) => selectedIdsSet.has(r.id)),
    [filteredRecipients, selectedIdsSet]
  );

  const toggleRecipient = (recipient: RecipientOption) => {
    setSelectedRecipients((prev) => {
      const exists = prev.some((item) => item.id === recipient.id);
      if (exists) {
        return prev.filter((item) => item.id !== recipient.id);
      }
      return [...prev, recipient];
    });
  };

  const removeSelectedRecipient = (id: string) => {
    setSelectedRecipients((prev) => prev.filter((item) => item.id !== id));
  };

  const handleToggleAllFiltered = () => {
    if (filteredRecipients.length === 0) return;
    if (allFilteredSelected) {
      const filteredIds = new Set(filteredRecipients.map((r) => r.id));
      setSelectedRecipients((prev) => prev.filter((item) => !filteredIds.has(item.id)));
    } else {
      setSelectedRecipients((prev) => {
        const existingIds = new Set(prev.map((item) => item.id));
        const additions = filteredRecipients.filter((r) => !existingIds.has(r.id));
        return [...prev, ...additions];
      });
    }
  };

  const formatDateTime = (iso?: string) => {
    if (!iso) return 'الآن';
    try {
      const d = new Date(iso);
      return d.toLocaleString('ar-MA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return iso;
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myId) return;

    if (selectedRecipients.length === 0) {
      toast.error('يرجى تحديد اسم واحد على الأقل من قائمة المرسل إليهم');
      return;
    }
    if (!subject.trim()) {
      toast.error('يرجى كتابة موضوع الرسالة');
      return;
    }
    if (!content.trim()) {
      toast.error('يرجى كتابة نص الرسالة');
      return;
    }

    // Deduplicate recipients by user id just in case
    const uniqueRecipients: RecipientOption[] = Array.from(
      new Map<string, RecipientOption>(selectedRecipients.map((r) => [r.id, r])).values()
    );

    setIsSending(true);
    try {
      for (const rec of uniqueRecipients) {
        await DataService.sendInternalMessage({
          senderId: myId,
          senderName: myName,
          senderRoleLabel: getMyRoleLabel(),
          senderEmail: myEmail,
          recipientId: rec.id,
          recipientName: rec.name,
          recipientCategory: rec.category,
          recipientRoleLabel: rec.roleLabel,
          subject: subject.trim(),
          content: content.trim(),
          readBy: [myId],
          deletedBy: []
        });
      }

      if (uniqueRecipients.length === 1) {
        toast.success(`تم إرسال رسالتك إلى ${uniqueRecipients[0].name} بنجاح`);
      } else {
        toast.success(`تم إرسال رسالتك إلى ${uniqueRecipients.length} مستلمين بنجاح`);
      }
      setSubject('');
      setContent('');
      setSelectedRecipients([]);
      setRecipientSearch('');
      setActiveTab('sent');
      setSelectedMessageId(null);
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('تعذر إرسال الرسالة، يرجى المحاولة مجدداً');
    } finally {
      setIsSending(false);
    }
  };

  const handleReply = (msg: InternalMessage) => {
    // Try to match sender in recipients so category & recipient get pre-selected cleanly
    const matched = recipients.find((r) => r.id === msg.senderId);
    if (matched) {
      setRecipientCategory(matched.category);
      setSelectedRecipients([matched]);
    } else {
      // Fallback guess based on senderRoleLabel
      const label = msg.senderRoleLabel || '';
      let guessedCategory: CommunicationRecipientCategory = 'TEACHER';
      if (label.includes('مركزي') || label.includes('إقليمي')) {
        guessedCategory = 'CENTRAL_ADMIN';
      } else if (label.includes('تقنية')) {
        guessedCategory = 'TECH_COMMITTEE_HEAD';
      } else if (label.includes('حكم')) {
        guessedCategory = 'REFEREE';
      }
      setRecipientCategory(guessedCategory);
      setSelectedRecipients([
        {
          id: msg.senderId,
          name: msg.senderName,
          category: guessedCategory,
          roleLabel: msg.senderRoleLabel || 'مستقبل',
          subtitle: msg.senderEmail || msg.senderRoleLabel || ''
        }
      ]);
    }
    setSubject(msg.subject.startsWith('رد:') ? msg.subject : `رد: ${msg.subject}`);
    setContent('');
    setActiveTab('compose');
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!myId) return;
    await DataService.deleteInternalMessageForUser(msgId, myId);
    if (selectedMessageId === msgId) {
      setSelectedMessageId(null);
    }
    toast.success('تم حذف الرسالة من بريدك بنجاح');
  };

  if (!userProfile || !myId) return null;

  const modalContent = isOpen ? (
    <div
      className="fixed inset-0 z-[135] flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      dir="rtl"
      onClick={() => setIsOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 bg-linear-to-r from-indigo-900 via-slate-900 to-emerald-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-white truncate">
                منصة التواصل الداخلي والبريد المهني
              </h3>
              <p className="text-[11px] text-slate-300 truncate">
                التراسل المباشر مع المسير المركزي، رؤساء اللجن التقنية، الأساتذة والحكام
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="إغلاق نافذة التواصل"
            className="min-w-[40px] min-h-[40px] p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer flex items-center justify-center shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('inbox');
              setSelectedMessageId(null);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer min-h-[40px] ${
              activeTab === 'inbox'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Inbox className="w-4 h-4 shrink-0" />
            <span>البريد الوارد</span>
            <span
              className={`px-2 py-0.5 rounded-lg text-[10px] tabular-nums font-black ${
                activeTab === 'inbox'
                  ? 'bg-white/20 text-white'
                  : unreadInboxCount > 0
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {inboxMessages.length}
              {unreadInboxCount > 0 ? ` (${unreadInboxCount} جديد)` : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('sent');
              setSelectedMessageId(null);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer min-h-[40px] ${
              activeTab === 'sent'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Send className="w-4 h-4 shrink-0" />
            <span>البريد المرسل</span>
            <span
              className={`px-2 py-0.5 rounded-lg text-[10px] tabular-nums font-black ${
                activeTab === 'sent'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {sentMessages.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('compose')}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer min-h-[40px] mr-auto ${
              activeTab === 'compose'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-200 dark:border-emerald-800'
            }`}
          >
            <PenSquare className="w-4 h-4 shrink-0" />
            <span>رسالة جديدة</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {activeTab === 'compose' ? (
            <form onSubmit={handleSendMessage} className="p-4 sm:p-6 space-y-5">
              {/* Step 1: Recipient Category */}
              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200">
                  1. اختر صفة الجهة المرسل إليها <span className="text-slate-400 font-bold">(يمكنك التنقل بين الفئات لاختيار أكثر من مستلم)</span> <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {CATEGORY_CONFIG.map((cat) => {
                    const IconComp = cat.icon;
                    const isSelected = recipientCategory === cat.key;
                    const countInCat = recipients.filter((r) => r.category === cat.key && r.id !== myId).length;
                    const pickedInCat = selectedCountByCategory[cat.key] || 0;
                    return (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => setRecipientCategory(cat.key)}
                        className={`p-3 rounded-2xl border text-right transition-all cursor-pointer flex flex-col gap-1.5 min-h-[72px] ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <IconComp className={`w-4 h-4 shrink-0 ${isSelected ? 'text-emerald-300' : 'text-indigo-600 dark:text-indigo-400'}`} />
                          <div className="flex items-center gap-1">
                            {pickedInCat > 0 && (
                              <span
                                className={`text-[10px] font-black px-1.5 py-0.5 rounded-md tabular-nums ${
                                  isSelected
                                    ? 'bg-emerald-400 text-slate-950'
                                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                }`}
                              >
                                ✓ {pickedInCat}
                              </span>
                            )}
                            <span
                              className={`text-[10px] font-black px-1.5 py-0.5 rounded-md tabular-nums ${
                                isSelected ? 'bg-white/20 text-white' : 'bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {countInCat}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-black leading-snug">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Select One or Multiple Recipients */}
              <div className="space-y-2.5 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-black text-slate-800 dark:text-slate-200">
                    2. تحديد المرسل إليهم ({CATEGORY_CONFIG.find((c) => c.key === recipientCategory)?.label}) <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {filteredRecipients.length > 0 && (
                      <button
                        type="button"
                        onClick={handleToggleAllFiltered}
                        className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 dark:text-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
                      >
                        {allFilteredSelected
                          ? 'إلغاء تحديد هذه الفئة'
                          : `تحديد الكل (${filteredRecipients.length})`}
                      </button>
                    )}
                    {selectedRecipients.length > 0 && (
                      <>
                        <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-lg tabular-nums">
                          ✓ المحددون: {selectedRecipients.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedRecipients([])}
                          className="text-[11px] font-black px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800 transition-colors cursor-pointer"
                        >
                          مسح الكل
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Selected Recipients Summary Chips */}
                {selectedRecipients.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-900/60 max-h-28 overflow-y-auto">
                    {selectedRecipients.map((sel) => {
                      const catShort =
                        CATEGORY_CONFIG.find((c) => c.key === sel.category)?.shortLabel || sel.roleLabel;
                      return (
                        <span
                          key={sel.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100 text-[11px] font-bold"
                        >
                          <span className="truncate max-w-[160px]">{sel.name}</span>
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-600/15 text-emerald-800 dark:text-emerald-300">
                            {catShort}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeSelectedRecipient(sel.id)}
                            aria-label={`إزالة ${sel.name}`}
                            className="p-0.5 rounded hover:bg-emerald-200/70 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Search Input */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                    placeholder="ابحث بالاسم أو المؤسسة أو التخصص..."
                    className="w-full pr-9 pl-3 py-2.5 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Recipients List */}
                {loadingRecipients ? (
                  <div className="py-6 text-center text-xs font-bold text-slate-400">
                    جاري تحميل قائمة الأسماء...
                  </div>
                ) : filteredRecipients.length === 0 ? (
                  <div className="py-6 text-center text-xs font-bold text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    لا توجد أسماء مطابقة في هذه الفئة حالياً
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-0.5">
                    {filteredRecipients.map((r) => {
                      const isPicked = selectedIdsSet.has(r.id);
                      return (
                        <button
                          key={`${r.category}-${r.id}`}
                          type="button"
                          onClick={() => toggleRecipient(r)}
                          className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer flex items-center justify-between gap-2 ${
                            isPicked
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-950 dark:text-emerald-100 shadow-2xs'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-black truncate">{r.name}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold truncate mt-0.5">
                              {r.subtitle}
                            </p>
                          </div>
                          <span
                            className={`w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center shrink-0 border transition-colors ${
                              isPicked
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-transparent'
                            }`}
                          >
                            ✓
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Step 3: Subject & Content */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                    3. موضوع الرسالة <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="مثال: استفسار حول برمجة مقابلة / طلب تعديل لائحة..."
                    className="w-full px-3.5 py-2.5 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                    4. نص الرسالة <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="اكتب مضمون رسالتك بوضوح هنا..."
                    className="w-full px-3.5 py-2.5 text-xs font-medium leading-relaxed bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('inbox')}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 cursor-pointer"
                >
                  رجوع للوارد
                </button>
                <button
                  type="submit"
                  disabled={isSending || selectedRecipients.length === 0}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {isSending
                      ? 'جاري الإرسال...'
                      : selectedRecipients.length > 1
                      ? `إرسال الرسالة (${selectedRecipients.length} مستلمين)`
                      : 'إرسال الرسالة الآن'}
                  </span>
                </button>
              </div>
            </form>
          ) : (
            /* Inbox & Sent Split View */
            <div className="grid grid-cols-1 md:grid-cols-12 min-h-[380px] max-h-[65vh]">
              {/* List Column */}
              <div className="md:col-span-5 border-b md:border-b-0 md:border-l border-slate-200 dark:border-slate-800 overflow-y-auto p-3 space-y-2 bg-slate-50/50 dark:bg-slate-950/30">
                {activeList.length === 0 ? (
                  <div className="py-12 px-4 text-center text-slate-400 space-y-2.5">
                    {activeTab === 'inbox' ? (
                      <Inbox className="w-9 h-9 mx-auto text-slate-300 dark:text-slate-600" />
                    ) : (
                      <Send className="w-9 h-9 mx-auto text-slate-300 dark:text-slate-600" />
                    )}
                    <p className="text-xs font-bold">
                      {activeTab === 'inbox'
                        ? 'البريد الوارد فارغ حالياً'
                        : 'لم تقم بإرسال أي رسالة بعد'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('compose')}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <PenSquare className="w-3.5 h-3.5" />
                      <span>كتابة رسالة جديدة</span>
                    </button>
                  </div>
                ) : (
                  activeList.map((msg) => {
                    const isSelected = selectedMessage?.id === msg.id;
                    const isUnread = activeTab === 'inbox' && !(msg.readBy || []).includes(myId);
                    const catCfg = CATEGORY_CONFIG.find((c) => c.key === msg.recipientCategory);
                    const peerName = activeTab === 'inbox' ? msg.senderName : msg.recipientName;
                    const peerRole = activeTab === 'inbox' ? (msg.senderRoleLabel || '') : (msg.recipientRoleLabel || catCfg?.shortLabel || '');

                    return (
                      <div
                        key={msg.id}
                        onClick={() => setSelectedMessageId(msg.id)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer space-y-1.5 ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-400 dark:border-indigo-700 shadow-2xs'
                            : isUnread
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                            {activeTab === 'inbox' ? `من: ${peerName}` : `إلى: ${peerName}`}
                          </span>
                          {isUnread && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-black shrink-0">
                              جديد
                            </span>
                          )}
                        </div>
                        {peerRole && (
                          <span className="inline-block text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800">
                            {peerRole}
                          </span>
                        )}
                        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">
                          {msg.subject}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {msg.content}
                        </p>
                        <div className="flex items-center justify-between text-[9px] text-slate-400 tabular-nums pt-1">
                          <span>{formatDateTime(msg.createdAt)}</span>
                          {activeTab === 'sent' && (
                            <span className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                              <CheckCheck className="w-3 h-3" />
                              {(msg.readBy || []).includes(msg.recipientId) ? 'مقروءة' : 'مرسلة'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Detail Reader Column */}
              <div className="md:col-span-7 p-4 sm:p-6 overflow-y-auto flex flex-col justify-between bg-white dark:bg-slate-900">
                {selectedMessage ? (
                  <div className="space-y-4">
                    <div className="pb-3 border-b border-slate-100 dark:border-slate-800 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-snug">
                          {selectedMessage.subject}
                        </h4>
                        <button
                          type="button"
                          onClick={() => handleDeleteMessage(selectedMessage.id)}
                          title="حذف الرسالة من بريدي"
                          className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                        <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg font-bold">
                          المرسل: <strong className="text-slate-900 dark:text-white">{selectedMessage.senderName}</strong>
                          {selectedMessage.senderRoleLabel ? ` (${selectedMessage.senderRoleLabel})` : ''}
                        </span>
                        <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg font-bold">
                          المرسل إليه: <strong className="text-slate-900 dark:text-white">{selectedMessage.recipientName}</strong>
                          {selectedMessage.recipientRoleLabel ? ` (${selectedMessage.recipientRoleLabel})` : ''}
                        </span>
                        <span className="inline-flex items-center gap-1 text-slate-400 tabular-nums mr-auto">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDateTime(selectedMessage.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-100 leading-loose whitespace-pre-wrap font-medium min-h-[160px]">
                      {selectedMessage.content}
                    </div>

                    {activeTab === 'inbox' && (
                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => handleReply(selectedMessage)}
                          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-2 shadow-xs cursor-pointer"
                        >
                          <Reply className="w-4 h-4" />
                          <span>الرد على {selectedMessage.senderName}</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-12 space-y-2">
                    <MessageSquare className="w-10 h-10 text-slate-200 dark:text-slate-700" />
                    <p className="text-xs font-bold">اختر رسالة من القائمة لقراءة محتواها</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="تواصل"
          title="تواصل مع المسير المركزي، رئيس اللجنة التقنية، الأساتذة والحكام"
          className="p-2 sm:px-2.5 sm:py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg sm:rounded-full transition-all cursor-pointer flex items-center justify-center relative shrink-0 shadow-2xs"
          dir="rtl"
        >
          <MessageSquare className="w-4 h-4 text-slate-800 dark:text-slate-200 shrink-0" />
          {unreadInboxCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-pulse border border-white dark:border-slate-900">
              {unreadInboxCount}
            </span>
          )}
        </button>
      )}
      {modalContent && typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent}
    </>
  );
};
