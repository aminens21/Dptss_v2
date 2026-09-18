import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, Check, X, SwitchCamera, AlertCircle, Upload } from 'lucide-react';
import { compressImageToBase64 } from '../lib/imageUtils';
import toast from 'react-hot-toast';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (compressedBase64: string) => void;
  title?: string;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  title = 'التقاط صورة شخصية بالكاميرا'
}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const nativeFileInputRef = useRef<HTMLInputElement>(null);

  // Start Camera Stream
  const startCamera = async (mode: 'user' | 'environment') => {
    stopCamera();
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('المتصفح لا يدعم الوصول المباشر لكاميرا الويب. يرجى استخدام زر كاميرا الهاتف.');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 640 },
          height: { ideal: 640 }
        },
        audio: false
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(e => console.error('Video play error:', e));
      }
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('تم رفض الإذن بالوصول للكاميرا. يرجى السماح للموقع باستخدام الكاميرا، أو التقاط الصورة مباشرة عبر زر الهاتف.');
      } else {
        setCameraError('تعذر فتح الكاميرا المباشرة. يمكنك استخدام زر "كاميرا الهاتف" أدناه.');
      }
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setCapturedImage(null);
      setCameraError(null);
      startCamera(facingMode);
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  // Flip camera (front / rear)
  const toggleFacingMode = () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
  };

  // Take Snapshot from live video stream
  const takeSnapshot = () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      const size = Math.min(video.videoWidth || 480, video.videoHeight || 480);
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Crop center square
      const startX = ((video.videoWidth || size) - size) / 2;
      const startY = ((video.videoHeight || size) - size) / 2;

      // Mirror if front camera
      if (facingMode === 'user') {
        ctx.translate(size, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, startX, startY, size, size, 0, 0, size, size);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedImage(dataUrl);
      stopCamera();
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء التقاط الصورة');
    }
  };

  // Handle native file input capture (mobile native camera fallback / direct shutter)
  const handleNativeCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      const compressed = await compressImageToBase64(file, {
        maxWidth: 320,
        maxHeight: 320,
        quality: 0.82
      });
      onCapture(compressed);
      toast.success('تم التقاط وضغط الصورة بنجاح');
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء معالجة الصورة');
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirm captured snapshot
  const confirmCapturedImage = async () => {
    if (!capturedImage) return;
    try {
      setIsProcessing(true);
      const compressed = await compressImageToBase64(capturedImage, {
        maxWidth: 320,
        maxHeight: 320,
        quality: 0.82
      });
      onCapture(compressed);
      toast.success('تم اعتماد الصورة بنجاح');
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء ضغط الصورة');
    } finally {
      setIsProcessing(false);
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera(facingMode);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150" dir="rtl">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-900 p-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <Camera className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{title}</h3>
              <p className="text-[10px] text-blue-100/80">التقاط مباشر من كاميرا الهاتف أو الحاسوب</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport Area */}
        <div className="p-4 bg-slate-900 flex flex-col items-center justify-center relative min-h-[300px]">
          {capturedImage ? (
            <div className="relative w-64 h-64 rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-lg">
              <img
                src={capturedImage}
                alt="Captured preview"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 right-2 bg-emerald-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                <Check className="w-3 h-3" />
                <span>معاينة اللقطة</span>
              </div>
            </div>
          ) : cameraError ? (
            <div className="text-center p-6 bg-slate-800/80 rounded-2xl border border-slate-700 max-w-xs text-white space-y-3">
              <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
              <p className="text-xs text-slate-200 leading-relaxed">{cameraError}</p>
              <button
                type="button"
                onClick={() => nativeFileInputRef.current?.click()}
                className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>فتح كاميرا الهاتف الآن</span>
              </button>
            </div>
          ) : (
            <div className="relative w-64 h-64 rounded-2xl overflow-hidden border-2 border-blue-400/50 bg-black shadow-inner flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              />
              {/* Target Outline */}
              <div className="absolute inset-4 border-2 border-dashed border-white/40 rounded-full pointer-events-none" />
              <div className="absolute bottom-2 bg-black/60 backdrop-blur-xs text-white text-[10px] px-2.5 py-0.5 rounded-full font-medium">
                ضع الوجه داخل الدائرة
              </div>
            </div>
          )}

          {/* Camera switch button if live stream */}
          {!capturedImage && !cameraError && (
            <button
              type="button"
              onClick={toggleFacingMode}
              className="absolute top-3 left-3 bg-white/20 hover:bg-white/30 text-white p-2 rounded-xl backdrop-blur-xs transition-colors flex items-center gap-1 text-[10px] font-bold cursor-pointer"
              title="تبديل الكاميرا الأمامية / الخلفية"
            >
              <SwitchCamera className="w-4 h-4" />
              <span>تبديل</span>
            </button>
          )}
        </div>

        {/* Hidden Native Camera File Input */}
        <input
          ref={nativeFileInputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={handleNativeCapture}
        />

        {/* Controls & Actions */}
        <div className="p-4 bg-white border-t border-slate-100 flex flex-col gap-3">
          {capturedImage ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={retakePhoto}
                disabled={isProcessing}
                className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>إعادة الالتقاط</span>
              </button>
              <button
                type="button"
                onClick={confirmCapturedImage}
                disabled={isProcessing}
                className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isProcessing ? 'جاري الضغط...' : 'تأكيد وحفظ الصورة'}</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                {!cameraError && (
                  <button
                    type="button"
                    onClick={takeSnapshot}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-white animate-pulse" />
                    <span>التقاط الصورة الآن 📸</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => nativeFileInputRef.current?.click()}
                  className="py-3 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  title="فتح تطبيق كاميرا الهاتف مباشرة"
                >
                  <Camera className="w-4 h-4 text-emerald-600" />
                  <span>كاميرا الهاتف</span>
                </button>
              </div>

              <div className="text-center">
                <span className="text-[10px] text-slate-400">
                  يتم ضغط الصورة تلقائياً لتناسب قواعد البيانات الخفيفة وسرعة الاستجابة
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
