import React, { useState, useEffect } from 'react';
import {
  Camera,
  Image as ImageIcon,
  Sparkles,
  Heart,
  Calendar,
  User,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  Filter,
  Eye,
  AlertCircle,
  X,
  Upload,
  Link as LinkIcon,
  ShieldCheck,
  GraduationCap
} from 'lucide-react';
import { SchoolActivity, ActivityCategory, User as UserType } from '../types';

interface SchoolActivitiesWallProps {
  currentUser?: UserType | null;
  institutionName?: string;
  onOpenLoginModal?: () => void;
}

const CATEGORIES: ActivityCategory[] = [
  'أنشطة علمية',
  'أنشطة رياضية',
  'أنشطة ثقافية',
  'ورشات تربوية',
  'احتفالات وتكريمات',
  'رحلات مدرسية',
  'أنشطة عامة'
];

export const SchoolActivitiesWall: React.FC<SchoolActivitiesWallProps> = ({
  currentUser,
  institutionName = 'الثانوية الإعدادية ايكسان',
  onOpenLoginModal
}) => {
  const [activities, setActivities] = useState<SchoolActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  const [activeTab, setActiveTab] = useState<'approved' | 'pending'>('approved');
  
  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPhotoForPreview, setSelectedPhotoForPreview] = useState<SchoolActivity | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ActivityCategory>('أنشطة علمية');
  const [imageType, setImageType] = useState<'upload' | 'url'>('upload');
  const [imageUrl, setImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const isDirector = currentUser?.role === 'admin' || currentUser?.role === 'director';
  const isTeacher = currentUser?.role === 'teacher';

  const fetchActivities = async () => {
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams();
      if (currentUser) {
        queryParams.set('userId', currentUser.id);
        queryParams.set('userRole', currentUser.role);
      }
      const res = await fetch(`/api/activities?${queryParams.toString()}`);
      const data = await res.json();
      if (data.success) {
        setActivities(data.activities);
      }
    } catch (err) {
      console.error('Failed to fetch school activities:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [currentUser]);

  // Handle Like
  const handleLike = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // Optimistic update
      setActivities((prev) =>
        prev.map((act) => (act.id === id ? { ...act, likesCount: act.likesCount + 1 } : act))
      );
      await fetch(`/api/activities/${id}/like`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to like activity:', err);
    }
  };

  // Director Approves or Rejects Post
  const handleModerate = async (id: string, newStatus: 'approved' | 'rejected') => {
    try {
      const res = await fetch(`/api/activities/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        setActivities((prev) =>
          prev.map((act) => (act.id === id ? { ...act, status: newStatus } : act))
        );
      }
    } catch (err) {
      console.error('Failed to moderate activity:', err);
    }
  };

  // Delete Post
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذا المنشور؟')) return;

    try {
      const queryParams = new URLSearchParams();
      if (currentUser) {
        queryParams.set('userId', currentUser.id);
        queryParams.set('userRole', currentUser.role);
      }
      const res = await fetch(`/api/activities/${id}?${queryParams.toString()}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setActivities((prev) => prev.filter((act) => act.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete activity:', err);
    }
  };

  // Handle File Upload to Base64
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFormError('حجم الصورة كبير جداً، الحد الأقصى المسموح هو 5 ميغابايت');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(reader.result as string);
      setFormError(null);
    };
    reader.readAsDataURL(file);
  };

  // Handle Submit New Activity
  const handleSubmitActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!currentUser) {
      setFormError('يجب تسجيل الدخول لنشر نشاط بالمؤسسة');
      return;
    }

    if (!title.trim()) {
      setFormError('يرجى كتابة عنوان النشاط');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          imageUrl: imageUrl.trim(),
          authorId: currentUser.id,
          authorName: currentUser.fullName,
          authorRole: currentUser.role,
          authorSubject: currentUser.subject || ''
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل إرسال النشاط');
      }

      setActivities((prev) => [data.activity, ...prev]);

      if (isDirector) {
        setFormSuccess('تم نشر النشاط مباشرة على الجدار المؤسساتي بنجاح!');
      } else {
        setFormSuccess('تم إرسال النشاط بنجاح وهو الآن بانتظار موافقة وتفعيل السيد المدير!');
      }

      // Reset form fields after brief delay
      setTimeout(() => {
        setTitle('');
        setDescription('');
        setImageUrl('');
        setIsCreateModalOpen(false);
        setFormSuccess(null);
      }, 1800);
    } catch (err: any) {
      setFormError(err.message || 'حدث خطأ أثناء الإرسال');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered lists
  const pendingActivities = activities.filter((act) => act.status === 'pending');
  const approvedActivities = activities.filter((act) => act.status === 'approved');

  const displayedList = (activeTab === 'pending' && isDirector ? pendingActivities : approvedActivities).filter(
    (act) => selectedCategory === 'الكل' || act.category === selectedCategory
  );

  return (
    <section className="w-full mt-12 mb-6 font-['Tajawal',sans-serif]" dir="rtl">
      
      {/* Container with sleek Moroccan institutional styling */}
      <div className="bg-white rounded-3xl border border-[#E5DFD4] shadow-md p-6 sm:p-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#E5DFD4]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-[#E8F2F0] text-[#1A4E47] flex items-center justify-center font-bold border border-[#1A4E47]/20 shadow-xs">
                <Camera className="w-5 h-5 text-[#1A4E47]" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#1F2926] font-['Amiri',serif] m-0">
                فضاء أنشطة وصور المؤسسة
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#6C6356] m-0">
              توثيق الحياة المدرسية والأنشطة التربوية، العلمية، الرياضية والورشات التشاركية بالثانوية الإعدادية ايكسان
            </p>
          </div>

          {/* Action Button */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {currentUser ? (
              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setFormSuccess(null);
                  setIsCreateModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white text-xs sm:text-sm font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#C98A3C]" />
                <span>نشر نشاط أو صورة جديدة</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenLoginModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FAF8F5] hover:bg-[#E8F2F0] border border-[#D5CDC0] text-[#1A4E47] text-xs font-bold transition-all cursor-pointer"
                title="تسجيل الدخول للمشاركة في النشر"
              >
                <Camera className="w-4 h-4 text-[#C98A3C]" />
                <span>دخول الأساتذة والإدارة للمشاركة</span>
              </button>
            )}
          </div>
        </div>

        {/* Director Moderation Notification Banner */}
        {isDirector && pendingActivities.length > 0 && (
          <div className="mt-5 p-4 rounded-2xl bg-amber-50 border border-amber-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-amber-900 m-0">
                  منشورات جديدة بانتظار موافقة وتأشير السيد المدير ({pendingActivities.length})
                </h4>
                <p className="text-[11px] text-amber-800 m-0">
                  قدم الأساتذة أنشطة وصوراً جديدة تحتاج إلى اعتمادك وموافقتك لتظهر على الجدار العام.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('pending')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'pending'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white text-amber-900 border border-amber-300 hover:bg-amber-100'
                }`}
              >
                معاينة المنشورات المعلقة ({pendingActivities.length})
              </button>
              {activeTab === 'pending' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('approved')}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-gray-700 border border-gray-300 hover:bg-gray-100 cursor-pointer"
                >
                  الرجوع للمنشورات المعتمدة
                </button>
              )}
            </div>
          </div>
        )}

        {/* Categories Bar & View Tabs */}
        <div className="flex items-center justify-between gap-3 flex-wrap mt-6 pb-2">
          {/* Categories pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none max-w-full">
            <button
              type="button"
              onClick={() => setSelectedCategory('الكل')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                selectedCategory === 'الكل'
                  ? 'bg-[#1A4E47] text-white shadow-xs'
                  : 'bg-[#FAF8F5] text-[#6C6356] border border-[#E5DFD4] hover:bg-[#F2EFE9]'
              }`}
            >
              الكل ({activities.filter((a) => a.status === 'approved').length})
            </button>
            {CATEGORIES.map((cat) => {
              const count = activities.filter((a) => a.status === 'approved' && a.category === cat).length;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-[#1A4E47] text-white shadow-xs'
                      : 'bg-[#FAF8F5] text-[#6C6356] border border-[#E5DFD4] hover:bg-[#F2EFE9]'
                  }`}
                >
                  {cat} {count > 0 && `(${count})`}
                </button>
              );
            })}
          </div>

          {/* Tab indicators for Director */}
          {isDirector && (
            <div className="flex items-center gap-1 bg-[#FAF8F5] p-1 rounded-xl border border-[#E5DFD4] text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('approved')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  activeTab === 'approved' ? 'bg-[#1A4E47] text-white' : 'text-[#6C6356]'
                }`}
              >
                المعتمدة ({approvedActivities.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('pending')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'pending' ? 'bg-amber-600 text-white' : 'text-[#6C6356]'
                }`}
              >
                <span>المعلقة</span>
                {pendingActivities.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 text-[10px] font-bold">
                    {pendingActivities.length}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Activities Grid */}
        {isLoading ? (
          <div className="py-16 text-center text-xs text-[#6C6356]">
            <div className="w-8 h-8 border-2 border-[#1A4E47] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span>جارٍ تحميل ألبوم أنشطة المؤسسة...</span>
          </div>
        ) : displayedList.length === 0 ? (
          <div className="py-14 text-center rounded-2xl bg-[#FAF8F5] border border-dashed border-[#D5CDC0] mt-4 space-y-2">
            <ImageIcon className="w-10 h-10 text-[#6C6356]/40 mx-auto" />
            <h4 className="text-sm font-bold text-[#1F2926]">لا توجد أنشطة في هذا التصنيف حالياً</h4>
            <p className="text-xs text-[#6C6356]">
              يمكن للأساتذة والإدارة إضافة وتوثيق أول نشاط بالضغط على زر "نشر نشاط أو صورة جديدة" أعلاه.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            {displayedList.map((activity) => (
              <article
                key={activity.id}
                className="group bg-[#FAF8F5] rounded-2xl border border-[#E5DFD4] hover:border-[#1A4E47]/40 shadow-xs hover:shadow-md transition-all flex flex-col overflow-hidden"
              >
                {/* Image Container */}
                <div
                  onClick={() => setSelectedPhotoForPreview(activity)}
                  className="relative aspect-[16/10] bg-[#EAE6DC] overflow-hidden cursor-pointer"
                >
                  {activity.imageUrl ? (
                    <img
                      src={activity.imageUrl}
                      alt={activity.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[#6C6356]/60 gap-1">
                      <Camera className="w-8 h-8" />
                      <span className="text-[11px]">بدون صورة مرفقة</span>
                    </div>
                  )}

                  {/* Category Pill Over Image */}
                  <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold">
                    {activity.category}
                  </span>

                  {/* Pending Approval Badge */}
                  {activity.status === 'pending' && (
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center gap-1 shadow-sm">
                      <Clock className="w-3 h-3" />
                      <span>قيد مراجعة المدير</span>
                    </span>
                  )}
                </div>

                {/* Body Content */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-[#6C6356]">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(activity.createdAt).toLocaleDateString('ar-MA', {
                          timeZone: 'UTC',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                      <span className="text-[10px] font-semibold text-[#1A4E47] bg-[#E8F2F0] px-2 py-0.5 rounded-md">
                        {activity.authorRole === 'admin' ? 'إشراف الإدارة' : activity.authorSubject || 'أستاذ(ة)'}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-[#1F2926] leading-snug line-clamp-2">
                      {activity.title}
                    </h3>

                    {activity.description && (
                      <p className="text-xs text-[#6C6356] leading-relaxed line-clamp-3">
                        {activity.description}
                      </p>
                    )}
                  </div>

                  {/* Footer & Interactions */}
                  <div className="pt-3 border-t border-[#E5DFD4] flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-[#1F2926]">
                      <div className="w-6 h-6 rounded-full bg-[#E8F2F0] text-[#1A4E47] flex items-center justify-center font-bold text-[10px]">
                        {activity.authorRole === 'admin' ? (
                          <ShieldCheck className="w-3.5 h-3.5 text-[#C98A3C]" />
                        ) : (
                          <GraduationCap className="w-3.5 h-3.5 text-[#1A4E47]" />
                        )}
                      </div>
                      <span className="text-[11px] font-semibold truncate max-w-[130px]">
                        {activity.authorName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Like button */}
                      <button
                        type="button"
                        onClick={(e) => handleLike(activity.id, e)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 border border-[#E5DFD4] text-[#6C6356] hover:text-rose-600 transition-colors text-xs font-semibold cursor-pointer"
                        title="إعجاب بالنشاط"
                      >
                        <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500/20" />
                        <span>{activity.likesCount}</span>
                      </button>

                      {/* Delete button (for Director or author) */}
                      {(isDirector || (currentUser && currentUser.id === activity.authorId)) && (
                        <button
                          type="button"
                          onClick={(e) => handleDelete(activity.id, e)}
                          className="p-1 rounded-lg text-[#6C6356] hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="حذف المنشور"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Director Approval Controls on Pending Card */}
                  {isDirector && activity.status === 'pending' && (
                    <div className="pt-2 border-t border-amber-200 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleModerate(activity.id, 'approved')}
                        className="py-1.5 px-2 rounded-lg bg-[#1A4E47] hover:bg-[#133D37] text-white text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#C98A3C]" />
                        <span>موافقة ونشر</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleModerate(activity.id, 'rejected')}
                        className="py-1.5 px-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>رفض النشاط</span>
                      </button>
                    </div>
                  )}

                </div>
              </article>
            ))}
          </div>
        )}

      </div>

      {/* 1. Modal: Create New Activity */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-[#E5DFD4] shadow-2xl overflow-hidden animate-scaleUp">
            
            {/* Modal Header */}
            <div className="p-5 bg-[#1A4E47] text-white flex items-center justify-between border-b border-[#C98A3C]/40">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#133D37] border border-[#C98A3C]/40 flex items-center justify-center text-[#C98A3C]">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-['Amiri',serif] m-0">
                    نشر نشاط أو حدث مدرسي
                  </h3>
                  <p className="text-[11px] text-[#F2EFE3]/80 m-0">
                    {institutionName} • توثيق الأنشطة المدرسية
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitActivity} className="p-6 space-y-4">
              
              {/* Institutional Notice */}
              {isTeacher ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                  <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    <strong>تنبيه تربوي:</strong> وفق الضوابط المعتمدة، سيتم إرسال المنشور إلى <strong>السيد المدير</strong> لمراجعته والموافقة عليه قبل ظهوره على الجدار للعموم.
                  </span>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-[#E8F2F0] border border-[#1A4E47]/20 text-[#1A4E47] text-xs flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#C98A3C] shrink-0" />
                  <span>بصفتك المشرف العام/المدير، سيتم نشر هذا النشاط مباشرة على الجدار العام.</span>
                </div>
              )}

              {/* Error & Success Messages */}
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1">
                  عنوان النشاط أو الحدث المدرسي <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: دوري كرة القدم، ورشة العلوم والتجارب، حفل تكريم..."
                  className="w-full bg-[#FAF8F5] border border-[#D5CDC0] rounded-xl px-3 py-2.5 text-sm text-[#1F2926] outline-none focus:border-[#1A4E47] focus:bg-white"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1">
                  مجال النشاط
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ActivityCategory)}
                  className="w-full bg-[#FAF8F5] border border-[#D5CDC0] rounded-xl px-3 py-2.5 text-sm text-[#1F2926] outline-none focus:border-[#1A4E47] focus:bg-white"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Image Input Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#1F2926]">
                    صورة النشاط (اختياري)
                  </label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setImageType('upload')}
                      className={`px-2 py-0.5 rounded cursor-pointer ${
                        imageType === 'upload' ? 'bg-[#1A4E47] text-white font-bold' : 'text-[#6C6356]'
                      }`}
                    >
                      رفع ملف
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageType('url')}
                      className={`px-2 py-0.5 rounded cursor-pointer ${
                        imageType === 'url' ? 'bg-[#1A4E47] text-white font-bold' : 'text-[#6C6356]'
                      }`}
                    >
                      رابط صورة
                    </button>
                  </div>
                </div>

                {imageType === 'upload' ? (
                  <label className="border-2 border-dashed border-[#D5CDC0] hover:border-[#1A4E47] rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-[#FAF8F5] hover:bg-white transition-colors">
                    <Upload className="w-5 h-5 text-[#1A4E47]" />
                    <span className="text-xs text-[#1F2926] font-semibold">
                      اضغط لاختيار صورة من جهازك
                    </span>
                    <span className="text-[10px] text-[#6C6356]">PNG, JPG حتى 5MB</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="relative">
                    <input
                      type="url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://example.com/photo.jpg"
                      className="w-full bg-[#FAF8F5] border border-[#D5CDC0] rounded-xl pr-9 pl-3 py-2 text-xs text-[#1F2926] outline-none focus:border-[#1A4E47] focus:bg-white font-mono"
                    />
                    <LinkIcon className="w-4 h-4 text-[#6C6356] absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                )}

                {/* Preview Thumbnail if selected */}
                {imageUrl && (
                  <div className="mt-2 relative w-24 h-16 rounded-lg overflow-hidden border border-[#D5CDC0]">
                    <img src={imageUrl} alt="معاينة" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="absolute top-1 left-1 p-0.5 bg-black/60 rounded text-white hover:bg-black"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-[#1F2926] mb-1">
                  وصف مختصر وتفاصيل النشاط
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="اكتب نبذة عن أهداف النشاط، الفئات المستهدفة، أو أسماء المؤطرين المشاركين..."
                  className="w-full bg-[#FAF8F5] border border-[#D5CDC0] rounded-xl px-3 py-2 text-xs text-[#1F2926] outline-none focus:border-[#1A4E47] focus:bg-white leading-relaxed resize-none"
                />
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[#E5DFD4]">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#FAF8F5] hover:bg-[#EAE6DC] text-[#6C6356] text-xs font-bold transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#1A4E47] hover:bg-[#133D37] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>جارٍ الإرسال...</span>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-[#C98A3C]" />
                      <span>{isDirector ? 'نشر مباشر' : 'إرسال للمدير للاعتماد'}</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 2. Photo Lightbox Modal */}
      {selectedPhotoForPreview && (
        <div
          onClick={() => setSelectedPhotoForPreview(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl bg-white rounded-3xl overflow-hidden shadow-2xl animate-scaleUp"
          >
            <div className="relative bg-black flex items-center justify-center max-h-[65vh]">
              {selectedPhotoForPreview.imageUrl ? (
                <img
                  src={selectedPhotoForPreview.imageUrl}
                  alt={selectedPhotoForPreview.title}
                  className="w-full max-h-[65vh] object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="py-20 text-white/50 flex flex-col items-center gap-2">
                  <Camera className="w-12 h-12" />
                  <span>لا توجد صورة لهذا الحدث</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => setSelectedPhotoForPreview(null)}
                className="absolute top-3 left-3 p-1.5 rounded-full bg-black/60 text-white hover:bg-black transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full bg-[#E8F2F0] text-[#1A4E47] text-xs font-bold">
                  {selectedPhotoForPreview.category}
                </span>
                <span className="text-xs text-[#6C6356]">
                  {new Date(selectedPhotoForPreview.createdAt).toLocaleDateString('ar-MA', {
                    timeZone: 'UTC',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>

              <h2 className="text-lg sm:text-xl font-bold text-[#1F2926] font-['Amiri',serif]">
                {selectedPhotoForPreview.title}
              </h2>

              {selectedPhotoForPreview.description && (
                <p className="text-xs sm:text-sm text-[#483F33] leading-relaxed">
                  {selectedPhotoForPreview.description}
                </p>
              )}

              <div className="pt-3 border-t border-[#E5DFD4] flex items-center justify-between text-xs text-[#6C6356]">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-[#1F2926]">الناشر:</span>
                  <span>{selectedPhotoForPreview.authorName}</span>
                  {selectedPhotoForPreview.authorSubject && (
                    <span className="text-[#1A4E47]">({selectedPhotoForPreview.authorSubject})</span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-rose-600 font-bold">
                  <Heart className="w-4 h-4 fill-rose-500" />
                  <span>{selectedPhotoForPreview.likesCount} إعجاب</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </section>
  );
};
