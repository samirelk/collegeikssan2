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
  MessageSquare,
  Send,
  Info,
  UserCheck,
  Lock,
  PhoneCall,
  BellRing,
  Check,
  Mail
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
  const [guardianPhoneVerified, setGuardianPhoneVerified] = useState<boolean>(
    Boolean(student.guardianPhoneVerified && student.guardianPhone)
  );
  
  // Verification Code flow
  const [verificationCodeInput, setVerificationCodeInput] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [smsNotice, setSmsNotice] = useState<{ senderName: string; phone: string; intlPhone?: string; whatsappUrl?: string } | null>(null);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [codeCountdown, setCodeCountdown] = useState<number>(0);

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

  // Preset student avatars for instant choice (شباب وتلاميذ مدرسة فقط)
  const presetAvatars = [
    'https://images.unsplash.com/photo-1544717305-2782549b5136?w=240&h=240&fit=crop&crop=faces&q=80',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=240&h=240&fit=crop&crop=faces&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=240&h=240&fit=crop&crop=faces&q=80',
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=240&h=240&fit=crop&crop=faces&q=80',
    'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=240&h=240&fit=crop&crop=faces&q=80',
    'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=240&h=240&fit=crop&crop=faces&q=80'
  ];

  // Stop camera on unmount or modal close
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Countdown timer for resending code
  useEffect(() => {
    if (codeCountdown <= 0) return;
    const timer = setInterval(() => {
      setCodeCountdown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [codeCountdown]);

  if (!isOpen) return null;

  const startCamera = async () => {
    setCameraError(null);
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
      console.error('Camera error:', err);
      setCameraError('تعذر الوصول إلى الكاميرا. يرجى السماح بصلاحية الكاميرا أو استخدام خيار رفع صورة من جهازك.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

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

    // Resize and convert to Base64 to keep payload lightweight
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

  // Request Verification Code via WhatsApp or Android SMS Gateway
  const handleRequestVerificationCode = async (channel: 'whatsapp' | 'sms' = 'whatsapp') => {
    setErrorMessage(null);
    const cleanPhone = guardianPhone.trim().replace(/\s+/g, '');
    if (!cleanPhone || cleanPhone.length < 8) {
      setErrorMessage('يرجى إدخال رقم هاتف صحيح لولي الأمر (مثال: 0612345678 أو 0712345678)');
      return;
    }

    try {
      setIsSendingCode(true);
      const res = await fetch('/api/student/profile/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          massarNumber: student.massarNumber,
          guardianPhone: cleanPhone,
          institutionName,
          channel
        })
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'تعذر إرسال رمز التحقق');
      }

      setCodeSent(true);
      setCodeCountdown(60);
      setSmsNotice({
        senderName: json.senderName || institutionName || 'ثانوية ايكسان الإعدادية',
        phone: cleanPhone,
        intlPhone: json.intlPhone || cleanPhone,
        whatsappUrl: json.whatsappUrl
      });

      if (channel === 'whatsapp' && json.whatsappUrl) {
        window.open(json.whatsappUrl, '_blank');
        setSuccessToast(`تم فتح تطبيق واتساب لإرسال رمز التحقق الرسمي إلى ولي الأمر بنجاح ✓`);
      } else {
        setSuccessToast(`تم إرسال رمز التحقق (OTP) بنجاح باسم "${json.senderName || institutionName}" إلى هاتف ولي الأمر ✓`);
      }
      setTimeout(() => setSuccessToast(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء إرسال رمز التحقق');
    } finally {
      setIsSendingCode(false);
    }
  };

  // Verify Code
  const handleVerifyCode = async () => {
    setErrorMessage(null);
    const code = verificationCodeInput.trim();
    if (!code) {
      setErrorMessage('يرجى إدخال رمز التحقق المكون من 4 أرقام المكتوب في الرسالة القصيرة SMS');
      return;
    }

    try {
      setIsVerifyingCode(true);
      const res = await fetch('/api/student/profile/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          massarNumber: student.massarNumber,
          code
        })
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'رمز التحقق غير صحيح. يرجى التأكد من كود التفعيل (OTP) المرسل في رسالة SMS لولي أمرك.');
      }

      setGuardianPhoneVerified(true);
      setSuccessToast('تم تأكيد وتفعيل رقم هاتف ولي الأمر بنجاح عبر خدمة الرسائل القصيرة SMS ✓');
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (err: any) {
      setErrorMessage(err.message || 'تعذر تأكيد الرمز');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  // Final Complete Submission
  const handleCompleteProfile = async () => {
    setErrorMessage(null);

    if (!photoUrl) {
      setErrorMessage('الصورة الشخصية مطلوبة. يرجى التقاط صورة أو رفعها من الجهاز.');
      return;
    }

    const cleanPhone = guardianPhone.trim().replace(/\s+/g, '');
    if (!cleanPhone) {
      setErrorMessage('رقم هاتف ولي الأمر مطلوب.');
      return;
    }

    if (!guardianPhoneVerified) {
      setErrorMessage('يجب تأكيد رقم هاتف ولي الأمر برمز التحقق أولاً.');
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
          guardianPhone: cleanPhone,
          guardianPhoneVerified: true
        })
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'تعذر حفظ البيانات');
      }

      // Update local storage key as extra guarantee so it never prompts again
      try {
        localStorage.setItem(`student_profile_completed_${student.massarNumber}`, 'true');
        sessionStorage.setItem('echsa_student_session', JSON.stringify(json));
      } catch {}

      setSuccessToast('تم حفظ الصورة وتأكيد رقم ولي الأمر بنجاح! لن يظهر هذا الإشعار مرة أخرى ✓');
      onProfileUpdated(json);

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء حفظ الملف');
    } finally {
      setIsSaving(false);
    }
  };

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
                  <span>الملف الشخصي • فضاء التلميذ</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold font-serif text-white tracking-wide">
                  استكمال الملف الشخصي وتأكيد رقم ولي الأمر 📱
                </h2>
                <p className="text-xs text-[#F2EFE3]/80 mt-0.5">
                  التلميذ(ة): <strong className="text-white">{student.name}</strong> • مسار: <span className="font-mono text-[#C98A3C]">{student.massarNumber}</span> • {student.sectionLevel}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              title="إغلاق النافذة والمتابعة لاحقاً"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs text-[#1F2926] flex-1">
          {/* Important Educational System Notice Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 text-amber-950 space-y-2 shadow-xs">
            <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
              <BellRing className="w-4 h-4 text-amber-700 animate-bounce" />
              <span>تنبيه هام وميثاق التواصل عبر واتساب (WhatsApp)</span>
            </div>
            <p className="text-xs leading-relaxed text-amber-900">
              حرصاً من إدارة <strong>{institutionName}</strong> على المتابعة الدقيقة والشفافة،
              فإن رقم هاتف ولي الأمر المسجل هنا <strong>هو الرقم الرسمي الوحيد الذي ستصل إليه فوراً وبشكل آلي كافة الإشعارات عبر رسائل WhatsApp</strong>:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] font-semibold text-amber-950">
              <div className="bg-white/80 p-2 rounded-xl border border-amber-200 flex items-center gap-2">
                <span className="w-5 h-5 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs">1</span>
                <span>إشعارات الغياب والتأخر اللحظية</span>
              </div>
              <div className="bg-white/80 p-2 rounded-xl border border-amber-200 flex items-center gap-2">
                <span className="w-5 h-5 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">2</span>
                <span>إشعارات المخالفات والتأديب</span>
              </div>
              <div className="bg-white/80 p-2 rounded-xl border border-amber-200 flex items-center gap-2">
                <span className="w-5 h-5 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">3</span>
                <span>إشعارات غياب الأساتذة والرخص</span>
              </div>
            </div>
            <div className="text-[10px] text-amber-800 font-medium pt-0.5">
              💡 <em>عند إدخال جميع المعلومات وتأكيدها بنجاح، لن يظهر هذا الإشعار مرة أخرى على هذا الحساب.</em>
            </div>
          </div>

          {/* Feedback messages */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span className="font-semibold">{errorMessage}</span>
            </div>
          )}

          {successToast && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="font-bold">{successToast}</span>
            </div>
          )}

          {/* Automated SMS OTP Dispatch Notice */}
          {smsNotice && !guardianPhoneVerified && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500 text-emerald-950 space-y-2.5 animate-in zoom-in-95">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-900 font-bold">
                  <Mail className="w-4 h-4 text-emerald-700" />
                  <span>رسالة نصية قصيرة (SMS) رسمية باسم المؤسسة</span>
                </div>
                <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2.5 py-0.5 rounded-full font-bold">
                  تم الإرسال تلقائياً ✓
                </span>
              </div>
              <p className="text-xs text-emerald-900 leading-relaxed">
                تم إرسال رمز التحقق (OTP) المكون من 4 أرقام في رسالة قصيرة SMS مباشرة باسم <strong>{smsNotice.senderName}</strong> إلى هاتف ولي الأمر (<strong>{smsNotice.phone}</strong>). يُرجى إدخال الرمز المكون من 4 أرقام في الخانة المخصصة أسفله.
              </p>
            </div>
          )}

          {/* STEP 1: Personal Photo */}
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
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>تم التقاط/اختيار الصورة</span>
                </span>
              ) : (
                <span className="text-[11px] text-amber-700 font-semibold">مطلوبة</span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-5">
              {/* Photo Display / Canvas */}
              <div className="relative shrink-0">
                {isCameraActive ? (
                  <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border-2 border-[#1A4E47] shadow-md bg-black">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover transform -scale-x-100"
                    />
                  </div>
                ) : photoUrl ? (
                  <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border-2 border-[#1A4E47] shadow-md bg-white">
                    <img
                      src={photoUrl}
                      alt={student.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-1 left-1 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  </div>
                ) : (
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl border-2 border-dashed border-[#B9D8D2] flex flex-col items-center justify-center text-[#6C6356] bg-white text-center p-2">
                    <Camera className="w-8 h-8 text-[#1A4E47]/50 mb-1" />
                    <span className="text-[10px]">لا توجد صورة بعد</span>
                  </div>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>

              {/* Action buttons */}
              <div className="space-y-2 flex-1 w-full">
                {isCameraActive ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                    >
                      <Camera className="w-4 h-4 text-[#C98A3C]" />
                      <span>التقاط الصورة الآن 📸</span>
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-3 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-xs transition-colors cursor-pointer"
                    >
                      إلغاء الكاميرا
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                    >
                      <Camera className="w-4 h-4 text-[#C98A3C]" />
                      <span>فتح الكاميرا والتقاط 📷</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 text-[#1F2926] font-bold text-xs border border-[#D5E2DF] shadow-2xs transition-colors cursor-pointer"
                    >
                      <Upload className="w-4 h-4 text-[#1A4E47]" />
                      <span>رفع صورة من الجهاز 📁</span>
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
                  <div className="text-[11px] text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200">
                    {cameraError}
                  </div>
                )}

                {/* Quick Avatar options */}
                <div className="pt-2">
                  <div className="text-[11px] text-[#6C6356] font-medium mb-1.5 flex items-center gap-1">
                    <span>أو اختر صورة رمزية سريعة للتلميذ:</span>
                  </div>
                  <div className="flex items-center gap-2">
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

          {/* STEP 2: Guardian Phone Number & Automated SMS OTP Verification */}
          <div className="bg-[#FAF8F5] p-4 sm:p-5 rounded-2xl border border-[#E5DFD4] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5DFD4] pb-2.5">
              <div className="flex items-center gap-2 font-bold text-[#1F2926] text-sm">
                <span className="w-6 h-6 rounded-lg bg-[#1A4E47] text-white flex items-center justify-center text-xs font-bold">
                  2
                </span>
                <span>رقم هاتف ولي الأمر (لتلقي رسائل SMS والإشعارات التلقائية)</span>
                <span className="text-rose-600 font-black">*</span>
              </div>
              {guardianPhoneVerified ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>تم تأكيد الرقم بنجاح عبر SMS ✓</span>
                </span>
              ) : (
                <span className="text-[11px] text-amber-700 font-semibold">يتم التحقق تلقائياً عبر SMS</span>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1">
                  رقم الهاتف الشخصي لولي الأمر (الأب / الأم / الولي الشرعي)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="tel"
                      value={guardianPhone}
                      onChange={(e) => {
                        setGuardianPhone(e.target.value);
                        if (guardianPhoneVerified) {
                          setGuardianPhoneVerified(false);
                        }
                      }}
                      placeholder="مثال: 0612345678 أو 0712345678"
                      className="w-full px-4 py-2.5 rounded-xl border border-[#C5DDD8] focus:border-[#1A4E47] focus:ring-2 focus:ring-[#1A4E47]/20 outline-none text-xs font-mono font-bold bg-white text-left dir-ltr"
                    />
                    <Smartphone className="w-4 h-4 text-[#1A4E47] absolute left-3 top-3 pointer-events-none" />
                  </div>
                </div>

                {/* Dispatch Action Buttons: WhatsApp & Android SMS */}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <button
                    type="button"
                    onClick={() => handleRequestVerificationCode('whatsapp')}
                    disabled={isSendingCode || !guardianPhone.trim() || (codeCountdown > 0 && !guardianPhoneVerified)}
                    className="flex-1 min-w-[200px] px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 hover:scale-[1.01]"
                    title="فتح تطبيق واتساب وإرسال رسالة التحقق الرسمية لولي الأمر مجاناً وبنقرة واحدة"
                  >
                    {isSendingCode ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>جاري التحضير...</span>
                      </>
                    ) : codeCountdown > 0 ? (
                      <span>إعادة الإرسال بعد ({codeCountdown}ث)</span>
                    ) : (
                      <>
                        <span className="text-sm">💬</span>
                        <span>إرسال الرمز عبر واتساب (مجاني وفوري)</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRequestVerificationCode('sms')}
                    disabled={isSendingCode || !guardianPhone.trim() || (codeCountdown > 0 && !guardianPhoneVerified)}
                    className="px-4 py-2.5 rounded-xl bg-white hover:bg-[#FAF8F5] text-[#1A4E47] font-bold text-xs border border-[#C5DDD8] hover:border-[#1A4E47] shadow-2xs transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                    title="إرسال رسالة نصية قصيرة SMS عبر هاتف الإدارة (Android SMS Gateway) بسعر الفورفي"
                  >
                    <Mail className="w-3.5 h-3.5 text-[#C98A3C]" />
                    <span>إرسال عبر SMS (هاتف الإدارة) 📱</span>
                  </button>
                </div>
              </div>

              {/* Verification Code Input Section */}
              {codeSent && !guardianPhoneVerified && (
                <div className="p-4 rounded-2xl bg-white border-2 border-emerald-500/40 shadow-xs space-y-3 animate-in fade-in">
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 text-xs">
                    <Mail className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-emerald-900">تم إرسال رسالة قصيرة SMS تلقائياً بنجاح!</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-bold text-[10px]">
                          المرسل: {smsNotice?.senderName || institutionName}
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-800 leading-relaxed">
                        تم إرسال رمز التحقق (OTP) في رسالة قصيرة مباشرة باسم إدارة المؤسسة إلى هاتف ولي أمرك (<strong className="font-mono">{guardianPhone}</strong>) دون الحاجة لإرسال أي شيء يدوياً.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#1F2926] block mb-1">
                      أدخل رمز التحقق (OTP) المكون من 4 أرقام المكتوب في الرسالة القصيرة SMS:
                    </label>
                    <span className="text-[11px] text-[#6C6356]">
                      اطلب من ولي أمرك قراءة رمز OTP الوارد في الرسالة النصية وأدخله هنا:
                    </span>
                  </div>

                  <div className="flex gap-2 items-center flex-wrap">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={verificationCodeInput}
                      onChange={(e) => setVerificationCodeInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="----"
                      className="w-36 px-4 py-2.5 text-center font-mono font-black text-2xl tracking-widest rounded-xl border-2 border-[#1A4E47] focus:ring-2 focus:ring-[#1A4E47]/20 outline-none bg-[#FAF8F5]"
                    />

                    <button
                      type="button"
                      onClick={handleVerifyCode}
                      disabled={isVerifyingCode || verificationCodeInput.trim().length !== 4}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isVerifyingCode ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>جاري التحقق...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>تأكيد رمز التحقق (OTP) ✓</span>
                        </>
                      )}
                    </button>

                    {smsNotice?.whatsappUrl && (
                      <a
                        href={smsNotice.whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-3 py-2 rounded-xl font-bold border border-emerald-300 transition-colors inline-flex items-center gap-1.5 shadow-2xs"
                        title="إرسال رمز التحقق مباشرة لهاتف ولي الأمر عبر تطبيق واتساب (WhatsApp)"
                      >
                        <span>💬 إرسال الرسالة لولي الأمر عبر واتساب</span>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {guardianPhoneVerified && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>تم تأكيد هاتف ولي الأمر ({guardianPhone}) بنجاح عبر خدمة الرسائل القصيرة SMS باسم المؤسسة.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setGuardianPhoneVerified(false);
                      setCodeSent(false);
                      setSmsNotice(null);
                    }}
                    className="text-[10px] text-emerald-700 underline hover:text-emerald-900 cursor-pointer"
                  >
                    تغيير الرقم
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-[#FAF8F5] p-4 sm:p-5 border-t border-[#E5DFD4] flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-[#6C6356] hidden sm:block">
            {photoUrl && guardianPhoneVerified ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>جميع الشروط مستوفاة. يمكنك الآن حفظ وتأكيد ملفك.</span>
              </span>
            ) : (
              <span>يرجى استكمال الصورة وتأكيد رقم الهاتف للمتابعة.</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#D5E2DF] text-[#6C6356] hover:bg-white font-bold text-xs cursor-pointer transition-colors"
            >
              إغلاق والمتابعة لاحقاً
            </button>

            <button
              type="button"
              onClick={handleCompleteProfile}
              disabled={isSaving || !photoUrl || !guardianPhoneVerified}
              className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                photoUrl && guardianPhoneVerified
                  ? 'bg-gradient-to-r from-[#1A4E47] to-[#133D37] hover:brightness-110 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-[#C98A3C]" />
                  <span>جاري الحفظ والتثبيت...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#C98A3C]" />
                  <span>حفظ وتثبيت المعلومات نهائياً ✓</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
