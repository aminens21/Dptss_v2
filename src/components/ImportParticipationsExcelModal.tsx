import React, { useState, useRef, useMemo } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  Building2,
  Users,
  Trophy,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Search,
  SkipForward,
  HardDrive,
  UploadCloud
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  parseTeachersAndParticipationsWorkbook,
  executeAdditiveExcelImport,
  downloadParticipationsExcelTemplate,
  buildSummaryFromRows,
  ParsedExcelImportPreview,
  ImportExecutionProgress,
  ImportExecutionResult
} from '../lib/excelParticipationsImportService';

interface ImportParticipationsExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  directorateId?: string;
  directorateName?: string;
  activeSeason?: string;
  onImportComplete: () => Promise<void> | void;
}

export const ImportParticipationsExcelModal: React.FC<ImportParticipationsExcelModalProps> = ({
  isOpen,
  onClose,
  directorateId,
  directorateName = 'المديرية الإقليمية بتاوريرت',
  activeSeason = '2026/2027',
  onImportComplete
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [isParsing, setIsParsing] = useState(false);
  const [preview, setPreview] = useState<ParsedExcelImportPreview | null>(null);
  const [excludedRowIndices, setExcludedRowIndices] = useState<Set<number>>(new Set());
  const [showOnlyIssues, setShowOnlyIssues] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [autoProgramMissing, setAutoProgramMissing] = useState(true);

  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ImportExecutionProgress | null>(null);
  const [result, setResult] = useState<ImportExecutionResult | null>(null);

  const rowsWithIssuesCount = useMemo(() => {
    if (!preview) return 0;
    return preview.rows.filter(r => r.issues.length > 0).length;
  }, [preview]);

  const activeRows = useMemo(() => {
    if (!preview) return [];
    return preview.rows.filter(r => !excludedRowIndices.has(r.rowIndex));
  }, [preview, excludedRowIndices]);

  const activeSummary = useMemo(() => {
    return buildSummaryFromRows(activeRows);
  }, [activeRows]);

  const filteredPreviewRows = useMemo(() => {
    if (!preview) return [];
    const q = searchTerm.trim().toLowerCase();
    return preview.rows.filter(r => {
      if (showOnlyIssues && r.issues.length === 0) return false;
      if (!q) return true;
      return (
        r.fullName.toLowerCase().includes(q) ||
        r.schoolName.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.leaseNumber.toLowerCase().includes(q) ||
        r.participations.some(p => p.sportName.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)) ||
        r.issues.some(iss => iss.message.toLowerCase().includes(q))
      );
    });
  }, [preview, searchTerm, showOnlyIssues]);

  const totalParticipationsCount = useMemo(() => {
    return activeRows.reduce((acc, r) => acc + r.participations.length, 0);
  }, [activeRows]);

  if (!isOpen) return null;

  const resetState = () => {
    setSelectedFileName('');
    setPreview(null);
    setExcludedRowIndices(new Set());
    setShowOnlyIssues(false);
    setSearchTerm('');
    setProgress(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    if (isImporting) return;
    resetState();
    onClose();
  };

  const toggleExcludeRow = (rowIndex: number) => {
    setExcludedRowIndices(prev => {
      const next = new Set(prev);
      if (next.has(rowIndex)) {
        next.delete(rowIndex);
      } else {
        next.add(rowIndex);
      }
      return next;
    });
  };

  const skipAllWarningRows = () => {
    if (!preview) return;
    setExcludedRowIndices(prev => {
      const next = new Set(prev);
      preview.rows.forEach(r => {
        if (r.issues.some(i => i.severity === 'error')) {
          next.add(r.rowIndex);
        }
      });
      return next;
    });
    toast.success('تم استثناء الصفوف غير المكتملة من الحفظ الجماعي');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setResult(null);
    setExcludedRowIndices(new Set());
    setShowOnlyIssues(false);
    setIsParsing(true);
    try {
      const parsed = await parseTeachersAndParticipationsWorkbook(file);
      if (parsed.rows.length === 0) {
        toast.error('لم يتم العثور على صفوف صالحة في ملف الإكسيل المحدد. يرجى التحقق من الأعمدة.');
        setPreview(null);
      } else {
        const autoSkip = new Set<number>();
        parsed.rows.forEach(r => {
          if (r.issues.some(i => i.severity === 'error')) {
            autoSkip.add(r.rowIndex);
          }
        });
        setExcludedRowIndices(autoSkip);
        setPreview(parsed);
        toast.success(`تمت قراءة ${parsed.rows.length} صف — جاهز للحفظ المحلي الفوري`);
      }
    } catch (err) {
      console.error('Error parsing workbook:', err);
      toast.error('تعذرت قراءة ملف الإكسيل. تأكد من أن الملف بصيغة .xlsx أو .xls أو .csv');
      setPreview(null);
    } finally {
      setIsParsing(false);
      if (e.target) e.target.value = '';
    }
  };

  const runBatchImport = async (localOnly: boolean, extraExcludedOpKeys?: Set<string>) => {
    if (!preview || activeRows.length === 0 || isImporting) return;

    setIsImporting(true);
    setResult(null);
    try {
      const summary = await executeAdditiveExcelImport(preview, {
        directorateId,
        seasonId: activeSeason,
        autoProgramMissingTournaments: autoProgramMissing,
        localOnly,
        excludedRowIndices,
        excludedOpKeys: extraExcludedOpKeys,
        onProgress: p => setProgress(p)
      });
      setResult(summary);

      // Refresh parent state asynchronously so cloud delays never block modal completion
      Promise.resolve(onImportComplete()).catch(err =>
        console.warn('Background refresh after import warning:', err)
      );

      if (summary.savedLocallyMode || summary.savedLocallyOnlyDueToQuota) {
        toast.success(
          `تم حفظ جميع المعطيات محلياً فوراً (${summary.queuedForTomorrowCount} سجل مبرمج للمزامنة السحابية غداً تلقائياً)!`,
          { duration: 5000 }
        );
      } else if (summary.failedRecords && summary.failedRecords.length > 0) {
        toast.error(`تم الحفظ المحلي مع تعثر مزامنة ${summary.failedRecords.length} سجل سحابياً.`);
      } else {
        toast.success('تم حفظ ومزامنة جميع المعطيات دفعة واحدة بنجاح!');
      }
    } catch (err) {
      console.error('Error executing Excel import:', err);
      toast.error('حدث خطأ أثناء حفظ البيانات المستوردة.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleSkipFailedAndRetry = async () => {
    if (!result?.failedRecords || result.failedRecords.length === 0) return;
    const opsToSkip = new Set<string>(result.failedRecords.map(f => f.opKey));
    await runBatchImport(false, opsToSkip);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      dir="rtl"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl shadow-xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between gap-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-white truncate">
                استيراد وتفريغ ملف الإكسيل الشامل ({directorateName})
              </h3>
              <p className="text-xs text-slate-300 mt-0.5 truncate">
                حفظ محلي فوري (0 ثانية انتظار) + جدولة المزامنة السحابية تلقائياً عند تجدد الحصة غداً
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={downloadParticipationsExcelTemplate}
              disabled={isImporting}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
              title="تحميل نموذج إكسيل مطابق للأعمدة المطلوبة"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>نموذج Excel</span>
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={isImporting}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 text-slate-800 dark:text-slate-100">
          {/* Additive & Local-Save Banner */}
          <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-200">
              <p className="font-bold text-emerald-900 dark:text-emerald-300">
                وضع الحفظ المحلي الفوري (في انتظار تجدد حصة الغد) · جميع المشاركات لغير المنتمين · بدون حذف أي معطى سابق
              </p>
              <p className="mt-0.5 text-slate-600 dark:text-slate-300">
                عند الضغط على <strong>«حفظ محلياً الآن (في انتظار الغد)»</strong> تُحفظ كافة المؤسسات والأساتذة والمشاركات فوراً في التطبيق لتشتغل بها الآن (بطولات، لوائح، قرعة إلكترونية)، وتُوضع تلقائياً في حافظة المزامنة لترتفع إلى السحابة غداً بمجرد تجدد حصة Firestore اليومية.
              </p>
            </div>
          </div>

          {/* Upload Zone */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />

          {!result && (
            <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-5 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-right">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {selectedFileName ? `الملف المحدد: ${selectedFileName}` : 'اختر ملف الإكسيل (.xlsx أو .xls أو .csv)'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  الاسم والنسب · المؤسسة · الإطار · البريد الإلكتروني · رقم التأجير · رقم الهاتف · مشاركات غير المنتمين (الأعمدة G إلى P وما بعدها)
                </p>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isParsing || isImporting}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري قراءة الملف...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>{preview ? 'اختيار ملف إكسيل آخر' : 'رفع ملف الإكسيل للمعاينة'}</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Completion Summary */}
          {result && (
            <div className="space-y-4">
              {(result.savedLocallyMode || result.savedLocallyOnlyDueToQuota) && (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 flex items-start gap-3">
                  <HardDrive className="w-5 h-5 shrink-0 mt-0.5 text-emerald-700 dark:text-emerald-400" />
                  <div className="space-y-1 text-xs leading-relaxed text-slate-800 dark:text-slate-100">
                    <p className="font-bold text-sm text-emerald-900 dark:text-emerald-300">
                      تم حفظ جميع المعطيات محلياً بنجاح (100%) — جاهزة للاستخدام الفوري في التطبيق!
                    </p>
                    <p className="text-slate-700 dark:text-slate-300">
                      تمت جدولة <strong className="tabular-nums">{result.queuedForTomorrowCount}</strong> سجل في حافظة المزامنة السحابية. غداً عند فتح المنصة بعد تجدد حصة Firestore اليومية، سيتم رفعها تلقائياً إلى السحابة (أو يمكنك ضغط زر <strong>«مزامنة المحفوظات المحلية»</strong> أعلى صفحة البطولات).
                    </p>
                  </div>
                </div>
              )}

              {result.failedRecords && result.failedRecords.length > 0 && (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-red-800 dark:text-red-300 text-xs font-bold">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>تعذر مزامنة {result.failedRecords.length} سجل سحابياً — يمكنك تجاوزها يدوياً وإتمام الحفظ:</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleSkipFailedAndRetry}
                      disabled={isImporting}
                      className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                      <span>تجاوز السجلات المتعثرة وإتمام الحفظ</span>
                    </button>
                  </div>
                  <div className="max-h-40 overflow-auto divide-y divide-red-200/60 dark:divide-red-800/60 text-xs">
                    {result.failedRecords.map(rec => (
                      <div key={rec.opKey} className="py-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                          {rec.rowIndex ? `صف #${rec.rowIndex} — ` : ''}
                          {rec.label}
                        </span>
                        <span className="text-red-700 dark:text-red-400 font-mono text-[11px]">{rec.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="flex items-center gap-2.5 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-6 h-6 shrink-0" />
                  <h4 className="text-base font-bold">
                    ملخص المعطيات المدمجة في التطبيق (مع الحفاظ التام على المعطيات السابقة)
                  </h4>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="text-xs text-slate-500 dark:text-slate-400">مؤسسات جديدة أضيفت</div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                      {result.addedSchools}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                      +{result.existingSchoolsPreserved} مؤسسة محفوظة مسبقاً
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="text-xs text-slate-500 dark:text-slate-400">أساتذة جدد أضيفوا</div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                      {result.addedTeachers}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                      +{result.updatedTeachersPreserved} أستاذ تم تحديثه بأمان
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="text-xs text-slate-500 dark:text-slate-400">مشاركات مؤسسات (غير منتمين)</div>
                    <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1 tabular-nums">
                      {result.confirmedParticipationsMerged}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {result.skippedRowsCount > 0
                        ? `تم تجاوز ${result.skippedRowsCount} صف يدوياً`
                        : 'مع الاحتفاظ بالمشاركات السابقة'}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="text-xs text-slate-500 dark:text-slate-400">فروع غير المنتمين المفعلة</div>
                    <div className="text-xl font-bold text-blue-700 dark:text-blue-400 mt-1 tabular-nums">
                      {result.newlyProgrammedTournaments}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      جاهزة للتسجيل والقرعة فوراً
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Live Progress Bar */}
          {isImporting && progress && (
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-blue-900 dark:text-blue-200">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span>{progress.message}</span>
                </div>
                <span className="tabular-nums">{progress.percent}%</span>
              </div>
              <div className="w-full h-2 bg-blue-200/70 dark:bg-blue-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-transform duration-200 origin-right"
                  style={{ transform: `scaleX(${Math.max(0, Math.min(100, progress.percent)) / 100})` }}
                />
              </div>
            </div>
          )}

          {/* Preview Section */}
          {preview && !result && (
            <div className="space-y-4">
              {/* Summary Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">الأطر المحددة للحفظ</div>
                    <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {activeRows.length} من {preview.totalRowsRead} أستاذ(ة)
                    </div>
                  </div>
                  <Users className="w-5 h-5 text-blue-600 shrink-0" />
                </div>

                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">المؤسسات التعليمية المفعلة</div>
                    <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {activeSummary.uniqueSchools.length} مؤسسة
                    </div>
                  </div>
                  <Building2 className="w-5 h-5 text-emerald-600 shrink-0" />
                </div>

                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">مشاركات غير المنتمين للأندية</div>
                    <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {totalParticipationsCount} مشاركة ({activeSummary.sportSummary.length} رياضات)
                    </div>
                  </div>
                  <Trophy className="w-5 h-5 text-amber-600 shrink-0" />
                </div>
              </div>

              {/* Row Diagnostics & Manual Skip Banner */}
              {rowsWithIssuesCount > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <span className="font-bold tabular-nums">
                        تم رصد ملاحظات في {rowsWithIssuesCount} صف داخل الملف
                      </span>
                      <span className="mx-1.5">·</span>
                      <span className="text-amber-800 dark:text-amber-300">
                        يمكنك عرضها ومراجعتها أو إلغاء تحديد أي صف لتجاوزه يدوياً قبل الحفظ.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowOnlyIssues(v => !v)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                        showOnlyIssues
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white dark:bg-slate-900 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700 hover:bg-amber-100/60'
                      }`}
                    >
                      {showOnlyIssues ? 'عرض جميع الصفوف' : `إظهار الصفوف ذات الملاحظات (${rowsWithIssuesCount})`}
                    </button>
                    {preview.rows.some(r => r.issues.some(i => i.severity === 'error')) && (
                      <button
                        type="button"
                        onClick={skipAllWarningRows}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                      >
                        تجاوز الصفوف الناقصة
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Sport Participations Breakdown */}
              {activeSummary.sportSummary.length > 0 ? (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900 space-y-2.5">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    تفصيل المشاركات الرياضية المستخرجة (جميعها لفئة غير المنتمين للأندية):
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {activeSummary.sportSummary.map(sp => (
                      <div key={sp.sportId} className="py-2 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
                        <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                          <span>{sp.sportIcon}</span>
                          <span>{sp.sportName}</span>
                          <span className="text-slate-400">·</span>
                          <span className="text-emerald-700 dark:text-emerald-400 font-semibold tabular-nums">
                            {sp.schoolsCount} مؤسسة مشاركة
                          </span>
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                          {sp.branchesLabels.join(' · ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>لم يتم رصد مشاركات رياضية في الصفوف المحددة، سيتم استيراد بيانات الأساتذة والمؤسسات فقط.</span>
                </div>
              )}

              {/* Option to auto-activate imported sport branches */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoProgramMissing}
                  onChange={e => setAutoProgramMissing(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  تفعيل وبرمجة فروع بطولات غير المنتمين المستوردة تلقائياً إن لم تكن مبرمجة (مع الحفاظ التام على البطولات السابقة)
                </span>
              </label>

              {/* Search & Data Preview Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/40">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                    معاينة الصفوف والتحكم اليدوي ({filteredPreviewRows.length} معروض · {excludedRowIndices.size} متجاوز)
                  </span>
                  <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 w-56">
                    <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder="بحث بالاسم أو المؤسسة..."
                      className="w-full text-xs bg-transparent border-0 focus:outline-none text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="max-h-72 overflow-auto">
                  <table className="w-full text-right text-xs border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 sticky top-0">
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="py-2 px-3 font-semibold whitespace-nowrap">تضمين</th>
                        <th className="py-2 px-3 font-semibold whitespace-nowrap">#</th>
                        <th className="py-2 px-3 font-semibold whitespace-nowrap">الاسم والنسب</th>
                        <th className="py-2 px-3 font-semibold whitespace-nowrap">المؤسسة</th>
                        <th className="py-2 px-3 font-semibold whitespace-nowrap">البريد / التأجير</th>
                        <th className="py-2 px-3 font-semibold whitespace-nowrap">المشاركات (غير المنتمين)</th>
                        <th className="py-2 px-3 font-semibold whitespace-nowrap">ملاحظات الفحص</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredPreviewRows.slice(0, 150).map(row => {
                        const isSkipped = excludedRowIndices.has(row.rowIndex);
                        return (
                          <tr
                            key={row.rowIndex}
                            className={`transition-colors ${
                              isSkipped
                                ? 'bg-slate-100/70 dark:bg-slate-800/60 opacity-55'
                                : row.issues.length > 0
                                ? 'bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50/70'
                                : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            <td className="py-2 px-3 whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={!isSkipped}
                                onChange={() => toggleExcludeRow(row.rowIndex)}
                                title={isSkipped ? 'إعادة تضمين هذا الصف' : 'تجاوز هذا الصف يدوياً'}
                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                            </td>
                            <td className="py-2 px-3 text-slate-400 tabular-nums">{row.rowIndex}</td>
                            <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                              {row.fullName}
                            </td>
                            <td className="py-2 px-3 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                              {row.schoolName || '—'}
                            </td>
                            <td className="py-2 px-3 text-slate-600 dark:text-slate-300 font-mono text-[11px] whitespace-nowrap" dir="ltr">
                              {row.email || '—'} {row.leaseNumber ? `· ${row.leaseNumber}` : ''}
                            </td>
                            <td className="py-2 px-3 text-slate-700 dark:text-slate-200 min-w-[200px]">
                              {row.participations.length > 0 ? (
                                <span className="leading-relaxed">
                                  {row.participations
                                    .map(p => `${p.sportName} ${p.category} ${p.gender === 'Female' ? 'إناث' : 'ذكور'}`)
                                    .join(' · ')}
                                </span>
                              ) : (
                                <span className="text-slate-400">بدون مشاركة</span>
                              )}
                            </td>
                            <td className="py-2 px-3 min-w-[200px]">
                              {isSkipped ? (
                                <span className="text-slate-500 font-semibold">تم تجاوز هذا الصف يدوياً</span>
                              ) : row.issues.length > 0 ? (
                                <span className="text-amber-700 dark:text-amber-400 leading-relaxed">
                                  {row.issues.map(i => i.message).join(' · ')}
                                </span>
                              ) : (
                                <span className="text-emerald-700 dark:text-emerald-400">سليم</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            disabled={isImporting}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            {result ? 'إغلاق والعودة للبطولات' : 'إلغاء'}
          </button>

          {!result && (
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => runBatchImport(false)}
                disabled={!preview || activeRows.length === 0 || isImporting || isParsing}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                title="محاولة الحفظ مع المزامنة السحابية المباشرة (عند توفر الحصة اليومية)"
              >
                <UploadCloud className="w-4 h-4 text-blue-600" />
                <span>حفظ ومزامنة سحابية</span>
              </button>

              <button
                type="button"
                onClick={() => runBatchImport(true)}
                disabled={!preview || activeRows.length === 0 || isImporting || isParsing}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 transition-colors shadow-xs cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                title="حفظ فوري محلياً بدون انتظار السحابة، مع جدولة الرفع التلقائي غداً"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري الحفظ...</span>
                  </>
                ) : (
                  <>
                    <HardDrive className="w-4 h-4" />
                    <span>حفظ محلياً الآن (في انتظار الغد) · {activeRows.length} صف</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
