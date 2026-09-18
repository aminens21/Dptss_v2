import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { DataService } from '../lib/dataService';
import { Directorate } from '../types';
import { Building2, KeyRound, ShieldCheck, Check, AlertCircle, ArrowLeft, MapPin, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

export const DirectoratePromptModal: React.FC = () => {
  const { isDirectoratePromptOpen, setIsDirectoratePromptOpen, userProfile, assignUserDirectorate } = useAuth();
  const [directorates, setDirectorates] = useState<Directorate[]>([]);
  const [selectedDirectorateId, setSelectedDirectorateId] = useState<string>('taourirt');
  const [accessCode, setAccessCode] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (isDirectoratePromptOpen) {
      DataService.getDirectorates().then(dirs => {
        setDirectorates(dirs);
        if (dirs.length > 0 && !selectedDirectorateId) {
          setSelectedDirectorateId(dirs[0].id);
        }
      });
    }
  }, [isDirectoratePromptOpen]);

  if (!isDirectoratePromptOpen) return null;

  const handleVerifyAndJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!selectedDirectorateId) {
      setErrorMsg('يرجى اختيار المديرية الإقليمية التابع لها');
      return;
    }

    if (!accessCode.trim()) {
      setErrorMsg('يرجى إدخال القن السري للمديرية');
      return;
    }

    setIsVerifying(true);
    try {
      const isValid = await DataService.verifyDirectorateCode(selectedDirectorateId, accessCode);
      if (!isValid) {
        setErrorMsg('القن السري للمديرية غير صحيح. يرجى مراجعة المنسق الإقليمي أو المسير المركزي.');
        setIsVerifying(false);
        return;
      }

      const targetDir = directorates.find(d => d.id === selectedDirectorateId);
      const dirName = targetDir?.name || 'المديرية الإقليمية';

      await assignUserDirectorate(selectedDirectorateId, dirName);
      toast.success(`تم ربط حسابك بنجاح بـ ${dirName}`);
      setIsDirectoratePromptOpen(false);
    } catch (err) {
      console.error("Verification error:", err);
      setErrorMsg('حدث خطأ أثناء التحقق من القن السري');
    } finally {
      setIsVerifying(false);
    }
  };

  const selectedDirObj = directorates.find(d => d.id === selectedDirectorateId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-6 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-10 -mt-10 w-36 h-36 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center mx-auto mb-3 backdrop-blur-md shadow-inner">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-black mb-1">تحديد المديرية الإقليمية</h2>
          <p className="text-emerald-100 text-xs font-medium max-w-xs mx-auto">
            لعزل بيانات الأنشطة والبطولات والمؤسسات، يرجى اختيار مديريتك الإقليمية وتأكيد القن السري الخاص بها.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleVerifyAndJoin} className="p-6 space-y-5">
          
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-xs font-bold text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* User info badge */}
          {userProfile && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-black">
                  {userProfile.fullName?.[0] || 'U'}
                </div>
                <div>
                  <div className="font-bold text-slate-800">{userProfile.fullName}</div>
                  <div className="text-[10px] text-slate-500">{userProfile.email}</div>
                </div>
              </div>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                {userProfile.role === 'TEACHER' ? 'أستاذ تربية بدنية' : userProfile.role}
              </span>
            </div>
          )}

          {/* Select Directorate */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              1. اختر المديرية الإقليمية التابع لها:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border border-slate-200 rounded-2xl bg-slate-50/50">
              {directorates.map((dir) => {
                const isSelected = selectedDirectorateId === dir.id;
                return (
                  <button
                    key={dir.id}
                    type="button"
                    onClick={() => {
                      setSelectedDirectorateId(dir.id);
                      setErrorMsg('');
                    }}
                    className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/20 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-100/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs">{dir.shortName || dir.name}</span>
                      {isSelected && <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                    </div>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {dir.region}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Enter Directorate PIN */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                2. القن السري للمديرية:
              </label>
              <span className="text-[10px] text-slate-500">
                {selectedDirObj ? `خاص بـ ${selectedDirObj.shortName}` : ''}
              </span>
            </div>
            <input
              type="password"
              value={accessCode}
              onChange={(e) => {
                setAccessCode(e.target.value);
                setErrorMsg('');
              }}
              placeholder="أدخل القن السري المخصص لمديريتك"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-sm font-mono tracking-widest text-center focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-bold"
              required
            />
            <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
              * يتم تزويد الأساتذة ومنسقي المؤسسات بالقن السري من طرف المسير المركزي للمديرية لمنع اختلاط المعطيات بين الأقاليم.
            </p>
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={isVerifying}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isVerifying ? (
                <span>جاري التحقق...</span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>تأكيد والولوج لبيانات المديرية</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
