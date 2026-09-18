import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { DataService, deduplicateById } from '../lib/dataService';
import { Match, Tournament, School, Venue, Referee, User } from '../types';
import {
  Trophy,
  CalendarDays,
  Users,
  CheckCircle2,
  Clock,
  MapPin,
  ArrowLeft,
  ChevronLeft,
  School as SchoolIcon,
  AlertCircle,
  BellRing,
  Activity,
  Plus,
  BarChart3,
  MessageSquare
} from 'lucide-react';
import { CreateTournamentModal } from '../components/CreateTournamentModal';
import { DailyWhatsAppNotificationCenter } from '../components/DailyWhatsAppNotificationCenter';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { AppLogo } from '../components/AppLogo';
import toast from 'react-hot-toast';

export const Dashboard: React.FC = () => {
  const { userProfile, openProfileModal } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    tournaments: 0,
    matches: 0,
    schools: 0,
    completedMatches: 0
  });
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [referees, setReferees] = useState<Referee[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [teacherMatches, setTeacherMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTournamentModalOpen, setIsTournamentModalOpen] = useState(false);

  const isCentralAdmin = userProfile?.role === 'CENTRAL_ADMIN';
  const isRegionalManager = (userProfile?.role as any) === 'REGIONAL_MANAGER';
  const isSportManager = userProfile?.role === 'SPORT_MANAGER';
  const isTechCommitteeHead = userProfile?.isTechCommitteeHead === true;
  const isTeacher = userProfile?.role === 'TEACHER';
  const isReferee = userProfile?.role === 'REFEREE';

  // Only Central Admin, Regional Manager, Sport Manager, and Technical Committee Heads can view the WhatsApp Notification Center.
  // Ordinary teachers and referees will not see this window at all; they receive notifications via the bell.
  const canAccessWhatsAppNotificationCenter =
    isCentralAdmin || isRegionalManager || isSportManager || isTechCommitteeHead;

  useEffect(() => {
    loadDashboardData();
    const handleDirChange = () => {
      loadDashboardData();
    };
    window.addEventListener('directorateChanged', handleDirChange);
    return () => {
      window.removeEventListener('directorateChanged', handleDirChange);
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      const activeDirId = DataService.getActiveDirectorateId();
      const [tList, mList, sList, vList, rList, uList] = await Promise.all([
        DataService.getTournaments(),
        DataService.getMatches(),
        DataService.getSchools(),
        DataService.getVenues(),
        DataService.getReferees(),
        DataService.getUsers()
      ]);

      const dirMatches = mList.filter(m => !activeDirId || activeDirId === 'all' || (m.directorateId || 'taourirt') === activeDirId || (!m.directorateId && activeDirId === 'taourirt'));
      const dirSchools = sList.filter(s => (s.directorateId || 'taourirt') === activeDirId);
      const dirVenues = vList.filter(v => (v.directorateId || 'taourirt') === activeDirId);
      const dirReferees = rList.filter(r => (r.directorateId || 'taourirt') === activeDirId);
      const dirTeachers = uList.filter(u => (u.directorateId || 'taourirt') === activeDirId);

      const completed = dirMatches.filter(m => m.status === 'Completed').length;

      const dirTournaments = tList.filter(t => (t.directorateId || 'taourirt') === activeDirId);

      setTournaments(dirTournaments);
      setMatches(dirMatches);
      setSchools(deduplicateById<School>(dirSchools));
      setVenues(dirVenues);
      setReferees(dirReferees);
      setTeachers(dirTeachers);

      setStats({
        tournaments: dirTournaments.length,
        matches: dirMatches.length,
        schools: dirSchools.length,
        completedMatches: completed
      });
      setRecentMatches(dirMatches.slice(0, 5));

      if (userProfile?.role === 'TEACHER') {
        const tMatches = mList.filter(m => 
          m.referee1Id === userProfile.id || 
          m.referee2Id === userProfile.id || 
          (m.referees && m.referees.some(r => 
            r === userProfile.id || 
            r === userProfile.fullName || 
            r.includes(userProfile.fullName) || 
            (userProfile.fullName && userProfile.fullName.includes(r))
          ))
        ).filter(m => m.status !== 'Completed')
         .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setTeacherMatches(tMatches);
      }

    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTournament = async (newTourns: Omit<Tournament, 'id'> | Omit<Tournament, 'id'>[]) => {
    try {
      const items = Array.isArray(newTourns) ? newTourns : [newTourns];
      for (const item of items) {
        await DataService.addTournament(item);
      }
      if (items.length > 1) {
        toast.success(`تم إنشاء وبرمجة ${items.length} بطولات بنجاح!`);
      } else {
        toast.success('تمت إضافة وبرمجة البطولة بنجاح!');
      }
      loadDashboardData();
    } catch (e) {
      toast.error('حدث خطأ أثناء إنشاء البطولة');
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 rounded-2xl p-4 sm:p-5 md:p-6 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-800 relative overflow-hidden">
        <div className="flex items-start gap-3.5 min-w-0">
          <AppLogo size={56} className="shrink-0 drop-shadow-md" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="bg-blue-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded uppercase">
                {isTeacher ? 'فضاء أستاذ التربية البدنية' : isSportManager ? 'فضاء مسؤول النشاط الرياضي' : 'لوحة الإدارة الإقليمية'}
              </span>
              <span className="text-slate-400 text-xs font-medium">| الفرع الإقليمي للرياضة المدرسية</span>
            </div>
            <h2 className="text-base sm:text-lg md:text-xl font-bold text-white">
              مرحباً بك، {userProfile?.fullName || (isTeacher ? 'الأستاذ' : isSportManager ? 'مسؤول النشاط' : 'المسير المركزي')} 👋
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
              {isTeacher
                ? 'متابعة فورية للمقابلات المبرمجة، ملاعب وقاعات التباري، وجداول النتائج الرسمية المحينة أولاً بأول.'
                : isSportManager
                ? 'برمجة وإدارة مباريات البطولة، إضافة وتعديل المؤسسات والفرق المشاركة، وإدارة مراكز التباري.'
                : 'متابعة فورية للأنشطة والبطولات الرياضية المدرسية، تعيين لجان التحكيم، وبرمجة الإقصائيات الإقليمية.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => navigate('/statistics')}
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>لوحة الإحصائيات</span>
          </button>

          {isCentralAdmin ? (
            <button
              onClick={() => setIsTournamentModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة بطولة جديدة</span>
            </button>
          ) : isSportManager ? (
            <button
              onClick={() => navigate('/matches')}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>برمجة مباراة جديدة</span>
            </button>
          ) : (
            <button
              onClick={() => navigate('/matches')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer shrink-0"
            >
              <CalendarDays className="h-4 w-4" />
              <span>استعراض جدول المقابلات</span>
            </button>
          )}
        </div>
      </div>

      {/* PWA Mobile App Installation Banner */}
      <PWAInstallButton variant="banner" />

      {/* Teacher Profile Incomplete Banner (Gentle Non-blocking notice) */}
      {isTeacher && (!userProfile?.workLocation || !userProfile?.leaseNumber) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-amber-950">بيانات الأستاذ(ة) والمؤسسة غير مكتملة</h4>
              <p className="text-[11px] text-amber-800 mt-0.5">
                يرجى استكمال مقر العمل ورقم التأجير لتسهيل التواصل والتعيين في لجان التحكيم.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openProfileModal}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-xs cursor-pointer shrink-0 text-center"
          >
            استكمال الملف الشخصي ✍️
          </button>
        </div>
      )}

      {/* High Density 4-Column Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div
          onClick={() => navigate('/tournaments')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all cursor-pointer"
        >
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">إجمالي البطولات</p>
          <div className="flex items-end justify-between">
            <h3 className="text-2xl font-bold text-slate-800 tracking-tight">
              {stats.tournaments}
            </h3>
            <span className="text-blue-600 text-[10px] font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
              عرض البطولات ←
            </span>
          </div>
        </div>

        {/* Card 2 */}
        <div
          onClick={() => navigate('/matches')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all cursor-pointer"
        >
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">المباريات المبرمجة</p>
          <div className="flex items-end justify-between">
            <h3 className="text-2xl font-bold text-slate-800 tracking-tight">
              {stats.matches}
            </h3>
            <span className="text-emerald-600 text-[10px] font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
              برنامج المباريات ←
            </span>
          </div>
        </div>

        {/* Card 3 */}
        <div
          onClick={() => navigate('/schools')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all cursor-pointer"
        >
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">المؤسسات المشاركة</p>
          <div className="flex items-end justify-between">
            <h3 className="text-2xl font-bold text-slate-800 tracking-tight">
              {stats.schools}
            </h3>
            <span className="text-slate-600 text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded">
              دليل المؤسسات
            </span>
          </div>
        </div>

        {/* Card 4 */}
        <div
          onClick={() => navigate('/statistics')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all cursor-pointer"
        >
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">المباريات المنجزة والإحصائيات</p>
          <div className="flex items-end justify-between">
            <h3 className="text-2xl font-bold text-slate-800 tracking-tight">
              {stats.completedMatches}
            </h3>
            <span className="text-amber-600 text-[10px] font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
              النتائج والترتيب 🏆
            </span>
          </div>
        </div>
      </div>

      {/* WhatsApp Daily Notification Center (Primary Section - Only for Authorized Supervisors & Tech Committee Heads) */}
      {canAccessWhatsAppNotificationCenter && (
        <DailyWhatsAppNotificationCenter
          matches={matches}
          schools={schools}
          tournaments={tournaments}
          venues={venues}
          referees={referees}
          teachers={teachers}
          onRefresh={loadDashboardData}
        />
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Matches Section */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Teacher Refereeing Matches */}
          {isTeacher && teacherMatches.length > 0 && (
            <div className="flex flex-col bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-blue-50/50">
                <h4 className="text-xs md:text-sm font-bold text-blue-800 flex items-center gap-2">
                  <span className="text-xl">哨</span>
                  <span>المباريات التي تم تعييني كحكم فيها</span>
                </h4>
              </div>
              <div className="flex-1 p-4 space-y-3">
                {teacherMatches.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => navigate('/matches')}
                    className="flex items-center gap-3 p-3 border border-blue-100 rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-all cursor-pointer bg-blue-50/20"
                  >
                    <div className="w-20 text-center border-l border-blue-100 pl-2">
                      <p className="text-[10px] font-bold text-slate-500 mb-0.5">{new Date(m.date).toLocaleDateString('ar-MA')}</p>
                      <p className="text-sm font-black text-blue-700">{m.startTime}</p>
                      <p className="text-[10px] text-blue-600/80 font-bold mt-0.5">
                        {m.status === 'Ongoing' ? 'جارية الآن' : 'في الانتظار'}
                      </p>
                    </div>
                    <div className="flex-1 flex flex-col px-2 gap-1.5">
                      <span className="font-bold text-sm text-slate-800">
                        {m.stage || 'مباراة'}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                        <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                        <span>يوم: {new Date(m.date).toLocaleDateString('ar-MA')}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h4 className="text-xs md:text-sm font-bold text-slate-700 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-blue-600" />
                <span>أحدث المباريات والبرمجة الإقليمية</span>
              </h4>
              <button
                onClick={() => navigate('/matches')}
                className="text-blue-600 text-xs font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>البرنامج الكامل</span>
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex-1 p-4 space-y-3">
              {recentMatches.map((m) => (
                <div
                  key={m.id}
                  onClick={() => navigate('/matches')}
                  className="flex items-center gap-3 p-3 border border-slate-100 rounded-lg hover:border-blue-200 hover:bg-blue-50/20 transition-all cursor-pointer"
                >
                  <div className="w-16 text-center border-l border-slate-100 pl-2">
                    <p className="text-xs font-bold text-blue-600">{m.startTime || '10:00'}</p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {m.status === 'Completed' ? 'انتهت' : m.status === 'Ongoing' ? 'مباشر' : 'مبرمجة'}
                    </p>
                  </div>
                  <div className="flex-1 flex items-center justify-between px-2">
                    <span className="font-bold text-xs text-slate-800">
                      {m.stage || 'مباراة إقليمية'}
                    </span>
                    <div className="font-black text-xs px-2.5 py-1 bg-slate-100 rounded-md border border-slate-200">
                      {m.status === 'Completed' ? `${m.score1 || 0} - ${m.score2 || 0}` : 'مقابلة مبرمجة'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Side Panel: Quick Actions & Alerts */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
            <h4 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <span>{userProfile?.role === 'TEACHER' ? 'روابط سريعة للأستاذ' : 'إجراءات سريعة للمسير'}</span>
            </h4>
            <div className="space-y-2">
              {isTeacher && (
                <button
                  onClick={openProfileModal}
                  className="w-full text-right p-2.5 bg-blue-50 hover:bg-blue-100/80 text-blue-800 rounded-lg text-xs font-bold flex items-center justify-between transition-colors cursor-pointer border border-blue-200/70"
                >
                  <span className="flex items-center gap-1.5">
                    <span>👤</span>
                    <span>تعديل بياناتي وصورتي وتخصصات التحكيم</span>
                  </span>
                  <span>←</span>
                </button>
              )}
              {isCentralAdmin && (
                <button
                  onClick={() => setIsTournamentModalOpen(true)}
                  className="w-full text-right p-2.5 bg-blue-50/60 hover:bg-blue-100/60 text-blue-700 rounded-lg text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>➕ برمجة بطولة إقليمية جديدة</span>
                  <span>←</span>
                </button>
              )}
              <button
                onClick={() => navigate('/statistics')}
                className="w-full text-right p-2.5 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-800 rounded-lg text-xs font-bold flex items-center justify-between transition-colors cursor-pointer border border-indigo-200/70"
              >
                <span>📊 إحصائيات وترتيب المؤسسات</span>
                <span>←</span>
              </button>
              <button
                onClick={() => navigate('/matches')}
                className="w-full text-right p-2.5 bg-emerald-50/60 hover:bg-emerald-100/60 text-emerald-800 rounded-lg text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
              >
                <span>📅 جدول المقابلات والنتائج</span>
                <span>←</span>
              </button>
              <button
                onClick={() => navigate('/tournaments')}
                className="w-full text-right p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
              >
                <span>🏆 البطولات الإقليمية المبرمجة</span>
                <span>←</span>
              </button>
              <button
                onClick={() => navigate('/schools')}
                className="w-full text-right p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
              >
                <span>🏫 المؤسسات والفرق المشاركة</span>
                <span>←</span>
              </button>
            </div>
          </div>

          {canAccessWhatsAppNotificationCenter && (
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 p-4 rounded-xl border border-emerald-100 text-slate-700 text-xs">
              <h5 className="font-bold text-emerald-900 mb-1 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                <span>تذكير الواتساب التلقائي</span>
              </h5>
              <p className="text-[11px] text-emerald-800/90 leading-relaxed">
                يمكنك بضغطة زر واحدة إرسال تفاصيل المباراة وموعد الحضور مباشرة إلى واتساب الحكام والمؤطرين ومدراء المؤسسات.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <CreateTournamentModal
        isOpen={isTournamentModalOpen}
        onClose={() => setIsTournamentModalOpen(false)}
        onCreated={handleCreateTournament}
      />
    </div>
  );
};

