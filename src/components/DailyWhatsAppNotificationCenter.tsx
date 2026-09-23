import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Match, School, Tournament, Venue, Referee, User } from '../types';
import { SPORTS_MAP, DataService } from '../lib/dataService';
import { useAuth } from '../contexts/AuthContext';
import {
  generateTeacherWhatsAppMessage,
  generateRefereeWhatsAppMessage,
  generatePrincipalWhatsAppMessage,
  generateDirectConciseMatchReminder,
  openWhatsApp,
  isValidPhoneNumber,
  sanitizePhoneNumber,
  WhatsAppMessageParams
} from '../lib/whatsappService';
import {
  MessageSquare,
  Calendar,
  Clock,
  MapPin,
  Send,
  UserCheck,
  Building,
  ShieldCheck,
  GraduationCap,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Phone,
  AlertCircle,
  Search,
  Filter,
  Users,
  Eye,
  RefreshCw,
  Edit3,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Volume2,
  Zap,
  ArrowRight,
  Share2,
  ShieldAlert,
  Lock
} from 'lucide-react';
import toast from 'react-hot-toast';

interface DailyWhatsAppNotificationCenterProps {
  matches: Match[];
  schools: School[];
  tournaments: Tournament[];
  venues: Venue[];
  referees: Referee[];
  teachers?: User[];
  onRefresh?: () => void;
}

// Stakeholder representation for Unified Broadcast
export interface MatchStakeholder {
  id: string;
  roleType: 'teacher1' | 'teacher2' | 'referee' | 'principal1' | 'principal2';
  roleLabel: string;
  roleBadgeColor: string;
  name: string;
  phone: string;
  schoolName?: string;
  schoolId?: string;
  userId?: string;
  refereeId?: string;
}

export const DailyWhatsAppNotificationCenter: React.FC<DailyWhatsAppNotificationCenterProps> = ({
  matches,
  schools,
  tournaments,
  venues,
  referees,
  teachers = [],
  onRefresh
}) => {
  const { userProfile } = useAuth();
  const [isMainPanelOpen, setIsMainPanelOpen] = useState(false);

  // Role & Sport Authorization Rules:
  // - CENTRAL_ADMIN: Can view and notify for all sports.
  // - SPORT_MANAGER: Can ONLY view and notify for their assigned sport.
  // - Tech Committee Head (isTechCommitteeHead): Can ONLY view and notify for their assigned sports (techCommitteeSports).
  // - Other roles: Restricted to their specific sport or view only.
  const isCentralAdmin = userProfile?.role === 'CENTRAL_ADMIN';
  const isSportManager = userProfile?.role === 'SPORT_MANAGER';
  const isTechCommitteeHead = userProfile?.isTechCommitteeHead === true;
  const isRegionalManager = (userProfile?.role as any) === 'REGIONAL_MANAGER' || isCentralAdmin;

  // Authorization rule: Only Tech Committee Heads, Regional Managers, or Central Admin can send notifications
  // Teachers (TEACHER) are strictly restricted from sending broadcast or individual notifications
  const canSendNotifications = isCentralAdmin || isRegionalManager || isTechCommitteeHead || isSportManager;

  const authorizedSportIds: string[] | null = useMemo(() => {
    if (isCentralAdmin) return null; // all sports allowed
    if (isSportManager && userProfile?.sportId) return [userProfile.sportId];
    if (isTechCommitteeHead) {
      if (userProfile?.techCommitteeSports && userProfile.techCommitteeSports.length > 0) {
        return userProfile.techCommitteeSports;
      }
      if (userProfile?.sportId) {
        return [userProfile.sportId];
      }
    }
    // Default for teachers/others
    if (userProfile?.sportId) return [userProfile.sportId];
    return [];
  }, [isCentralAdmin, isSportManager, isTechCommitteeHead, userProfile]);

  const [activeDateTab, setActiveDateTab] = useState<'today' | 'tomorrow' | 'upcoming' | 'all'>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSportFilter, setSelectedSportFilter] = useState<string>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Set default sport filter when restricted
  useEffect(() => {
    if (authorizedSportIds && authorizedSportIds.length > 0) {
      if (selectedSportFilter === 'ALL' || !authorizedSportIds.includes(selectedSportFilter)) {
        setSelectedSportFilter(authorizedSportIds[0]);
      }
    }
  }, [authorizedSportIds]);

  // Unified Broadcast Modal State
  const [selectedMatchForBroadcast, setSelectedMatchForBroadcast] = useState<any | null>(null);
  const [isGlobalBroadcastOpen, setIsGlobalBroadcastOpen] = useState(false);

  // Inline Phone Edit State
  const [editingContact, setEditingContact] = useState<{
    stakeholder: MatchStakeholder;
    phoneInput: string;
  } | null>(null);
  const [isSavingPhone, setIsSavingPhone] = useState(false);

  // One-Click Automated Dispatch Tracker
  const [dispatchedIds, setDispatchedIds] = useState<Set<string>>(new Set());
  const [isBroadcastingMatchId, setIsBroadcastingMatchId] = useState<string | null>(null);
  const [broadcastStatusMessage, setBroadcastStatusMessage] = useState<string | null>(null);

  // Consecutive Broadcast Queue state
  const [activeBroadcastQueue, setActiveBroadcastQueue] = useState<{
    title: string;
    items: {
      id: string;
      recipientName: string;
      roleLabel: string;
      phone: string;
      text: string;
      userId?: string;
      roleType?: string;
      schoolId?: string;
      schoolName?: string;
      refereeId?: string;
    }[];
    currentIndex: number;
    matchSportId?: string;
  } | null>(null);

  const [inlinePhoneInput, setInlinePhoneInput] = useState('');

  // Sync inline phone input with the current queue recipient
  useEffect(() => {
    if (activeBroadcastQueue && activeBroadcastQueue.currentIndex < activeBroadcastQueue.items.length) {
      const currentItem = activeBroadcastQueue.items[activeBroadcastQueue.currentIndex];
      setInlinePhoneInput(currentItem.phone || '');
    } else {
      setInlinePhoneInput('');
    }
  }, [activeBroadcastQueue, activeBroadcastQueue?.currentIndex]);

  // Helper date comparators (Local Moroccan Date)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  // Text normalization
  const normalizeText = (str?: string) => {
    if (!str) return '';
    return str
      .replace(/[\s\-\_\.\(\)]/g, '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .toLowerCase();
  };

  // Format matches with related data cache and synchronized phone lookup
  const enrichedMatches = useMemo(() => {
    return matches.map((m) => {
      // Find Tournament
      const tournament = tournaments.find((t) => t.id === m.tournamentId);

      // Find Sport info
      const sportId = m.sportId || tournament?.sportId || 'football';
      const sportInfo = SPORTS_MAP[sportId] || { name: sportId, icon: '🏆' };

      // Find Schools: by team1Id / team2Id directly or matching school ID or school Name
      const school1 = schools.find(
        (s) =>
          s.id === m.team1Id ||
          s.name === m.team1Id ||
          normalizeText(s.name) === normalizeText(m.team1Id)
      );
      const school2 = schools.find(
        (s) =>
          s.id === m.team2Id ||
          s.name === m.team2Id ||
          normalizeText(s.name) === normalizeText(m.team2Id)
      );

      const team1Name = school1?.name || m.team1Id || 'الفريق الأول';
      const team2Name = school2?.name || m.team2Id || 'الفريق الثاني';

      // Live synchronized teacher resolution:
      const matchedTeacher1 = teachers.find(
        (t) =>
          (t.workLocation && normalizeText(t.workLocation) === normalizeText(team1Name)) ||
          (t.workLocation &&
            (normalizeText(t.workLocation).includes(normalizeText(team1Name)) ||
              normalizeText(team1Name).includes(normalizeText(t.workLocation)))) ||
          (t.fullName && school1?.teacherName && normalizeText(t.fullName) === normalizeText(school1.teacherName)) ||
          (school1?.id && t.workLocation && normalizeText(t.workLocation) === normalizeText(school1.name)) ||
          t.id === school1?.id
      );

      const matchedTeacher2 = teachers.find(
        (t) =>
          (t.workLocation && normalizeText(t.workLocation) === normalizeText(team2Name)) ||
          (t.workLocation &&
            (normalizeText(t.workLocation).includes(normalizeText(team2Name)) ||
              normalizeText(team2Name).includes(normalizeText(t.workLocation)))) ||
          (t.fullName && school2?.teacherName && normalizeText(t.fullName) === normalizeText(school2.teacherName)) ||
          (school2?.id && t.workLocation && normalizeText(t.workLocation) === normalizeText(school2.name)) ||
          t.id === school2?.id
      );

      // Prioritize live updated teacher phone from user profile, falling back to school's phone
      const teacher1 = {
        fullName: matchedTeacher1?.fullName || school1?.teacherName || `أستاذ ${team1Name}`,
        phone: matchedTeacher1?.phone || school1?.phone || '',
        userId: matchedTeacher1?.id,
        isRegisteredUser: !!matchedTeacher1
      };

      const teacher2 = {
        fullName: matchedTeacher2?.fullName || school2?.teacherName || `أستاذ ${team2Name}`,
        phone: matchedTeacher2?.phone || school2?.phone || '',
        userId: matchedTeacher2?.id,
        isRegisteredUser: !!matchedTeacher2
      };

      // Principal 1 & 2 resolution
      const principal1 = {
        fullName: school1?.principalName || `مدير ${team1Name}`,
        phone: school1?.principalPhone || school1?.phone || '',
        schoolId: school1?.id
      };

      const principal2 = {
        fullName: school2?.principalName || `مدير ${team2Name}`,
        phone: school2?.principalPhone || school2?.phone || '',
        schoolId: school2?.id
      };

      // Find Venue
      const venue = venues.find((v) => v.id === m.venueId) || {
        name: m.venueId || 'مركز التباري المحدد',
        address: ''
      };

      // Find Referees with live synchronized phones
      const assignedReferees: { id: string; name: string; phone: string; role: string }[] = [];

      const resolveRefPhone = (refId: string) => {
        const refObj = referees.find((r) => r.id === refId || r.fullName === refId || normalizeText(r.fullName) === normalizeText(refId));
        const refTeacher = teachers.find((t) => t.id === refId || t.fullName === refId || normalizeText(t.fullName) === normalizeText(refId));
        const name = refTeacher?.fullName || refObj?.fullName || refId;
        const phone = refTeacher?.phone || refObj?.phone || '';
        return { name, phone };
      };

      if (m.referee1Id) {
        const { name, phone } = resolveRefPhone(m.referee1Id);
        assignedReferees.push({
          id: m.referee1Id,
          name,
          phone,
          role: 'الحكم الرئيسي'
        });
      }

      if (m.referee2Id) {
        const { name, phone } = resolveRefPhone(m.referee2Id);
        assignedReferees.push({
          id: m.referee2Id,
          name,
          phone,
          role: 'حكم مساعد'
        });
      }

      if (m.referees && m.referees.length > 0) {
        m.referees.forEach((refId, idx) => {
          if (refId !== m.referee1Id && refId !== m.referee2Id) {
            const { name, phone } = resolveRefPhone(refId);
            assignedReferees.push({
              id: refId,
              name,
              phone,
              role: `حكم مساعد (${idx + 1})`
            });
          }
        });
      }

      // Date normalization
      let dateString = '';
      if (typeof m.date === 'string') {
        dateString = m.date.split('T')[0];
      } else if (m.date?.toDate) {
        dateString = m.date.toDate().toISOString().split('T')[0];
      } else if (m.date) {
        dateString = new Date(m.date).toISOString().split('T')[0];
      }

      // Build List of all Stakeholders for this match
      const stakeholders: MatchStakeholder[] = [
        {
          id: `t1-${m.id}`,
          roleType: 'teacher1',
          roleLabel: `مؤطر ${team1Name}`,
          roleBadgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          name: teacher1.fullName,
          phone: teacher1.phone,
          schoolName: team1Name,
          schoolId: school1?.id,
          userId: teacher1.userId
        },
        {
          id: `t2-${m.id}`,
          roleType: 'teacher2',
          roleLabel: `مؤطر ${team2Name}`,
          roleBadgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          name: teacher2.fullName,
          phone: teacher2.phone,
          schoolName: team2Name,
          schoolId: school2?.id,
          userId: teacher2.userId
        },
        ...assignedReferees.map((ref, idx) => ({
          id: `ref-${m.id}-${idx}`,
          roleType: 'referee' as const,
          roleLabel: ref.role,
          roleBadgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
          name: ref.name,
          phone: ref.phone,
          refereeId: ref.id
        })),
        {
          id: `p1-${m.id}`,
          roleType: 'principal1',
          roleLabel: `مدير ${team1Name}`,
          roleBadgeColor: 'bg-blue-50 text-blue-800 border-blue-200',
          name: principal1.fullName,
          phone: principal1.phone,
          schoolName: team1Name,
          schoolId: school1?.id
        },
        {
          id: `p2-${m.id}`,
          roleType: 'principal2',
          roleLabel: `مدير ${team2Name}`,
          roleBadgeColor: 'bg-blue-50 text-blue-800 border-blue-200',
          name: principal2.fullName,
          phone: principal2.phone,
          schoolName: team2Name,
          schoolId: school2?.id
        }
      ];

      return {
        match: m,
        tournament,
        sportId,
        sportInfo,
        school1,
        school2,
        team1Name,
        team2Name,
        teacher1,
        teacher2,
        principal1,
        principal2,
        venue,
        assignedReferees,
        dateString,
        stakeholders
      };
    });
  }, [matches, schools, tournaments, venues, referees, teachers]);

  // Filtered by authorized sport, active tab, and search query
  const filteredEnrichedMatches = useMemo(() => {
    return enrichedMatches
      .filter((item) => {
        const itemSportId = item.sportId;

        // 1. Strict Role-based Sport Authorization:
        // A Tech Committee Head or Sport Manager can ONLY see and notify their assigned sport(s)
        if (authorizedSportIds !== null) {
          if (!authorizedSportIds.includes(itemSportId)) {
            return false;
          }
        }

        // 2. Date Filter
        if (activeDateTab === 'today') {
          if (item.dateString !== todayStr) return false;
        } else if (activeDateTab === 'tomorrow') {
          if (item.dateString !== tomorrowStr) return false;
        } else if (activeDateTab === 'upcoming') {
          if (item.dateString < todayStr || item.match.status === 'Completed') return false;
        }

        // 3. Sport Filter Dropdown
        if (selectedSportFilter !== 'ALL') {
          if (itemSportId !== selectedSportFilter) return false;
        }

        // 4. Search Query
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          const matchText = `${item.team1Name} ${item.team2Name} ${item.venue.name} ${item.tournament?.name || ''} ${item.sportInfo.name}`.toLowerCase();
          if (!matchText.includes(query)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (a.dateString !== b.dateString) {
          return a.dateString.localeCompare(b.dateString);
        }
        return (a.match.startTime || '').localeCompare(b.match.startTime || '');
      });
  }, [enrichedMatches, authorizedSportIds, activeDateTab, selectedSportFilter, searchQuery, todayStr, tomorrowStr]);

  // Counts for tabs (scoped to authorized sports)
  const tabCounts = useMemo(() => {
    const accessibleMatches = enrichedMatches.filter((item) => {
      if (authorizedSportIds !== null) {
        return authorizedSportIds.includes(item.sportId);
      }
      return true;
    });

    return {
      today: accessibleMatches.filter((m) => m.dateString === todayStr).length,
      tomorrow: accessibleMatches.filter((m) => m.dateString === tomorrowStr).length,
      upcoming: accessibleMatches.filter((m) => m.dateString >= todayStr && m.match.status !== 'Completed').length,
      all: accessibleMatches.length
    };
  }, [enrichedMatches, authorizedSportIds, todayStr, tomorrowStr]);

  // Helper to build standardized message params
  const getParamsForMatch = (item: typeof enrichedMatches[0], recipientName?: string): WhatsAppMessageParams => {
    const m = item.match;
    const tourn = item.tournament;
    const formattedDate = item.dateString
      ? new Date(item.dateString).toLocaleDateString('ar-MA', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      : 'موعد اللقاء';

    const genderLabel = m.gender === 'Female' ? 'إناث' : m.gender === 'Mixed' ? 'مختلط' : 'ذكور';
    const ageCat = m.ageCategory || tourn?.ageCategory || 'عام';

    return {
      tournamentName: tourn?.name || 'البطولة الإقليمية للرياضة المدرسية',
      sportName: item.sportInfo.name,
      ageCategory: ageCat,
      gender: genderLabel,
      stageName: m.stage || 'إقصائيات',
      team1SchoolName: item.team1Name,
      team2SchoolName: item.team2Name,
      dateStr: formattedDate,
      timeStr: m.startTime || '10:00',
      venueName: item.venue.name,
      venueAddress: item.venue.address,
      refereeNames: item.assignedReferees.map((r) => r.name),
      recipientName
    };
  };

  // Generate the concise unified message for any match
  const getUnifiedNotificationText = (item: typeof enrichedMatches[0]): string => {
    const params = getParamsForMatch(item);
    return generateDirectConciseMatchReminder(params);
  };

  const handleCopyText = (text: string, id: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success(`تم نسخ ${label} إلى الحافظة بنجاح 📋`);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Live Refresh handler
  const handleTriggerRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      }
      toast.success('تم تحيين ومزامنة أرقام الهواتف وبيانات المباريات بنجاح!');
    } catch (e) {
      toast.error('تعذر تحديث البيانات');
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Quick Inline Save for Contact Phone
  const handleSaveQuickPhone = async () => {
    if (!editingContact) return;
    const { stakeholder, phoneInput } = editingContact;
    const cleanPhone = phoneInput.trim();

    if (!cleanPhone) {
      toast.error('يرجى إدخال رقم الهاتف');
      return;
    }

    setIsSavingPhone(true);
    try {
      if (stakeholder.roleType === 'teacher1' || stakeholder.roleType === 'teacher2') {
        await DataService.updateContactPhone({
          type: 'teacher',
          id: stakeholder.userId,
          schoolId: stakeholder.schoolId,
          schoolName: stakeholder.schoolName,
          name: stakeholder.name,
          phone: cleanPhone
        });
      } else if (stakeholder.roleType === 'principal1' || stakeholder.roleType === 'principal2') {
        await DataService.updateContactPhone({
          type: 'principal',
          schoolId: stakeholder.schoolId,
          schoolName: stakeholder.schoolName,
          phone: cleanPhone
        });
      } else if (stakeholder.roleType === 'referee') {
        await DataService.updateContactPhone({
          type: 'referee',
          id: stakeholder.refereeId,
          name: stakeholder.name,
          phone: cleanPhone
        });
      }

      toast.success(`تم تحيين رقم هاتف (${stakeholder.name}) بنجاح`);
      setEditingContact(null);
      if (onRefresh) {
        onRefresh();
      }
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء حفظ رقم الهاتف');
    } finally {
      setIsSavingPhone(false);
    }
  };

  // Quick Inline Save inside consecutive broadcast assistant queue
  const handleSaveInlinePhone = async () => {
    if (!activeBroadcastQueue) return;
    const currentItem = activeBroadcastQueue.items[activeBroadcastQueue.currentIndex];
    const cleanPhone = inlinePhoneInput.trim();
    if (!cleanPhone || cleanPhone.length < 8) {
      toast.error('يرجى إدخال رقم هاتف صالح (8 أرقام على الأقل)');
      return;
    }

    try {
      if (currentItem.roleType === 'teacher1' || currentItem.roleType === 'teacher2') {
        await DataService.updateContactPhone({
          type: 'teacher',
          id: currentItem.userId,
          schoolId: currentItem.schoolId,
          schoolName: currentItem.schoolName,
          name: currentItem.recipientName,
          phone: cleanPhone
        });
      } else if (currentItem.roleType === 'principal1' || currentItem.roleType === 'principal2') {
        await DataService.updateContactPhone({
          type: 'principal',
          schoolId: currentItem.schoolId,
          schoolName: currentItem.schoolName,
          phone: cleanPhone
        });
      } else if (currentItem.roleType === 'referee') {
        await DataService.updateContactPhone({
          type: 'referee',
          id: currentItem.refereeId,
          name: currentItem.recipientName,
          phone: cleanPhone
        });
      }

      // Update the phone number in our active broadcast queue items list state
      setActiveBroadcastQueue((prev) => {
        if (!prev) return null;
        const updatedItems = [...prev.items];
        updatedItems[prev.currentIndex] = {
          ...updatedItems[prev.currentIndex],
          phone: cleanPhone
        };
        return {
          ...prev,
          items: updatedItems
        };
      });

      toast.success(`تم حفظ هاتف ${currentItem.recipientName} بنجاح`);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء حفظ رقم الهاتف');
    }
  };

  // =========================================================================
  // ONE-CLICK UNIFIED BROADCAST ENGINE (زر واحد يرسل الاشعار الموحد لجميع المعنيين)
  // =========================================================================
  const handleOneClickUnifiedBroadcast = async (matchItem: typeof enrichedMatches[0]) => {
    // 0. Authorization check: Only Tech Committee Heads, Regional Managers, or Central Admin
    if (!canSendNotifications) {
      toast.error('صلاحية مقيدة: يحق فقط لرؤساء اللجن التقنية أو المسؤول الإقليمي أو المركز إرسال الإشعارات.');
      return;
    }

    // 1. Security check: verify user is authorized for this sport
    if (authorizedSportIds !== null && !authorizedSportIds.includes(matchItem.sportId)) {
      toast.error(`عذراً، بصفتك رئيس لجنة تقنية يمكنك إشعار المعنيين برياضتك المحددة فقط.`);
      return;
    }

    const unifiedText = getUnifiedNotificationText(matchItem);

    try {
      // 2. Dispatch in-app system push notification
      const validUserIds = matchItem.stakeholders.map((s) => s.userId).filter(Boolean) as string[];
      if (validUserIds.length > 0) {
        await DataService.addNotification({
          title: `⚡ إشعار موحد للمباراة: ${matchItem.sportInfo.name}`,
          body: unifiedText,
          sportId: matchItem.sportId,
          role: 'ALL',
          userIds: validUserIds
        });
      }
    } catch (err) {
      console.warn('System push notification error:', err);
    }

    // 3. Populate consecutive broadcast queue with ALL stakeholders (even without phone, for on-the-spot completion)
    const rawItems = matchItem.stakeholders.map((s) => ({
      id: s.id,
      recipientName: s.name,
      roleLabel: s.roleLabel,
      phone: s.phone || '',
      text: unifiedText,
      userId: s.userId,
      roleType: s.roleType,
      schoolId: s.schoolId,
      schoolName: s.schoolName,
      refereeId: s.refereeId
    }));

    // Deduplicate on non-empty phone numbers to prevent duplicate WhatsApp tabs for same user
    const seenPhones = new Set<string>();
    const queueItems = rawItems.filter((item) => {
      if (!item.phone || item.phone.trim().length < 8) return true; // keep empty or short phones for user to fill in
      const p = item.phone.trim();
      if (seenPhones.has(p)) return false;
      seenPhones.add(p);
      return true;
    });

    setActiveBroadcastQueue({
      title: `إرسال الإشعار الموحد للمباراة: ${matchItem.team1Name} ضد ${matchItem.team2Name}`,
      items: queueItems,
      currentIndex: 0,
      matchSportId: matchItem.sportId
    });
  };

  // ONE-CLICK GLOBAL BROADCAST FOR ALL TODAY'S MATCHES
  const handleOneClickGlobalDailyBroadcast = async () => {
    if (!canSendNotifications) {
      toast.error('صلاحية مقيدة: يحق فقط لرؤساء اللجن التقنية أو المسؤول الإقليمي أو المركز إرسال الإشعارات.');
      return;
    }

    const todayMatches = filteredEnrichedMatches.filter((m) => m.dateString === todayStr);
    if (todayMatches.length === 0) {
      toast.error('لا توجد مباريات مبرمجة لليوم في نطاق اختصاصك.');
      return;
    }

    const rawItems: any[] = [];

    todayMatches.forEach((matchItem) => {
      const unifiedText = getUnifiedNotificationText(matchItem);
      matchItem.stakeholders.forEach((s) => {
        rawItems.push({
          id: s.id,
          recipientName: s.name,
          roleLabel: `${s.roleLabel} (${matchItem.team1Name} ضد ${matchItem.team2Name})`,
          phone: s.phone || '',
          text: unifiedText,
          userId: s.userId,
          roleType: s.roleType,
          schoolId: s.schoolId,
          schoolName: s.schoolName,
          refereeId: s.refereeId
        });
      });
    });

    // Deduplicate non-empty phones
    const seenPhones = new Set<string>();
    const queueItems = rawItems.filter((item) => {
      if (!item.phone || item.phone.trim().length < 8) return true;
      const p = item.phone.trim();
      if (seenPhones.has(p)) return false;
      seenPhones.add(p);
      return true;
    });

    if (queueItems.length === 0) {
      toast.error('لم يتم العثور على أطراف معنية لمباريات اليوم.');
      return;
    }

    // Dispatch in-app system push notifications for each match
    for (const matchItem of todayMatches) {
      try {
        const unifiedText = getUnifiedNotificationText(matchItem);
        const validUserIds = matchItem.stakeholders.map((s) => s.userId).filter(Boolean) as string[];
        if (validUserIds.length > 0) {
          await DataService.addNotification({
            title: `⚡ إشعار موحد للمباراة: ${matchItem.sportInfo.name}`,
            body: unifiedText,
            sportId: matchItem.sportId,
            role: 'ALL',
            userIds: validUserIds
          });
        }
      } catch (err) {
        console.warn('System push notification error:', err);
      }
    }

    setActiveBroadcastQueue({
      title: `إرسال الإشعار الموحد لكافة مباريات اليوم (${todayMatches.length} مقابلة)`,
      items: queueItems,
      currentIndex: 0
    });
    setIsGlobalBroadcastOpen(false);
  };

  // Get authorized sports names for display
  const authorizedSportsNames = useMemo(() => {
    if (authorizedSportIds === null) return 'جميع الرياضات';
    if (authorizedSportIds.length === 0) return 'لا توجد رياضة مخصصة';
    return authorizedSportIds.map((id) => SPORTS_MAP[id]?.name || id).join('، ');
  }, [authorizedSportIds]);

  // لا تظهر هذه النافذة للأستاذ العادي أو الحكم (يطلع فقط على الإشعارات من الجرس)
  if (!canSendNotifications) {
    return null;
  }

  if (!isMainPanelOpen) {
    return (
      <div 
        onClick={() => setIsMainPanelOpen(true)}
        className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-emerald-700/30 animate-in fade-in"
        dir="rtl"
        style={{ fontFamily: "'Cairo', 'Tajawal', sans-serif" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0 text-emerald-300 shadow-xs">
            <Zap className="w-5 h-5 text-amber-300 fill-amber-300 animate-pulse" />
          </div>
          <div className="text-right">
            <h4 className="text-sm font-black text-white flex items-center gap-1.5 flex-wrap">
              <span>مركز الإشعارات اليومية والتذكير الموحد عبر الواتساب</span>
              <span className="bg-emerald-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">نشط ⚡</span>
            </h4>
            <p className="text-xs text-emerald-100/80 mt-0.5 font-medium line-clamp-1">
              أرسل التذكير بنقرة واحدة لجميع المؤطرين والحكام والمدراء لمباريات اليوم ({tabCounts.today}).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <span className="text-[11px] font-black bg-white text-emerald-950 hover:bg-emerald-50 px-3.5 py-2 rounded-xl transition-all shadow-xs flex items-center gap-1.5 active:scale-98">
            <span>فتح مركز الإشعارات</span>
            <span>🔔</span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200" dir="rtl" style={{ fontFamily: "'Cairo', 'Tajawal', sans-serif" }}>
      <div className="min-h-full flex items-center justify-center p-2 sm:p-4 text-right">
        <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 relative">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 p-5 md:p-6 text-white relative shrink-0">
          
          {/* Close button inside modal */}
          <button
            type="button"
            onClick={() => setIsMainPanelOpen(false)}
            className="absolute top-4 left-4 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="إغلاق مركز الإشعارات"
          >
            <XCircle className="w-6 h-6 text-emerald-200 hover:text-white" />
          </button>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pl-10">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0 text-emerald-300 shadow-xs">
                <Zap className="w-6 h-6 text-amber-300 fill-amber-300" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="bg-emerald-500 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-xs">
                    <Zap className="w-3 h-3 fill-slate-950" />
                    إرسال الإشعار الموحد بنقرة واحدة ⚡
                  </span>
                  {isTechCommitteeHead && (
                    <span className="bg-amber-400/90 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      رئيس اللجنة التقنية: {authorizedSportsNames}
                    </span>
                  )}
                  {isSportManager && (
                    <span className="bg-blue-400/90 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      مسؤول رياضة: {authorizedSportsNames}
                    </span>
                  )}
                </div>
                <h3 className="text-base md:text-lg font-bold text-white">
                  مركز الإشعارات اليومية والتذكير الموحد عبر الواتساب
                </h3>
                <p className="text-xs text-emerald-100/80 mt-1 max-w-2xl leading-relaxed">
                  {isTechCommitteeHead || isSportManager
                    ? `بصفتك مسؤولاً عن (${authorizedSportsNames})، يمكنك إرسال الإشعار الموحد بنقرة واحدة لجميع المعنيين برياضتك (المؤطران، الحكام، المدراء).`
                    : 'إرسال الإشعار الموحد لكافة المعنيين (المؤطران، الحكام، ومدراء المؤسستين) بنقرة واحدة ومباشرة مع التحيين اللحظي لأرقام الهواتف.'}
                </p>
              </div>
            </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            {/* Live Refresh Button */}
            <button
              type="button"
              onClick={handleTriggerRefresh}
              disabled={isRefreshing}
              className="bg-white/10 hover:bg-white/20 active:scale-95 border border-white/20 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              title="تحديث وتحيين أرقام الهواتف والبيانات الآن"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-300' : ''}`} />
              <span>{isRefreshing ? 'جاري التحيين...' : 'تحيين الأرقام'}</span>
            </button>

            {/* Global Day Broadcast Trigger - Only for Tech Committee Heads, Regional Managers, or Central Admin */}
            {canSendNotifications && (
              <button
                type="button"
                onClick={() => setIsGlobalBroadcastOpen(true)}
                className="bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                title="إشعار جماعي موحد لكافة مباريات اليوم"
              >
                <Zap className="w-4 h-4 fill-slate-950" />
                <span>إشعار جماعي لليوم ({tabCounts.today})</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Date Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-emerald-700/50">
          <button
            type="button"
            onClick={() => setActiveDateTab('today')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeDateTab === 'today'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                : 'bg-emerald-900/50 text-emerald-100 hover:bg-emerald-900/80 border border-emerald-700/40'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>مباريات اليوم</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeDateTab === 'today' ? 'bg-slate-950 text-emerald-400' : 'bg-emerald-800 text-emerald-200'
              }`}
            >
              {tabCounts.today}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveDateTab('tomorrow')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeDateTab === 'tomorrow'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                : 'bg-emerald-900/50 text-emerald-100 hover:bg-emerald-900/80 border border-emerald-700/40'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>مباريات الغد</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeDateTab === 'tomorrow' ? 'bg-slate-950 text-emerald-400' : 'bg-emerald-800 text-emerald-200'
              }`}
            >
              {tabCounts.tomorrow}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveDateTab('upcoming')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeDateTab === 'upcoming'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                : 'bg-emerald-900/50 text-emerald-100 hover:bg-emerald-900/80 border border-emerald-700/40'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>جميع المباريات القادمة</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeDateTab === 'upcoming' ? 'bg-slate-950 text-emerald-400' : 'bg-emerald-800 text-emerald-200'
              }`}
            >
              {tabCounts.upcoming}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveDateTab('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeDateTab === 'all'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                : 'bg-emerald-900/50 text-emerald-100 hover:bg-emerald-900/80 border border-emerald-700/40'
            }`}
          >
            <span>سجل كافة المباريات</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeDateTab === 'all' ? 'bg-slate-950 text-emerald-400' : 'bg-emerald-800 text-emerald-200'
              }`}
            >
              {tabCounts.all}
            </span>
          </button>
        </div>
      </div>

      {/* Body Container */}
      <div className="flex-1 min-h-0 pb-10">
        {/* Security Scope & Role Permission Notices */}
        {!canSendNotifications ? (
          <div className="bg-blue-50/90 border-b border-blue-200 px-4 py-2.5 flex items-center gap-2 text-xs text-blue-950 font-medium">
            <ShieldAlert className="w-4 h-4 text-blue-700 shrink-0" />
            <span>
              <strong>صلاحية إرسال الإشعارات مقيدة:</strong> يحق فقط لرؤساء اللجن التقنية أو المسؤول الإقليمي أو المركز إرسال الإشعار الجماعي أو أي إشعار موجه. حسابك مخصص لمتابعة برمجة المباريات ونسخ تفاصيلها.
            </span>
          </div>
        ) : (isTechCommitteeHead || isSportManager) ? (
          <div className="bg-amber-50/90 border-b border-amber-200 px-4 py-2.5 flex items-center gap-2 text-xs text-amber-900 font-medium">
            <Lock className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>نطاق الصلاحية محدد:</strong> بصفتك رئيساً للجنة التقنية لـ (<strong>{authorizedSportsNames}</strong>)، تظهر لك فقط مباريات تخصصك ويتم إرسال الإشعارات للمعنيين بها حصراً.
            </span>
          </div>
        ) : null}

      {/* Filter and Search Bar */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="بحث بالمؤسسة، القاعة، البطولة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-9 pl-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={selectedSportFilter}
            onChange={(e) => setSelectedSportFilter(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500"
          >
            {isCentralAdmin && <option value="ALL">جميع الرياضات</option>}
            {Object.entries(SPORTS_MAP)
              .filter(([id]) => (authorizedSportIds === null ? true : authorizedSportIds.includes(id)))
              .map(([id, info]) => (
                <option key={id} value={id}>
                  {info.icon} {info.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Matches List */}
      <div className="p-4 md:p-6 space-y-5">
        {filteredEnrichedMatches.length === 0 ? (
          <div className="text-center py-12 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-700">لا توجد مباريات مسجلة في هذا القسم</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {activeDateTab === 'today'
                ? `لا توجد مباريات مبرمجة لليوم الحالي في (${authorizedSportsNames}). يمكنك مراجعة مباريات الغد أو تصفح كافة المباريات القادمة.`
                : 'لا توجد نتائج مطابقة لخيارات البحث المحددة.'}
            </p>
          </div>
        ) : (
          filteredEnrichedMatches.map((item) => {
            const m = item.match;
            const isExpanded = expandedMatchId === m.id || filteredEnrichedMatches.length <= 4;
            const tourn = item.tournament;
            const unifiedMsg = getUnifiedNotificationText(item);
            const registeredCount = item.stakeholders.filter((s) => s.phone && s.phone.trim().length >= 8).length;
            const isBroadcastingThis = isBroadcastingMatchId === m.id;

            return (
              <div
                key={m.id}
                className="bg-white border border-slate-200 rounded-2xl shadow-xs hover:border-emerald-300 transition-all overflow-hidden"
              >
                {/* Match Summary Bar */}
                <div className="p-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl p-2 bg-white rounded-xl shadow-2xs border border-slate-200">
                      {item.sportInfo.icon}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">
                          {tourn?.name || 'البطولة الإقليمية للرياضة المدرسية'}
                        </span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full">
                          {item.sportInfo.name}
                        </span>
                      </div>
                      <h4 className="text-sm md:text-base font-black text-slate-900 mt-0.5 flex items-center gap-2">
                        <span className="text-emerald-700">{item.team1Name}</span>
                        <span className="text-slate-400 text-xs font-normal">ضد</span>
                        <span className="text-emerald-700">{item.team2Name}</span>
                      </h4>
                    </div>
                  </div>

                  {/* Primary Action: ONE-CLICK UNIFIED BROADCAST BUTTON */}
                  <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
                    {canSendNotifications ? (
                      <button
                        type="button"
                        onClick={() => handleOneClickUnifiedBroadcast(item)}
                        disabled={isBroadcastingThis}
                        className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 active:scale-95 text-white text-xs font-black rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
                        title="إرسال الإشعار الموحد لجميع المعنيين (المؤطران، الحكام، المدراء) بنقرة واحدة"
                      >
                        <Zap className={`w-4 h-4 fill-amber-300 text-amber-300 ${isBroadcastingThis ? 'animate-bounce' : ''}`} />
                        <span>إرسال موحد لجميع المعنيين ({registeredCount} أطراف) ⚡</span>
                      </button>
                    ) : (
                      <div className="px-3 py-1.5 bg-slate-100 text-slate-500 text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-slate-200">
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                        <span>للاطلاع (الإرسال مقتصر على اللجن والمسؤولين)</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setSelectedMatchForBroadcast(item)}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="استعراض تفاصيل المعنيين وتعديل الأرقام"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>لائحة المعنيين</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyText(unifiedMsg, `msg-${m.id}`, 'الإشعار الموحد')}
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                      title="نسخ نص الإشعار الموحد"
                    >
                      {copiedId === `msg-${m.id}` ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setExpandedMatchId(expandedMatchId === m.id ? null : m.id)}
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                      title={isExpanded ? 'طي التفاصيل' : 'عرض تفاصيل أكثر'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Match Details Strip */}
                <div className="px-4 py-2 bg-slate-50/50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="flex items-center gap-1.5 font-bold text-slate-700">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{item.dateString}</span>
                    </span>
                    <span className="flex items-center gap-1.5 font-bold text-slate-700">
                      <Clock className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{m.startTime || '10:00'}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <MapPin className="w-3.5 h-3.5 text-rose-500" />
                      <span>{item.venue.name}</span>
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>
                      {registeredCount} من أصل {item.stakeholders.length} أرقام هواتف مسجلة ومحينة
                    </span>
                  </div>
                </div>

                {/* Unified Message Box */}
                <div className="p-4 bg-emerald-50/40 border-b border-emerald-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-emerald-900 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-emerald-700" />
                      <span>نص الإشعار الموحد للمباراة:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(unifiedMsg, `u-${m.id}`, 'نص الإشعار الموحد')}
                      className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedId === `u-${m.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>نسخ النص</span>
                    </button>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-emerald-200 text-xs font-mono text-slate-800 leading-relaxed">
                    {unifiedMsg}
                  </div>
                </div>

                {/* Expanded Stakeholders Grid */}
                {isExpanded && (
                  <div className="p-4 bg-slate-50/30 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* 1. Teacher Team 1 */}
                    <div className="bg-white border border-emerald-200/80 rounded-xl p-3 flex flex-col justify-between gap-2 shadow-2xs">
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                            مؤطر الفريق 1
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingContact({
                                stakeholder: item.stakeholders[0],
                                phoneInput: item.teacher1.phone || ''
                              })
                            }
                            className="text-slate-400 hover:text-blue-600 p-0.5"
                            title="تعديل رقم هاتف الأستاذ"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-xs font-bold text-slate-800 truncate" title={item.teacher1.fullName}>
                          {item.teacher1.fullName}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                          <Phone className="w-2.5 h-2.5 text-emerald-600" />
                          {item.teacher1.phone ? (
                            <span className="text-emerald-700 font-bold">{item.teacher1.phone}</span>
                          ) : (
                            <span className="text-amber-600 italic">غير مسجل</span>
                          )}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-emerald-200/50 flex flex-col gap-1.5">
                        {canSendNotifications ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                if (!item.teacher1.phone) {
                                  toast.error(`رقم هاتف أستاذ ${item.team1Name} غير مسجل`);
                                  return;
                                }
                                openWhatsApp(item.teacher1.phone, unifiedMsg);
                                setDispatchedIds((prev) => new Set(prev).add(`t1-${m.id}`));
                              }}
                              className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white py-1.5 px-2.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                            >
                              <Send className="w-3 h-3" />
                              <span>واتساب مؤطر 1</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const teacherQueueItems = [
                                  {
                                    id: `t1-${m.id}`,
                                    recipientName: item.teacher1.fullName,
                                    roleLabel: `مؤطر ${item.team1Name}`,
                                    phone: item.teacher1.phone || '',
                                    text: unifiedMsg,
                                    roleType: 'teacher1' as const,
                                    schoolId: item.school1?.id,
                                    schoolName: item.team1Name,
                                    userId: item.teacher1.userId
                                  },
                                  {
                                    id: `t2-${m.id}`,
                                    recipientName: item.teacher2.fullName,
                                    roleLabel: `مؤطر ${item.team2Name}`,
                                    phone: item.teacher2.phone || '',
                                    text: unifiedMsg,
                                    roleType: 'teacher2' as const,
                                    schoolId: item.school2?.id,
                                    schoolName: item.team2Name,
                                    userId: item.teacher2.userId
                                  }
                                ];

                                setActiveBroadcastQueue({
                                  title: `بث الإشعار الموحد للمؤطرين: ${item.team1Name} ضد ${item.team2Name}`,
                                  items: teacherQueueItems,
                                  currentIndex: 0,
                                  matchSportId: item.sportId
                                });
                              }}
                              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-95 text-white py-1 px-2 rounded-lg text-[10px] font-black flex items-center justify-center gap-1 transition-all shadow-xs cursor-pointer"
                            >
                              <Zap className="w-2.5 h-2.5 fill-white shrink-0" />
                              <span>بث للمؤطرين معاً ⚡</span>
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-medium py-1">مؤطر معتمد للفريق الأول</span>
                        )}
                      </div>
                    </div>

                    {/* 2. Teacher Team 2 */}
                    <div className="bg-white border border-emerald-200/80 rounded-xl p-3 flex flex-col justify-between gap-2 shadow-2xs">
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                            مؤطر الفريق 2
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingContact({
                                stakeholder: item.stakeholders[1],
                                phoneInput: item.teacher2.phone || ''
                              })
                            }
                            className="text-slate-400 hover:text-blue-600 p-0.5"
                            title="تعديل رقم هاتف الأستاذ"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-xs font-bold text-slate-800 truncate" title={item.teacher2.fullName}>
                          {item.teacher2.fullName}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                          <Phone className="w-2.5 h-2.5 text-emerald-600" />
                          {item.teacher2.phone ? (
                            <span className="text-emerald-700 font-bold">{item.teacher2.phone}</span>
                          ) : (
                            <span className="text-amber-600 italic">غير مسجل</span>
                          )}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-emerald-200/50 flex flex-col gap-1.5">
                        {canSendNotifications ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                if (!item.teacher2.phone) {
                                  toast.error(`رقم هاتف أستاذ ${item.team2Name} غير مسجل`);
                                  return;
                                }
                                openWhatsApp(item.teacher2.phone, unifiedMsg);
                                setDispatchedIds((prev) => new Set(prev).add(`t2-${m.id}`));
                              }}
                              className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white py-1.5 px-2.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                            >
                              <Send className="w-3 h-3" />
                              <span>واتساب مؤطر 2</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const teacherQueueItems = [
                                  {
                                    id: `t1-${m.id}`,
                                    recipientName: item.teacher1.fullName,
                                    roleLabel: `مؤطر ${item.team1Name}`,
                                    phone: item.teacher1.phone || '',
                                    text: unifiedMsg,
                                    roleType: 'teacher1' as const,
                                    schoolId: item.school1?.id,
                                    schoolName: item.team1Name,
                                    userId: item.teacher1.userId
                                  },
                                  {
                                    id: `t2-${m.id}`,
                                    recipientName: item.teacher2.fullName,
                                    roleLabel: `مؤطر ${item.team2Name}`,
                                    phone: item.teacher2.phone || '',
                                    text: unifiedMsg,
                                    roleType: 'teacher2' as const,
                                    schoolId: item.school2?.id,
                                    schoolName: item.team2Name,
                                    userId: item.teacher2.userId
                                  }
                                ];

                                setActiveBroadcastQueue({
                                  title: `بث الإشعار الموحد للمؤطرين: ${item.team1Name} ضد ${item.team2Name}`,
                                  items: teacherQueueItems,
                                  currentIndex: 0,
                                  matchSportId: item.sportId
                                });
                              }}
                              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-95 text-white py-1 px-2 rounded-lg text-[10px] font-black flex items-center justify-center gap-1 transition-all shadow-xs cursor-pointer"
                            >
                              <Zap className="w-2.5 h-2.5 fill-white shrink-0" />
                              <span>بث للمؤطرين معاً ⚡</span>
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-medium py-1">مؤطر معتمد للفريق الثاني</span>
                        )}
                      </div>
                    </div>

                    {/* 3. Referees */}
                    <div className="bg-white border border-amber-200/80 rounded-xl p-3 flex flex-col justify-between gap-2 shadow-2xs">
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[10px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                            طاقم التحكيم ({item.assignedReferees.length})
                          </span>
                        </div>
                        {item.assignedReferees.length > 0 ? (
                          <div className="space-y-1.5">
                            {item.assignedReferees.map((ref, idx) => (
                              <div key={idx} className="flex items-center justify-between text-[11px] bg-white/80 p-1 rounded border border-amber-100">
                                <span className="font-bold text-slate-800 truncate">{ref.name}</span>
                                <span className="text-[9px] font-mono text-slate-500">
                                  {ref.phone ? (
                                    <span className="text-emerald-700 font-bold">{ref.phone}</span>
                                  ) : (
                                    <span className="text-amber-600">غير مسجل</span>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">لم يتم تعيين حكام بعد</p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-amber-200/50 flex flex-col gap-1.5">
                        {item.assignedReferees.length > 0 ? (
                          canSendNotifications ? (
                            <div className="space-y-1.5">
                              {/* Send to each individual referee */}
                              {item.assignedReferees.map((ref, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    if (!ref.phone) {
                                      toast.error(`رقم هاتف الحكم ${ref.name} غير مسجل`);
                                      return;
                                    }
                                    openWhatsApp(ref.phone, unifiedMsg);
                                    setDispatchedIds((prev) => new Set(prev).add(`ref-${m.id}-${idx}`));
                                  }}
                                  className="w-full bg-amber-600 hover:bg-amber-700 active:scale-95 text-white py-1.5 px-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all shadow-xs cursor-pointer truncate"
                                >
                                  <Send className="w-2.5 h-2.5 shrink-0" />
                                  <span className="truncate">توجيه للحكم {idx + 1}: {ref.name.split(' ')[0]}</span>
                                </button>
                              ))}

                              {/* Multi-referee Broadcast button */}
                              {item.assignedReferees.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const refQueueItems = item.assignedReferees.map((ref, idx) => ({
                                      id: `ref-${m.id}-${idx}`,
                                      recipientName: ref.name,
                                      roleLabel: ref.role || `حكم ${idx + 1}`,
                                      phone: ref.phone || '',
                                      text: unifiedMsg,
                                      roleType: 'referee' as const,
                                      refereeId: ref.id
                                    }));

                                    setActiveBroadcastQueue({
                                      title: `إرسال الإشعار الموحد لطاقم التحكيم: ${item.team1Name} ضد ${item.team2Name}`,
                                      items: refQueueItems,
                                      currentIndex: 0,
                                      matchSportId: item.sportId
                                    });
                                  }}
                                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 text-slate-950 py-1.5 px-2 rounded-lg text-[10px] font-black flex items-center justify-center gap-1 transition-all shadow-xs cursor-pointer truncate"
                                >
                                  <Zap className="w-2.5 h-2.5 shrink-0 fill-slate-950" />
                                  <span className="truncate">بث لطاقم التحكيم معاً (متتالي) ⚡</span>
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-medium py-1">طاقم التحكيم الرسمي</span>
                          )
                        ) : null}
                      </div>
                    </div>

                    {/* 4. Principals */}
                    <div className="bg-white border border-blue-200/80 rounded-xl p-3 flex flex-col justify-between gap-2 shadow-2xs">
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[10px] font-black bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                            مدراء المؤسستين
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] bg-white/80 p-1 rounded border border-blue-100">
                            <span className="font-bold text-slate-800 truncate" title={item.team1Name}>
                              م.1: {item.team1Name.split(' ')[0]}
                            </span>
                            <span className="text-[9px] font-mono">
                              {item.school1?.principalPhone || item.school1?.phone ? (
                                <span className="text-emerald-700 font-bold">{item.school1?.principalPhone || item.school1?.phone}</span>
                              ) : (
                                <span className="text-amber-600">غير مسجل</span>
                              )}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] bg-white/80 p-1 rounded border border-blue-100">
                            <span className="font-bold text-slate-800 truncate" title={item.team2Name}>
                              م.2: {item.team2Name.split(' ')[0]}
                            </span>
                            <span className="text-[9px] font-mono">
                              {item.school2?.principalPhone || item.school2?.phone ? (
                                <span className="text-emerald-700 font-bold">{item.school2?.principalPhone || item.school2?.phone}</span>
                              ) : (
                                <span className="text-amber-600">غير مسجل</span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-blue-200/50 flex flex-col gap-1.5">
                        {canSendNotifications ? (
                          <button
                            type="button"
                            onClick={() => {
                              const pPhone = item.school1?.principalPhone || item.school1?.phone;
                              if (!pPhone) {
                                toast.error(`رقم هاتف مدير ${item.team1Name} غير مسجل`);
                                return;
                              }
                              openWhatsApp(pPhone, unifiedMsg);
                            }}
                            className="w-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white py-1.5 px-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all shadow-xs cursor-pointer truncate"
                          >
                            <Send className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">توجيه لمدير م.1</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-medium py-1">إدارات المؤسسات المعنية</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      </div> {/* End of Scrollable Body Container */}

      {/* ========================================================================= */}
      {/* MODAL 1: UNIFIED SINGLE-BUTTON MATCH BROADCAST MODAL                       */}
      {/* ========================================================================= */}
      {selectedMatchForBroadcast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150" dir="rtl">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh]">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-800 to-teal-900 p-4 md:p-5 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Zap className="w-6 h-6 text-amber-300 fill-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-emerald-400 text-slate-950 px-2 py-0.5 rounded-full font-black">
                      إشعار موحد بنقرة واحدة ⚡
                    </span>
                    <span className="text-xs text-emerald-200">{selectedMatchForBroadcast.sportInfo.name}</span>
                  </div>
                  <h3 className="text-base font-bold text-white mt-0.5">
                    {selectedMatchForBroadcast.team1Name} ⚡ {selectedMatchForBroadcast.team2Name}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMatchForBroadcast(null)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 md:p-6 overflow-y-auto space-y-4">
              {/* Match Key Details */}
              <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="flex items-center gap-1 font-bold text-slate-700">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{selectedMatchForBroadcast.dateString}</span>
                </span>
                <span className="flex items-center gap-1 font-bold text-slate-700">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{selectedMatchForBroadcast.match.startTime || '10:00'}</span>
                </span>
                <span className="flex items-center gap-1 font-bold text-slate-700">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  <span>{selectedMatchForBroadcast.venue.name}</span>
                </span>
              </div>

              {/* Unified Message Box */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                    <span>نص الإشعار الموحد لجميع المعنيين:</span>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyText(
                        getUnifiedNotificationText(selectedMatchForBroadcast),
                        'modal-unified-msg',
                        'النص الموحد'
                      )
                    }
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedId === 'modal-unified-msg' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>نسخ النص الموحد</span>
                  </button>
                </div>
                <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs font-mono text-slate-800 leading-relaxed select-all">
                  {getUnifiedNotificationText(selectedMatchForBroadcast)}
                </div>
              </div>

              {/* Stakeholders List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700">
                    لائحة المعنيين بالإشعار ({selectedMatchForBroadcast.stakeholders.length} أطراف):
                  </h4>
                  <span className="text-[10px] text-slate-500">
                    يمكنك تعديل أي رقم غير مسجل مباشرة من هنا ✏️
                  </span>
                </div>

                <div className="space-y-2">
                  {selectedMatchForBroadcast.stakeholders.map((stk: MatchStakeholder) => {
                    const isDispatched = dispatchedIds.has(stk.id);

                    return (
                      <div
                        key={stk.id}
                        className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all ${
                          isDispatched
                            ? 'bg-emerald-50/60 border-emerald-300'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${stk.roleBadgeColor}`}>
                            {stk.roleLabel}
                          </span>
                          <div>
                            <p className="text-xs font-bold text-slate-800">{stk.name}</p>
                            <p className="text-[10px] font-mono text-slate-500 flex items-center gap-1 mt-0.5">
                              <Phone className="w-2.5 h-2.5 text-emerald-600" />
                              {stk.phone ? (
                                <span className="font-bold text-emerald-700">{stk.phone}</span>
                              ) : (
                                <span className="text-amber-600 italic">رقم الهاتف غير مسجل بعد</span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          {/* Quick Edit Phone Button */}
                          <button
                            type="button"
                            onClick={() =>
                              setEditingContact({
                                stakeholder: stk,
                                phoneInput: stk.phone || ''
                              })
                            }
                            className="p-1.5 text-slate-500 hover:text-blue-700 bg-slate-100 hover:bg-blue-50 rounded-lg text-xs transition-colors cursor-pointer"
                            title="تعديل أو إدخال رقم الهاتف"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Direct WhatsApp Button (Restricted to Authorized Roles) */}
                          {canSendNotifications ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (!stk.phone) {
                                  toast.error(`يرجى تسجيل رقم هاتف ${stk.name} أولاً عبر زر القلم`);
                                  return;
                                }
                                openWhatsApp(stk.phone, getUnifiedNotificationText(selectedMatchForBroadcast));
                                setDispatchedIds((prev) => new Set(prev).add(stk.id));
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                                isDispatched
                                  ? 'bg-emerald-700 text-white'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              }`}
                            >
                              {isDispatched ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                              <span>{isDispatched ? 'تم التوجيه ✓' : 'إرسال مباشر 💬'}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (stk.phone) {
                                  navigator.clipboard.writeText(stk.phone);
                                  toast.success(`تم نسخ هاتف ${stk.name}`);
                                }
                              }}
                              disabled={!stk.phone}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                              title="نسخ رقم الهاتف"
                            >
                              <Copy className="w-3 h-3" />
                              <span>نسخ الرقم</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer: ONE-CLICK DISPATCH */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-500 font-medium text-center sm:text-right">
                {canSendNotifications
                  ? `${selectedMatchForBroadcast.stakeholders.filter((s: MatchStakeholder) => s.phone).length} أرقام جاهزة للبث المباشر`
                  : 'صلاحية إرسال الإشعارات مقتصرة على رؤساء اللجن التقنية والمسؤول الإقليمي والمركز'}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {canSendNotifications ? (
                  <button
                    type="button"
                    onClick={() => handleOneClickUnifiedBroadcast(selectedMatchForBroadcast)}
                    className="flex-1 sm:flex-none py-2.5 px-5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 active:scale-95 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                  >
                    <Zap className="w-4 h-4 fill-amber-300 text-amber-300" />
                    <span>إرسال الإشعار لجميع المعنيين بنقرة واحدة ⚡</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const text = getUnifiedNotificationText(selectedMatchForBroadcast);
                      navigator.clipboard.writeText(text);
                      toast.success('تم نسخ نص الإشعار الموحد للمباراة بنجاح!');
                    }}
                    className="flex-1 sm:flex-none py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                    <span>نسخ نص الإشعار الموحد</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedMatchForBroadcast(null)}
                  className="py-2.5 px-4 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: INLINE QUICK PHONE EDITOR MODAL                                  */}
      {/* ========================================================================= */}
      {editingContact && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-100" dir="rtl">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">تحيين رقم الهاتف</h4>
                  <p className="text-[10px] text-slate-500">{editingContact.stakeholder.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingContact(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رقم الهاتف (الواتساب) *
                </label>
                <input
                  type="tel"
                  autoFocus
                  placeholder="06XXXXXXXX أو 07XXXXXXXX"
                  value={editingContact.phoneInput}
                  onChange={(e) =>
                    setEditingContact({
                      ...editingContact,
                      phoneInput: e.target.value
                    })
                  }
                  className="w-full text-xs font-mono rounded-xl border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  سيتم تحيين هذا الرقم فوراً في ملف الأستاذ/المؤسسة ومركز الإشعارات.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingContact(null)}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveQuickPhone}
                disabled={isSavingPhone}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSavingPhone ? 'جاري الحفظ...' : 'حفظ وتحيين الرقم'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: GLOBAL ALL-MATCHES OF THE DAY BROADCAST MODAL                    */}
      {/* ========================================================================= */}
      {isGlobalBroadcastOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150" dir="rtl">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh]">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 p-4 md:p-5 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-xl">
                  <Zap className="w-6 h-6 text-amber-300 fill-amber-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    الإشعار الجماعي الموحد لكافة مباريات اليوم ({tabCounts.today} مقابلة)
                  </h3>
                  <p className="text-xs text-emerald-100/80 mt-0.5">
                    إرسال الإشعار الموحد بنقرة واحدة لكافة الفرق والحكام والمدراء في جدول اليوم
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGlobalBroadcastOpen(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-4 md:p-6 overflow-y-auto space-y-4">
              {filteredEnrichedMatches.filter((m) => m.dateString === todayStr).length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  لا توجد مباريات مبرمجة لليوم الحالي في ({authorizedSportsNames}).
                </div>
              ) : (
                filteredEnrichedMatches
                  .filter((m) => m.dateString === todayStr)
                  .map((item, idx) => {
                    const unifiedText = getUnifiedNotificationText(item);
                    return (
                      <div key={item.match.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black bg-emerald-600 text-white px-2 py-0.5 rounded">
                              مباراة #{idx + 1}
                            </span>
                            <span className="text-xs font-bold text-slate-800">
                              {item.team1Name} ضد {item.team2Name}
                            </span>
                            <span className="text-xs text-slate-500">({item.match.startTime || '10:00'} - {item.venue.name})</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleOneClickUnifiedBroadcast(item)}
                            className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shadow-xs"
                          >
                            <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                            <span>إرسال فوري لهذا اللقاء ⚡</span>
                          </button>
                        </div>

                        <div className="text-[11px] font-mono bg-white p-2 rounded border border-slate-200 text-slate-700">
                          {unifiedText}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                          <div className="bg-white p-2 rounded border border-slate-200">
                            <span className="text-slate-400 block">مؤطر 1:</span>
                            <span className="font-bold text-slate-800 truncate block">{item.teacher1.fullName}</span>
                            <span className="text-emerald-700 font-mono block">{item.teacher1.phone || 'غير مسجل'}</span>
                          </div>
                          <div className="bg-white p-2 rounded border border-slate-200">
                            <span className="text-slate-400 block">مؤطر 2:</span>
                            <span className="font-bold text-slate-800 truncate block">{item.teacher2.fullName}</span>
                            <span className="text-emerald-700 font-mono block">{item.teacher2.phone || 'غير مسجل'}</span>
                          </div>
                          <div className="bg-white p-2 rounded border border-slate-200">
                            <span className="text-slate-400 block">الحكم:</span>
                            <span className="font-bold text-slate-800 truncate block">
                              {item.assignedReferees[0]?.name || 'غير محدد'}
                            </span>
                            <span className="text-emerald-700 font-mono block">
                              {item.assignedReferees[0]?.phone || 'غير مسجل'}
                            </span>
                          </div>
                          <div className="bg-white p-2 rounded border border-slate-200">
                            <span className="text-slate-400 block">مدراء المؤسستين:</span>
                            <span className="font-bold text-slate-800 truncate block">
                              {item.school1?.phone ? 'م.1 مسجل' : 'م.1 غير مسجل'} | {item.school2?.phone ? 'م.2 مسجل' : 'م.2 غير مسجل'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2">
              <span className="text-xs text-slate-500 font-medium">
                مباريات اليوم المتاحة: {tabCounts.today} مقابلة
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOneClickGlobalDailyBroadcast}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95"
                >
                  <Zap className="w-4 h-4 fill-slate-950" />
                  <span>إرسال الإشعار لجميع مباريات اليوم بنقرة واحدة 🚀</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsGlobalBroadcastOpen(false);
                    setIsMainPanelOpen(false);
                  }}
                  className="py-2 px-4 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  إغلاق نافذة الإشعارات
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step-by-Step Consecutive Broadcast Assistant Modal Overlay */}
      {activeBroadcastQueue && (
        <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 select-none animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-4 text-white">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black flex items-center gap-1.5">
                  <span>⚡ مساعد البث المتتالي للواتساب</span>
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    setActiveBroadcastQueue(null);
                    toast.error('تم إلغاء مساعد البث المتتابع');
                  }}
                  className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                  title="إلغاء الإرسال"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              <p className="text-[11px] text-emerald-100 font-bold mt-1.5 line-clamp-1">
                {activeBroadcastQueue.title}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="bg-slate-100 h-1.5 w-full relative">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{
                  width: `${(activeBroadcastQueue.currentIndex / activeBroadcastQueue.items.length) * 100}%`
                }}
              />
            </div>

            {/* Content Area */}
            {activeBroadcastQueue.currentIndex < activeBroadcastQueue.items.length ? (() => {
              const currentItem = activeBroadcastQueue.items[activeBroadcastQueue.currentIndex];
              const isPhoneMissing = !currentItem.phone || currentItem.phone.trim().length < 8;
              return (
                <div className="p-5 flex-1 overflow-y-auto space-y-4 text-right">
                  {/* Status Indicator */}
                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                    <span className="text-xs text-slate-500 font-bold">الطرف الحالي في الطابور:</span>
                    <span className="text-xs bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-0.5 rounded-full font-black">
                      {activeBroadcastQueue.currentIndex + 1} / {activeBroadcastQueue.items.length}
                    </span>
                  </div>

                  {/* Recipient Card */}
                  <div className="bg-emerald-50/40 border border-emerald-200/80 rounded-2xl p-4 space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-slate-400 font-bold">الاسم المعني:</p>
                        <h4 className="text-sm font-black text-emerald-950 mt-0.5">{currentItem.recipientName}</h4>
                      </div>
                      <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-3xs">
                        {currentItem.roleLabel}
                      </span>
                    </div>

                    {isPhoneMissing ? (
                      <div className="pt-2.5 border-t border-amber-200 space-y-2">
                        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-2.5 rounded-xl text-xs flex items-start gap-2">
                          <span className="text-sm">⚠️</span>
                          <span className="font-bold">رقم الهاتف غير مسجل! يرجى إدخال الهاتف للمتابعة:</span>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="tel"
                            placeholder="مثال: 0661234567"
                            value={inlinePhoneInput}
                            onChange={(e) => setInlinePhoneInput(e.target.value)}
                            className="flex-1 px-3 py-2 border border-amber-300 rounded-xl text-xs font-bold text-center font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                          />
                          <button
                            type="button"
                            onClick={handleSaveInlinePhone}
                            className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black transition-colors shrink-0"
                          >
                            حفظ الرقم 💾
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between pt-2.5 border-t border-emerald-100">
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-xs font-black text-slate-800 font-mono">{currentItem.phone}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveBroadcastQueue((prev) => {
                              if (!prev) return null;
                              const updatedItems = [...prev.items];
                              updatedItems[prev.currentIndex] = {
                                ...updatedItems[prev.currentIndex],
                                phone: '' // trigger inline edit
                              };
                              return { ...prev, items: updatedItems };
                            });
                          }}
                          className="text-[10px] text-blue-600 hover:text-blue-800 underline font-bold"
                        >
                          تعديل الرقم ✏️
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Message Bubble Preview */}
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-500 font-black">معاينة نص الرسالة للواتساب:</p>
                    <div className="bg-slate-100 border border-slate-200/80 rounded-2xl p-3.5 text-[11px] text-slate-700 font-bold leading-relaxed whitespace-pre-wrap max-h-36 overflow-y-auto">
                      {currentItem.text}
                    </div>
                  </div>

                  {/* Complete Recipient Queue List (All Stakeholders Breakdown) */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <p className="text-[10px] text-slate-500 font-black">تفاصيل طابور الأطراف المعنية بالإرسال:</p>
                    <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto">
                      {activeBroadcastQueue.items.map((item, idx) => {
                        const isCurrent = idx === activeBroadcastQueue.currentIndex;
                        const isSent = idx < activeBroadcastQueue.currentIndex;
                        const hasNoPhone = !item.phone || item.phone.trim().length < 8;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setActiveBroadcastQueue((prev) => prev ? { ...prev, currentIndex: idx } : null);
                            }}
                            className={`p-2 rounded-xl border text-right flex items-center justify-between gap-2 transition-all cursor-pointer ${
                              isCurrent
                                ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-200 shadow-xs'
                                : isSent
                                ? 'bg-slate-50/50 border-slate-200 opacity-60'
                                : 'bg-white border-slate-150 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <span className="text-[10px] font-black w-4 text-slate-400 font-mono">
                                #{idx + 1}
                              </span>
                              <div className="truncate">
                                <p className="text-[11px] font-black text-slate-800 leading-tight">
                                  {item.recipientName}
                                </p>
                                <p className="text-[9px] text-slate-400 mt-0.5 font-bold truncate">
                                  {item.roleLabel}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {isSent ? (
                                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[9px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                  <span>✓ تم التوجيه</span>
                                </span>
                              ) : isCurrent ? (
                                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                                  <span>جاري الإرسال...</span>
                                </span>
                              ) : hasNoPhone ? (
                                <span className="bg-red-50 text-red-700 border border-red-200 text-[9px] font-black px-1.5 py-0.5 rounded-full">
                                  <span>⚠️ هاتف ناقص</span>
                                </span>
                              ) : (
                                <span className="bg-slate-100 text-slate-700 border border-slate-300 text-[9px] font-black px-1.5 py-0.5 rounded-full">
                                  <span>جاهز ⏳</span>
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })() : (
              <div className="p-8 text-center space-y-3 flex-1 flex flex-col items-center justify-center">
                <span className="text-4xl animate-bounce">🎉</span>
                <h4 className="text-sm font-black text-slate-900">تم الانتهاء بنجاح!</h4>
                <p className="text-xs text-slate-500 max-w-xs leading-relaxed font-bold">
                  لقد قمت بإرسال الإشعار الموحد لجميع الأطراف المعنية بنجاح تام وبأكثر الطرق أماناً واعتمادية.
                </p>
              </div>
            )}

            {/* Actions Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-2 justify-end">
              {activeBroadcastQueue.currentIndex < activeBroadcastQueue.items.length ? (() => {
                const currentItem = activeBroadcastQueue.items[activeBroadcastQueue.currentIndex];
                const isPhoneMissing = !currentItem.phone || currentItem.phone.trim().length < 8;

                return (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setDispatchedIds((prev) => {
                          const next = new Set(prev);
                          next.add(currentItem.id);
                          return next;
                        });
                        setActiveBroadcastQueue((prev) => prev ? { ...prev, currentIndex: prev.currentIndex + 1 } : null);
                        toast.success(`تم تخطي ${currentItem.recipientName}`);
                      }}
                      className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      تخطي الطرف ⏭️
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (isPhoneMissing) {
                          toast.error('يرجى حفظ رقم الهاتف أولاً للمتابعة');
                          return;
                        }

                        // 1. Mark as dispatched
                        setDispatchedIds((prev) => {
                          const next = new Set(prev);
                          next.add(currentItem.id);
                          return next;
                        });

                        // 2. Open WhatsApp for this number
                        openWhatsApp(currentItem.phone, currentItem.text);

                        // 3. Increment index
                        setActiveBroadcastQueue((prev) => {
                          if (!prev) return null;
                          const nextIndex = prev.currentIndex + 1;
                          if (nextIndex >= prev.items.length) {
                            setTimeout(() => {
                              toast.success('🎉 تم بث الإشعارات لجميع المعنيين بالكامل بنجاح!');
                              setActiveBroadcastQueue(null);
                            }, 500);
                          }
                          return { ...prev, currentIndex: nextIndex };
                        });
                      }}
                      disabled={isPhoneMissing}
                      className={`flex-1 py-2.5 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all cursor-pointer ${
                        isPhoneMissing
                          ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      <Send className="w-4 h-4" />
                      <span>فتح محادثة وإرسال 💬</span>
                    </button>
                  </>
                );
              })() : (
                <button
                  type="button"
                  onClick={() => {
                    setActiveBroadcastQueue(null);
                    toast.success('تمت العملية بنجاح');
                  }}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs cursor-pointer text-center shadow-xs"
                >
                  إغلاق المساعد ✅
                </button>
              )}
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};
