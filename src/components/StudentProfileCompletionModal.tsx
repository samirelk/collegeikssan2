import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Upload,
  RefreshCw,
  X,
  Sparkles,
  Info,
  UserCheck,
  Check,
  Phone,
  Clock,
  HelpCircle
} from 'lucide-react';
import { StudentData } from './StudentPortalDashboard';

interface StudentProfileCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentData: StudentData;
  institutionName: string;
  onProfileUpdated: (updatedData: StudentData) => void;
  isMandatoryFirstTime?: boolean;
}

export const StudentProfileCompletionModal: React.FC<StudentProfileCompletionModalProps> = ({
  isOpen,
  onClose,
  studentData,
  institutionName,
  onProfileUpdated,
  isMandatoryFirstTime = true
}) => {
  const student = studentData.student;

  const [photoUrl, setPhotoUrl] = useState<string>(student.photoUrl || '');
  const [guardianPhone, setGuardianPhone] = useState<string>(student.guardianPhone || '');
  
  // Camera & Upload state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Submission state
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Preset student avatars for instant choice
  const presetAvatars = [
    'https://images.unsplash.com/photo-1544717305-2782549b5136?w=240&h=240&fit=crop&crop=faces&q=80',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=240&h=240&fit=crop&crop=faces&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=240&h=240&fit=crop&crop=faces&q=80',
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=240&h=240&fit=crop&crop=faces&q=80',
    'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=240&h=240&fit=crop&crop=faces&q=80',
    'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=240&h=240&fit=crop&crop=faces&q=80'
  ];

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Stop camera on unmount or modal close
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
  }, [isOpen]);

  const startCamera = async () => {
    setCameraError(null);
    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraError('المتصفح لا يدعم تشغيل الكاميرا المباشرة في هذه البيئة. يرجى اختيار صورة من جهازك أو استخدام صورة رمزية.');
      setIsCameraActive(false);
      return;
    }
    try {
      if (mediaStreamRef.current) {
        stopCamera();
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 480 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      });
      mediaStreamRef.current = stream;
      setIsCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (err: any) {
      setIsCameraActive(false);
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError' || err?.message?.includes('Permission denied')) {
        setCameraError('تم رفض إذن الكاميرا من المتصفح أو بيئة العرض. يمكنك اختيار صورة مباشرة من جهازك أو اختيار صورة رمزية جاهزة.');
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        setCameraError('لم يتم العثور على كاميرا متصلة. يرجى اختيار صورة من جهازك.');
      } else {
        setCameraError('تعذر فتح الكاميرا حالياً. يمكنك اختيار صورة من جهازك بسهولة.');
      }
    }
  };

  if (!isOpen) return null;

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const size = Math.min(video.videoWidth, video.videoHeight) || 300;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Center crop to square
    const startX = (video.videoWidth - size) / 2;
    const startY = (video.videoHeight - size) / 2;
    ctx.drawImage(video, startX, startY, size, size, 0, 0, size, size);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setPhotoUrl(dataUrl);
    stopCamera();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('يرجى اختيار ملف صورة صالح (JPG, PNG, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 400;
        let width = img.width;
        let height = img.height;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setPhotoUrl(resizedDataUrl);
          setErrorMessage(null);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Direct Submission: No SMS needed! Sent to director for approval
  const handleCompleteProfile = async () => {
    setErrorMessage(null);

    if (!photoUrl) {
      setErrorMessage('الصورة الشخصية مطلوبة. يرجى التقاط صورة أو اختيارها من الجهاز.');
      return;
    }

    const cleanPhone = guardianPhone.trim().replace(/\s+/g, '');
    if (!cleanPhone || cleanPhone.length < 8) {
      setErrorMessage('يرجى إدخال رقم هاتف صحيح لولي الأمر (مثال: 0612345678 أو 0712345678).');
      return;
    }

    try {
      setIsSaving(true);
      const res = await fetch('/api/student/profile/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          massarNumber: student.massarNumber,
          photoUrl,
          guardianPhone: cleanPhone
        })
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'تعذر حفظ البيانات');
      }

      try {
        localStorage.setItem(`student_profile_completed_${student.massarNumber}`, 'true');
        sessionStorage.setItem('echsa_student_session', JSON.stringify(json));
      } catch {}

      setSuccessToast('تم حفظ الصورة ورقم هاتف ولي الأمر بنجاح! سيصادق عليهما مدير المؤسسة مباشرة دون الحاجة لرسائل SMS ✓');
      onProfileUpdated(json);

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء حفظ الملف');
    } finally {
      setIsSaving(false);
    }
  };

  const isApproved = student.approvalStatus === 'approved' || student.guardianPhoneVerified;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0F1914]/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      dir="rtl"
    >
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border-2 border-[#C98A3C]/40 overflow-hidden animate-in zoom-in-95 duration-200 my-4 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#1A4E47] via-[#143E38] to-[#1A4E47] text-white p-5 sm:p-6 relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#C98A3C]/20 rounded-full blur-2xl pointer-events-none"></div>

          <div className="flex items-start justify-between gap-3 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#133D37] border-2 border-[#C98A3C] flex items-center justify-center text-[#C98A3C] shadow-lg shrink-0">
                <ShieldCheck className="w-7 h-7 text-[#C98A3C]" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#C98A3C]/20 border border-[#C98A3C]/50 text-[#C98A3C] text-[10px] font-bold mb-1">
                  <Sparkles className="w-3 h-3" />
                  <span>الملف المدرسي • فضاء التلميذ</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold font-serif text-white tracking-wide">
                  استكمال الصورة ورقم هاتف ولي الأمر 📱
                </h2>
                <p className="text-xs text-[#F2EFE3]/80 mt-0.5">
                  مصادقة إدارية مباشرة من طرف مدير المؤسسة دون الحاجة لرسائل SMS
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Student mini banner */}
          <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-xs text-white/90 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold">{student.name}</span>
              <span className="text-[#C98A3C] font-mono font-bold">({student.massarNumber})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-white/15 text-[11px] font-semibold">
                {student.sectionLevel} - {student.sectionClass}
              </span>
              {isApproved ? (
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/30 text-emerald-300 text-[10px] font-bold border border-emerald-400/40">
                  مصادق عليه من المدير ✓
                </span>
              ) : student.photoUrl || student.guardianPhone ? (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/30 text-amber-200 text-[10px] font-bold border border-amber-400/40">
                  في انتظار مصادقة المدير ⏳
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
          {/* Director Approval Clarification Notice */}
          <div className="p-4 rounded-2xl bg-[#E8F2F0] border border-[#1A4E47]/30 flex items-start gap-3 text-xs text-[#133D37]">
            <Info className="w-5 h-5 text-[#1A4E47] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-sm text-[#1A4E47]">
                المصادقة الإدارية المباشرة (دون الحاجة لرسائل SMS):
              </p>
              <p className="text-[12px] text-[#2C4843] leading-relaxed">
                يقوم <strong>مدير المؤسسة</strong> بالمصادقة على صورتك ورقم هاتف ولي أمرك مباشرة من لوحة الإدارة لاعتمادها في السجل المدرسي الرسمي، دون حاجة لإرسال أو دفع أي رسائل SMS أو انتظار رموز OTP.
              </p>
            </div>
          </div>

          {/* Success Toast */}
          {successToast && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border-2 border-emerald-500/40 text-emerald-950 text-xs font-bold flex items-center gap-2.5 animate-in slide-in-from-top">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{successToast}</span>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold flex items-center gap-2.5 animate-in shake">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: Student Photo */}
          <div className="bg-[#FAF8F5] p-4 sm:p-5 rounded-2xl border border-[#E5DFD4] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5DFD4] pb-2.5">
              <div className="flex items-center gap-2 font-bold text-[#1F2926] text-sm">
                <span className="w-6 h-6 rounded-lg bg-[#1A4E47] text-white flex items-center justify-center text-xs font-bold">
                  1
                </span>
                <span>الصورة الشخصية للتلميذ(ة)</span>
                <span className="text-rose-600 font-black">*</span>
              </div>
              {photoUrl ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <Check className="w-3 h-3" />
                  <span>تم اختيار الصورة</span>
                </span>
              ) : (
                <span className="text-[11px] text-[#A39989]">مطلوبة</span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-5">
              {/* Photo Preview Circle */}
              <div className="relative group shrink-0">
                <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-[#C98A3C] shadow-lg bg-white flex items-center justify-center">
                  {photoUrl ? (
                    <img src={photoUrl} alt="صورة التلميذ" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-3 text-[#A39989]">
                      <Camera className="w-8 h-8 mx-auto mb-1 opacity-40 text-[#1A4E47]" />
                      <span className="text-[10px] block font-semibold">لا توجد صورة</span>
                    </div>
                  )}
                </div>

                {photoUrl && (
                  <button
                    type="button"
                    onClick={() => setPhotoUrl('')}
                    className="absolute -top-1 -right-1 w-6 h-6 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-md hover:bg-rose-700 transition-colors cursor-pointer"
                    title="حذف الصورة الحالية"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Photo Upload / Capture Actions */}
              <div className="flex-1 w-full space-y-3">
                {/* Active Camera Stream */}
                {isCameraActive ? (
                  <div className="p-3 bg-black/90 rounded-2xl flex flex-col items-center gap-2 border border-black/40">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-48 h-48 rounded-xl object-cover border-2 border-[#C98A3C]"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="px-4 py-1.5 rounded-xl bg-[#C98A3C] hover:bg-[#B37932] text-white font-bold text-xs shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="w-4 h-4" />
                        <span>التقاط الصورة الآن</span>
                      </button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs transition-colors cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="flex-1 min-w-[140px] px-3.5 py-2.5 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Camera className="w-4 h-4 text-[#C98A3C]" />
                      <span>التقاط بالكاميرا</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 min-w-[140px] px-3.5 py-2.5 rounded-xl bg-white hover:bg-[#F2EFE9] text-[#1A4E47] border border-[#C5DDD8] font-bold text-xs shadow-2xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Upload className="w-4 h-4 text-[#C98A3C]" />
                      <span>اختيار صورة من الجهاز</span>
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                )}

                {cameraError && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-950 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 animate-in fade-in">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span className="leading-snug">{cameraError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCameraError(null);
                        fileInputRef.current?.click();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#1A4E47] hover:bg-[#133D37] text-white text-xs font-bold shrink-0 transition-colors cursor-pointer self-end sm:self-auto"
                    >
                      اختيار صورة الآن
                    </button>
                  </div>
                )}

                {/* Preset Avatars */}
                <div>
                  <span className="block text-[11px] text-[#6C6356] font-semibold mb-1.5">
                    أو اختر صورة رمزية سريعة:
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {presetAvatars.map((av, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setPhotoUrl(av);
                          stopCamera();
                        }}
                        className={`w-9 h-9 rounded-xl overflow-hidden border-2 transition-transform hover:scale-105 cursor-pointer ${
                          photoUrl === av ? 'border-[#1A4E47] ring-2 ring-[#1A4E47]/30 scale-105' : 'border-[#E5DFD4]'
                        }`}
                        title={`صورة رمزية ${idx + 1}`}
                      >
                        <img src={av} alt="avatar" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* STEP 2: Guardian Phone Number */}
          <div className="bg-[#FAF8F5] p-4 sm:p-5 rounded-2xl border border-[#E5DFD4] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5DFD4] pb-2.5">
              <div className="flex items-center gap-2 font-bold text-[#1F2926] text-sm">
                <span className="w-6 h-6 rounded-lg bg-[#1A4E47] text-white flex items-center justify-center text-xs font-bold">
                  2
                </span>
                <span>رقم هاتف ولي الأمر (للتواصل المدرسي وإشعارات الغياب)</span>
                <span className="text-rose-600 font-black">*</span>
              </div>
              {guardianPhone.trim().length >= 8 ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>رقم مسجل</span>
                </span>
              ) : (
                <span className="text-[11px] text-amber-700 font-semibold">مطلوب</span>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1">
                  رقم الهاتف الشخصي لولي الأمر (الأب / الأم / الولي الشرعي)
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={guardianPhone}
                    onChange={(e) => setGuardianPhone(e.target.value)}
                    placeholder="مثال: 0612345678 أو 0712345678"
                    className="w-full px-4 py-2.5 rounded-xl border border-[#C5DDD8] focus:border-[#1A4E47] focus:ring-2 focus:ring-[#1A4E47]/20 outline-none text-xs font-mono font-bold bg-white text-left dir-ltr"
                  />
                  <Smartphone className="w-4 h-4 text-[#1A4E47] absolute left-3 top-3 pointer-events-none" />
                </div>
                <p className="text-[11px] text-[#6C6356] mt-1.5 leading-relaxed">
                  يُستخدم هذا الرقم من طرف إدارة المؤسسة للتواصل مع ولي أمرك، وإرسال إشعارات الغياب والتأخر واستدعاءات الأولياء الرسمية.
                </p>
              </div>

              {isApproved && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>هذا الرقم مصادق عليه رسمياً من طرف مدير المؤسسة ✓</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-[#FAF8F5] p-4 sm:p-5 border-t border-[#E5DFD4] flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-[#6C6356] hidden sm:block">
            {photoUrl && guardianPhone.trim() ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>البيانات جاهزة للإرسال والمصادقة من المدير.</span>
              </span>
            ) : (
              <span>يرجى استكمال الصورة ورقم هاتف ولي الأمر.</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#D5E2DF] text-[#6C6356] hover:bg-white font-bold text-xs cursor-pointer transition-colors"
            >
              إلغاء
            </button>

            <button
              type="button"
              onClick={handleCompleteProfile}
              disabled={isSaving || !photoUrl || !guardianPhone.trim()}
              className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                photoUrl && guardianPhone.trim()
                  ? 'bg-gradient-to-r from-[#1A4E47] to-[#133D37] hover:brightness-110 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-[#C98A3C]" />
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#C98A3C]" />
                  <span>حفظ وإرسال للمصادقة الإدارية ✓</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
