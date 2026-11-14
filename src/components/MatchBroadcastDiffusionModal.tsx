import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Send,
  Users,
  Check,
  Copy,
  Download,
  Phone,
  Calendar,
  Clock,
  MapPin,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Sparkles,
  CheckSquare,
  Square
} from 'lucide-react';
import toast from 'react-hot-toast';
import { DataService, SPORTS_MAP, GENDER_MAP } from '../lib/dataService';
import {
  MatchDiffusionStakeholder,
  buildMatchDiffusionStakeholders,
  buildMatchResultApprovalStakeholders,
  generateUnifiedMatchDiffusionMessage,
  generateApprovedResultDiffusionMessage,
  generateDiffusionVCardContent,
  getWhatsAppUrl,
  sanitizePhoneNumber
} from '../lib/whatsappService';
import { School, Referee, User, Student } from '../types';

export interface MatchBroadcastDiffusionTarget {
  mode?: 'schedule' | 'result';
  matchId?: string;
  sportId: string;
  sportName?: string;
  ageCategory?: string;
  gender?: string;
  stageName?: string;
  team1Id?: string;
  team2Id?: string;
  team1Name: string;
  team2Name: string;
  hostSchoolId?: string;
  venueId?: string;
  venueName: string;
  dateStr: string;
  timeStr: string;
  referees?: string[];
  notes?: string;
  score1?: number;
  score2?: number;
  penalty1?: number;
  penalty2?: number;
  scorers?: string;
  approvedByName?: string;
}

interface MatchBroadcastDiffusionModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: MatchBroadcastDiffusionTarget | null;
  schools?: School[];
  refereesList?: Referee[];
  teachersList?: User[];
  studentsList?: Student[];
}

export const MatchBroadcastDiffusionModal: React.FC<MatchBroadcastDiffusionModalProps> = ({
  isOpen,
  onClose,
  target,
  schools: propSchools,
  refereesList: propReferees,
  teachersList: propTeachers,
  studentsList: propStudents
}) => {
  const [loadedSchools, setLoadedSchools] = useState<School[]>([]);
  const [loadedReferees, setLoadedReferees] = useState<Referee[]>([]);
  const [loadedTeachers, setLoadedTeachers] = useState<User[]>([]);
  const [loadedStudents, setLoadedStudents] = useState<Student[]>([]);

  const [phoneOverrides, setPhoneOverrides] = useState<Record<string, string>>({});
  const [editingStakeholderId, setEditingStakeholderId] = useState<string | null>(null);
  const [phoneDraft, setPhoneDraft] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [customMessage, setCustomMessage] = useState('');
  const [showIndividualFallback, setShowIndividualFallback] = useState(false);
  const [copiedPhones, setCopiedPhones] = useState(false);

  // Lazy-load directory lists if caller didn't pass all of them
  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    const loadMissing = async () => {
      try {
        const [schs, refs, tchs, stds] = await Promise.all([
          propSchools && propSchools.length > 0 ? Promise.resolve(propSchools) : DataService.getSchools(),
          propReferees && propReferees.length > 0 ? Promise.resolve(propReferees) : DataService.getReferees(),
          propTeachers && propTeachers.length > 0 ? Promise.resolve(propTeachers) : DataService.getTeachers(),
          propStudents && propStudents.length > 0 ? Promise.resolve(propStudents) : DataService.getStudents()
        ]);
        if (!mounted) return;
        setLoadedSchools(schs);
        setLoadedReferees(refs);
        setLoadedTeachers(tchs);
        setLoadedStudents(stds);
      } catch (e) {
        console.warn('Error loading contacts for MatchBroadcastDiffusionModal:', e);
      }
    };
    loadMissing();
    return () => {
      mounted = false;
    };
  }, [isOpen, propSchools, propReferees, propTeachers, propStudents]);

  const effectiveSchools = propSchools && propSchools.length > 0 ? propSchools : loadedSchools;
  const effectiveReferees = propReferees && propReferees.length > 0 ? propReferees : loadedReferees;
  const effectiveTeachers = propTeachers && propTeachers.length > 0 ? propTeachers : loadedTeachers;
  const effectiveStudents = propStudents && propStudents.length > 0 ? propStudents : loadedStudents;

  const isResultMode = target?.mode === 'result';

  const stakeholders = useMemo<MatchDiffusionStakeholder[]>(() => {
    if (!target) return [];
    const base = isResultMode
      ? buildMatchResultApprovalStakeholders({
          matchId: target.matchId,
          sportId: target.sportId,
          team1Id: target.team1Id,
          team2Id: target.team2Id,
          team1Name: target.team1Name,
          team2Name: target.team2Name,
          schools: effectiveSchools,
          teachersList: effectiveTeachers,
          studentsList: effectiveStudents
        })
      : buildMatchDiffusionStakeholders({
          matchId: target.matchId,
          sportId: target.sportId,
          team1Id: target.team1Id,
          team2Id: target.team2Id,
          team1Name: target.team1Name,
          team2Name: target.team2Name,
          hostSchoolId: target.hostSchoolId,
          venueId: target.venueId,
          venueName: target.venueName,
          referees: target.referees,
          schools: effectiveSchools,
          refereesList: effectiveReferees,
          teachersList: effectiveTeachers,
          studentsList: effectiveStudents
        });
    return base.map(item => ({
      ...item,
      phone: phoneOverrides[item.id] !== undefined ? phoneOverrides[item.id] : item.phone
    }));
  }, [target, isResultMode, effectiveSchools, effectiveReferees, effectiveTeachers, effectiveStudents, phoneOverrides]);

  useEffect(() => {
    if (!isOpen || !target) return;
    const sportName = target.sportName || SPORTS_MAP[target.sportId]?.name || 'الرياضة المدرسية';
    const genderAr = target.gender ? (GENDER_MAP[target.gender]?.name || target.gender) : undefined;
    const msg =
      target.mode === 'result'
        ? generateApprovedResultDiffusionMessage({
            sportName,
            ageCategory: target.ageCategory,
            gender: genderAr,
            stageName: target.stageName,
            team1SchoolName: target.team1Name,
            team2SchoolName: target.team2Name,
            dateStr: target.dateStr,
            timeStr: target.timeStr,
            venueName: target.venueName,
            notes: target.notes,
            score1: target.score1,
            score2: target.score2,
            penalty1: target.penalty1,
            penalty2: target.penalty2,
            scorers: target.scorers,
            approvedByName: target.approvedByName
          })
        : generateUnifiedMatchDiffusionMessage({
            sportName,
            ageCategory: target.ageCategory,
            gender: genderAr,
            stageName: target.stageName,
            team1SchoolName: target.team1Name,
            team2SchoolName: target.team2Name,
            dateStr: target.dateStr,
            timeStr: target.timeStr,
            venueName: target.venueName,
            notes: target.notes
          });
    setCustomMessage(msg);
    setShowIndividualFallback(false);
    setEditingStakeholderId(null);
  }, [isOpen, target]);

  useEffect(() => {
    setSelectedIds(stakeholders.map(s => s.id));
  }, [stakeholders.length, target?.mode, target?.matchId, target?.team1Name, target?.team2Name]);

  if (!isOpen || !target) return null;

  const selectedStakeholders = stakeholders.filter(s => selectedIds.includes(s.id));
  const validPhoneStakeholders = selectedStakeholders.filter(s => sanitizePhoneNumber(s.phone).length >= 9);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const handleSavePhone = async (item: MatchDiffusionStakeholder) => {
    const clean = phoneDraft.trim();
    if (!clean || clean.length < 8) {
      toast.error('يرجى إدخال رقم هاتف صحيح');
      return;
    }
    try {
      const contactType =
        item.roleCategory === 'referee'
          ? 'referee'
          : item.roleCategory === 'coach' ||
            item.roleCategory === 'school1_teacher' ||
            item.roleCategory === 'school2_teacher'
          ? 'teacher'
          : 'principal';

      await DataService.updateContactPhone({
        type: contactType,
        id: item.userId || item.refereeId,
        schoolId: item.schoolId,
        schoolName: item.schoolName,
        name: item.name,
        phone: clean
      });
      setPhoneOverrides(prev => ({ ...prev, [item.id]: clean }));
      setEditingStakeholderId(null);
      setPhoneDraft('');
      toast.success(`تم حفظ رقم هاتف ${item.name}`);
    } catch {
      toast.error('تعذر حفظ رقم الهاتف');
    }
  };

  const handleCopyDiffusionPhones = async () => {
    const formattedList = validPhoneStakeholders
      .map(s => `+${sanitizePhoneNumber(s.phone)}`)
      .join(', ');
    if (!formattedList) {
      toast.error('لا توجد أرقام هواتف مسجلة في اللائحة لنسخها');
      return;
    }
    try {
      await navigator.clipboard.writeText(formattedList);
      setCopiedPhones(true);
      setTimeout(() => setCopiedPhones(false), 2500);
      toast.success(`تم نسخ لائحة أرقام المعنيين (${validPhoneStakeholders.length}) لخاصية Nouvelle diffusion`);
    } catch {
      toast.error('تعذر النسخ التلقائي');
    }
  };

  const handleDownloadVCard = () => {
    if (validPhoneStakeholders.length === 0) {
      toast.error('يرجى تسجيل رقم هاتف واحد على الأقل لتصدير لائحة المعنيين');
      return;
    }
    const label = isResultMode
      ? `نتيجة مباراة ${target.team1Name} ضد ${target.team2Name}`
      : `مباراة ${target.team1Name} ضد ${target.team2Name}`;
    const vcf = generateDiffusionVCardContent(validPhoneStakeholders, label);
    const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Nouvelle_diffusion_${target.team1Name}_${target.team2Name}.vcf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('تم تحميل بطاقة لائحة المعنيين (.vcf) جاهزة لـ Nouvelle diffusion');
  };

  const handleUnifiedNouvelleDiffusion = async () => {
    if (selectedStakeholders.length === 0) {
      toast.error('يرجى تحديد معني واحد على الأقل في لائحة البث');
      return;
    }

    // 1. Send instant in-app notification to all registered stakeholders
    try {
      const userIds = Array.from(new Set(selectedStakeholders.map(s => s.userId).filter(Boolean) as string[]));
      await DataService.addNotification({
        title: isResultMode
          ? `✅ النتيجة النهائية المصادق عليها: ${target.team1Name} (${target.score1 ?? 0}) - (${target.score2 ?? 0}) ${target.team2Name}`
          : `📢 إشعار ببرمجة مقابلة: ${target.team1Name} ضد ${target.team2Name}`,
        body: customMessage,
        sportId: target.sportId,
        role: 'ALL',
        ...(userIds.length > 0 ? { userIds } : {})
      });
    } catch (e) {
      console.warn('In-app notification error:', e);
    }

    // 2. Copy recipients phone numbers to clipboard to assist WhatsApp Nouvelle diffusion selection
    if (validPhoneStakeholders.length > 0) {
      try {
        const numbers = validPhoneStakeholders.map(s => `+${sanitizePhoneNumber(s.phone)}`).join(', ');
        await navigator.clipboard.writeText(numbers);
      } catch {
        // Ignore clipboard permission errors inside iframe
      }
    }

    // 3. Open WhatsApp multi-recipient / Nouvelle diffusion picker with the unified message pre-filled
    const waBroadcastUrl = `https://wa.me/?text=${encodeURIComponent(customMessage)}`;
    const link = document.createElement('a');
    link.href = waBroadcastUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(
      `تم تجهيز الرسالة الموحدة وإشعار المنصة! حدد لائحة البث (Nouvelle diffusion) أو المعنيين (${selectedStakeholders.length}) في واتساب للإرسال دفعة واحدة.`
    );
  };

  const roleBadgeClass = (cat: MatchDiffusionStakeholder['roleCategory']) => {
    switch (cat) {
      case 'referee':
        return 'bg-amber-50 text-amber-900 border-amber-300';
      case 'host_principal':
        return 'bg-emerald-50 text-emerald-900 border-emerald-300';
      case 'team_principal':
        return 'bg-blue-50 text-blue-900 border-blue-200';
      case 'coach':
        return 'bg-purple-50 text-purple-900 border-purple-200';
      case 'school1_teacher':
        return 'bg-teal-50 text-teal-900 border-teal-200';
      case 'school2_teacher':
        return 'bg-indigo-50 text-indigo-900 border-indigo-200';
    }
  };

  const modalNode = (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/75 backdrop-blur-xs"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`p-4 sm:p-5 text-white flex items-start justify-between gap-3 shrink-0 ${
            isResultMode
              ? 'bg-gradient-to-l from-blue-900 via-indigo-950 to-slate-900'
              : 'bg-gradient-to-l from-emerald-900 via-teal-900 to-slate-900'
          }`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-emerald-500/25 border border-emerald-400/40 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-400 text-slate-950">
                  Nouvelle diffusion
                </span>
                <span className="text-[10px] font-bold text-emerald-200">
                  {isResultMode
                    ? `إخبار المعنيين بالنتيجة المصادق عليها (${stakeholders.length})`
                    : `إشعار المعنيين ببرمجة المقابلة (${stakeholders.length})`}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-black text-white mt-1 leading-snug">
                {isResultMode
                  ? 'إخبار المؤطرين والمديرين وأساتذة المؤسستين بالنتيجة النهائية'
                  : 'إشعار المعنيين ببرمجة المقابلة بضغطة زر'}
              </h3>
              <p className="text-[11px] text-emerald-100/85 mt-0.5 truncate">
                {target.team1Name} ضد {target.team2Name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-3.5 sm:p-5 space-y-4 overflow-y-auto flex-1 bg-slate-50/70">
          {/* Match Core Info Strip */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3 space-y-2 shadow-3xs">
            <div className="flex items-center justify-between gap-2 text-xs font-black text-slate-900">
              <span className="truncate">{target.team1Name}</span>
              {isResultMode ? (
                <span className="px-3 py-0.5 rounded-lg bg-emerald-600 text-white font-mono text-xs font-black shrink-0 shadow-2xs">
                  {target.score1 ?? 0} : {target.score2 ?? 0}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] shrink-0">
                  ضد
                </span>
              )}
              <span className="truncate text-left">{target.team2Name}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-[11px] font-bold text-slate-600">
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                {target.dateStr}
              </span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                {target.timeStr}
              </span>
              <span className="inline-flex items-center gap-1 truncate">
                <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span className="truncate">{target.venueName}</span>
              </span>
            </div>
          </div>

          {/* Primary Hero Unified Diffusion Action */}
          <div className="bg-emerald-950 text-white rounded-2xl p-3.5 sm:p-4 space-y-3 shadow-md border border-emerald-800">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-emerald-200 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>إرسال جماعي عبر لائحة بث واتساب (Nouvelle diffusion)</span>
              </span>
              <span className="text-[10px] font-bold bg-white/10 px-2 py-0.5 rounded-md tabular-nums">
                {selectedStakeholders.length} محدد
              </span>
            </div>

            <button
              type="button"
              onClick={handleUnifiedNouvelleDiffusion}
              className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              <Send className="w-4 h-4 shrink-0" />
              <span>إخبار جميع المعنيين الآن (Nouvelle diffusion)</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopyDiffusionPhones}
                className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedPhones ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>نسخ أرقام اللائحة ({validPhoneStakeholders.length})</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadVCard}
                className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="حفظ جهات اتصال المعنيين بالمباراة لإنشاء Nouvelle diffusion في واتساب بسهولة"
              >
                <Download className="w-3.5 h-3.5" />
                <span>حفظ لائحة جهات الاتصال (.vcf)</span>
              </button>
            </div>
          </div>

          {/* Assembled Broadcast Recipients List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-700" />
                <span>لائحة المعنيين المشكّلة تلقائياً ({stakeholders.length}):</span>
              </h4>
              <button
                type="button"
                onClick={() =>
                  setSelectedIds(
                    selectedIds.length === stakeholders.length ? [] : stakeholders.map(s => s.id)
                  )
                }
                className="text-[10px] font-bold text-emerald-700 hover:underline cursor-pointer"
              >
                {selectedIds.length === stakeholders.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
              </button>
            </div>

            <div className="space-y-1.5">
              {stakeholders.map(item => {
                const isChecked = selectedIds.includes(item.id);
                const hasValidPhone = sanitizePhoneNumber(item.phone).length >= 9;
                return (
                  <div
                    key={item.id}
                    className={`p-2.5 rounded-xl border transition-all bg-white ${
                      isChecked ? 'border-emerald-300 shadow-3xs' : 'border-slate-200 opacity-65'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div
                        onClick={() => toggleSelect(item.id)}
                        className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-black text-slate-900 truncate">{item.name}</span>
                            <span
                              className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${roleBadgeClass(
                                item.roleCategory
                              )}`}
                            >
                              {item.roleLabel}
                            </span>
                          </div>
                          <p className="text-[10px] font-mono tabular-nums mt-0.5">
                            {hasValidPhone ? (
                              <span className="text-emerald-700 font-bold" dir="ltr">
                                📞 {item.phone}
                              </span>
                            ) : (
                              <span className="text-amber-600 font-sans">
                                بدون رقم مسجل — اضغط الأيقونة لإضافته
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingStakeholderId(editingStakeholderId === item.id ? null : item.id);
                            setPhoneDraft(item.phone || '');
                          }}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                          title="تسجيل أو تعديل رقم الهاتف"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </button>

                        {showIndividualFallback && (
                          <a
                            href={getWhatsAppUrl(item.phone, customMessage)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold inline-flex items-center gap-1"
                          >
                            <MessageCircle className="w-3 h-3" />
                            <span>فردي</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {editingStakeholderId === item.id && (
                      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100">
                        <input
                          type="tel"
                          dir="ltr"
                          value={phoneDraft}
                          onChange={e => setPhoneDraft(e.target.value)}
                          placeholder="06XXXXXXXX"
                          className="flex-1 px-2.5 py-1.5 text-xs font-mono font-bold tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-left"
                        />
                        <button
                          type="button"
                          onClick={() => handleSavePhone(item)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>حفظ</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Unified Broadcast Message Editor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-800">
                نص الإشعار الموحد (التاريخ، الساعة، المكان، والفريقان):
              </label>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(customMessage);
                    toast.success('تم نسخ نص الإشعار الموحد');
                  } catch {
                    toast.error('تعذر نسخ النص');
                  }
                }}
                className="text-[10px] font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>نسخ النص</span>
              </button>
            </div>
            <textarea
              rows={5}
              value={customMessage}
              onChange={e => setCustomMessage(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Optional Individual Fallback Toggle */}
          <button
            type="button"
            onClick={() => setShowIndividualFallback(prev => !prev)}
            className="w-full py-2 text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1 cursor-pointer"
          >
            <span>{showIndividualFallback ? 'إخفاء أزرار الإرسال الفردي' : 'إظهار خيار الإرسال الفردي عند الحاجة'}</span>
            {showIndividualFallback ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 bg-white border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-black transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
};
