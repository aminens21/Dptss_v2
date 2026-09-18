import React, { ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public props: Props;
  public state: State;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught runtime error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetData = () => {
    try {
      localStorage.removeItem('demo_user_profile');
      sessionStorage.clear();
      window.location.href = '/';
    } catch (e) {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-['Cairo',sans-serif]" dir="rtl">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-6 text-center">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-black text-slate-800 mb-2">
              حدث خطأ أثناء تحميل الصفحة
            </h2>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              تعذر عرض الواجهة بالشكل المطلوب. يمكنك إعادة تحميل الصفحة أو إعادة ضبط الجلسة للعودة إلى الشاشة الرئيسية.
            </p>
            {this.state.error?.message && (
              <div className="bg-slate-50 rounded-xl p-3 text-start text-[11px] font-mono text-slate-600 mb-6 overflow-x-auto border border-slate-200 max-h-24">
                {this.state.error.message}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>إعادة تحميل</span>
              </button>
              <button
                type="button"
                onClick={this.handleResetData}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>الرئيسية / إعادة ضبط</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
