import React, { useState, useEffect } from 'react';
import {
  Users,
  Eye,
  Activity,
  Smartphone,
  Monitor,
  Tablet,
  Globe,
  Clock,
  RefreshCw,
  Trash2,
  Search,
  Filter,
  CheckCircle2,
  Shield,
  GraduationCap,
  Building,
  UserCheck
} from 'lucide-react';
import { User } from '../types';

interface VisitorItem {
  id: number;
  visitorId: string;
  userId: string;
  visitorType: 'admin' | 'director' | 'teacher' | 'guest' | string;
  userName: string;
  userEmail: string;
  subject: string;
  ipAddress: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | string;
  browser: string;
  os: string;
  path: string;
  pageTitle: string;
  createdAt: string;
  lastSeenAt: string;
  visitCount: number;
  isOnline: boolean;
}

interface VisitorStats {
  totalVisitors: number;
  totalVisits: number;
  onlineNow: number;
  countsByType: {
    guest: number;
    teacher: number;
    director: number;
    admin: number;
  };
  countsByDevice: {
    desktop: number;
    mobile: number;
    tablet: number;
  };
  recentVisitors: VisitorItem[];
}

interface VisitorManagementProps {
  currentUser: User;
}

export const VisitorManagement: React.FC<VisitorManagementProps> = ({ currentUser }) => {
  const [data, setData] = useState<VisitorStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'online' | 'teacher' | 'director' | 'guest'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchStats = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const res = await fetch('/api/visitors/stats', {
        headers: {
          'x-user-role': currentUser.role || '',
          'x-user-id': currentUser.id || ''
        }
      });
      const json = await res.json();
      if (json.success) {
        setData({
          totalVisitors: json.totalVisitors || 0,
          totalVisits: json.totalVisits || 0,
          onlineNow: json.onlineNow || 0,
          countsByType: json.countsByType || { guest: 0, teacher: 0, director: 0, admin: 0 },
          countsByDevice: json.countsByDevice || { desktop: 0, mobile: 0, tablet: 0 },
          recentVisitors: json.recentVisitors || []
        });
      }
    } catch (err: any) {
      console.error('Failed to load visitor stats:', err);
    } finally {
      setIsLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const timer = setInterval(() => fetchStats(false), 30000); // 30 sec auto-refresh
    return () => clearInterval(timer);
  }, []);

  const handleClearLogs = async () => {
    if (!window.confirm('هل أنت متأكد من رغبتك في مسح كافة سجلات الزوار السابقة؟')) return;
    try {
      const res = await fetch('/api/visitors/logs', {
        method: 'DELETE',
        headers: {
          'x-user-role': currentUser.role || '',
          'x-user-id': currentUser.id || ''
        }
      });
      const json = await res.json();
      if (json.success) {
        setFeedbackMsg({ text: 'تم مسح سجلات الزوار بنجاح', type: 'success' });
        setTimeout(() => setFeedbackMsg(null), 3000);
        fetchStats(true);
      }
    } catch {
      setFeedbackMsg({ text: 'تعذر مسح السجلات', type: 'error' });
    }
  };

  const formatTimeAgo = (isoString: string): string => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return 'الآن';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `منذ ${diffHours} ساعة`;
      const diffDays = Math.floor(diffHours / 24);
      return `منذ ${diffDays} يوم`;
    } catch {
      return isoString;
    }
  };

  const filteredVisitors = (data?.recentVisitors || []).filter((v) => {
    // Type filter
    if (filterType === 'online' && !v.isOnline) return false;
    if (filterType === 'teacher' && v.visitorType !== 'teacher') return false;
    if (filterType === 'director' && v.visitorType !== 'director' && v.visitorType !== 'admin') return false;
    if (filterType === 'guest' && v.visitorType !== 'guest') return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = (v.userName || '').toLowerCase().includes(q);
      const matchEmail = (v.userEmail || '').toLowerCase().includes(q);
      const matchIp = (v.ipAddress || '').toLowerCase().includes(q);
      const matchDevice = (v.browser || '').toLowerCase().includes(q) || (v.os || '').toLowerCase().includes(q);
      return matchName || matchEmail || matchIp || matchDevice;
    }
    return true;
  });

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Header Banner */}
      <div className="bg-[#FBF8EF] border border-[#E4DBC0] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#1A4E47] text-white flex items-center justify-center shrink-0 shadow-sm">
            <Eye className="w-6 h-6 text-emerald-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold font-serif text-[#2A2118]">
                إحصائيات زوار الموقع — مدير التطبيق (Admin)
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>تتبع حي وفوري</span>
              </span>
            </div>
            <p className="text-xs text-[#7A6B58] mt-0.5">
              لوحة مخصصة حصرياً لمدير التطبيق (Admin) للاطلاع على تفاصيل ومعلومات زوار المنظومة (أساتذة، مدراء، وزوار عاديون)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => fetchStats(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#F4EFDE] text-[#2A2118] border border-[#D9CEB0] text-xs font-bold transition-all cursor-pointer shadow-2xs"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#1A4E47] ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>تحديث السجل</span>
          </button>

          {currentUser.role === 'admin' && (
            <button
              type="button"
              onClick={handleClearLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold transition-colors cursor-pointer"
              title="مسح سجل الزوار"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>مسح السجلات</span>
            </button>
          )}
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* 1. إجمالي الزوار */}
        <div className="bg-[#FBF8EF] border border-[#E4DBC0] rounded-xl p-3 sm:p-4 text-right">
          <div className="flex items-center justify-between text-xs font-bold text-[#7A6B58] mb-1">
            <span>إجمالي الزوار</span>
            <Users className="w-4 h-4 text-[#1A4E47]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-serif text-[#1A4E47]">
            {isLoading ? '...' : (data?.totalVisitors || 0)}
          </div>
          <div className="text-[10px] text-[#7A6B58] mt-1">
            {data?.totalVisits || 0} زيارة وتصفح
          </div>
        </div>

        {/* 2. متصلون الآن */}
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 sm:p-4 text-right">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-900 mb-1">
            <span>نشطون الآن 🟢</span>
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-serif text-emerald-700">
            {isLoading ? '...' : (data?.onlineNow || 0)}
          </div>
          <div className="text-[10px] text-emerald-800 mt-1">
            متصل خلال 15 دقيقة
          </div>
        </div>

        {/* 3. الأساتذة */}
        <div className="bg-[#FBF8EF] border border-[#E4DBC0] rounded-xl p-3 sm:p-4 text-right">
          <div className="flex items-center justify-between text-xs font-bold text-[#7A6B58] mb-1">
            <span>الأساتذة الزوار</span>
            <GraduationCap className="w-4 h-4 text-[#2D5A27]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-serif text-[#2D5A27]">
            {isLoading ? '...' : (data?.countsByType?.teacher || 0)}
          </div>
          <div className="text-[10px] text-[#7A6B58] mt-1">
            أساتذة مسجلون
          </div>
        </div>

        {/* 4. الإدارة والمدراء */}
        <div className="bg-[#FBF8EF] border border-[#E4DBC0] rounded-xl p-3 sm:p-4 text-right">
          <div className="flex items-center justify-between text-xs font-bold text-[#7A6B58] mb-1">
            <span>المدراء والإدارة</span>
            <Building className="w-4 h-4 text-[#C98A3C]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-serif text-[#C98A3C]">
            {isLoading ? '...' : ((data?.countsByType?.director || 0) + (data?.countsByType?.admin || 0))}
          </div>
          <div className="text-[10px] text-[#7A6B58] mt-1">
            إدارة المؤسسة والتطبيق
          </div>
        </div>

        {/* 5. زوار عاديون */}
        <div className="bg-[#FBF8EF] border border-[#E4DBC0] rounded-xl p-3 sm:p-4 text-right col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-xs font-bold text-[#7A6B58] mb-1">
            <span>زوار عاديون (ضيوف)</span>
            <Globe className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-serif text-[#5B5040]">
            {isLoading ? '...' : (data?.countsByType?.guest || 0)}
          </div>
          <div className="text-[10px] text-[#7A6B58] mt-1">
            مستخدمون غير مسجلين
          </div>
        </div>
      </div>

      {/* Device summary & Search Bar */}
      <div className="bg-white border border-[#E4DBC0] rounded-2xl p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterType === 'all'
                  ? 'bg-[#1A4E47] text-white shadow-xs'
                  : 'bg-[#F4EFDE] text-[#5B5040] hover:text-[#2A2118]'
              }`}
            >
              كافة الزوار ({data?.recentVisitors?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('online')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                filterType === 'online'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-[#F4EFDE] text-[#5B5040] hover:text-[#2A2118]'
              }`}
            >
              <span>متصلون الآن</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-200 text-emerald-950 font-bold">
                {data?.onlineNow || 0}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFilterType('teacher')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterType === 'teacher'
                  ? 'bg-[#2D5A27] text-white shadow-xs'
                  : 'bg-[#F4EFDE] text-[#5B5040] hover:text-[#2A2118]'
              }`}
            >
              الأساتذة ({data?.countsByType?.teacher || 0})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('director')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterType === 'director'
                  ? 'bg-[#C98A3C] text-white shadow-xs'
                  : 'bg-[#F4EFDE] text-[#5B5040] hover:text-[#2A2118]'
              }`}
            >
              المدراء ({((data?.countsByType?.director || 0) + (data?.countsByType?.admin || 0))})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('guest')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterType === 'guest'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'bg-[#F4EFDE] text-[#5B5040] hover:text-[#2A2118]'
              }`}
            >
              زوار عاديون ({data?.countsByType?.guest || 0})
            </button>
          </div>

          {/* Device Types Pills */}
          <div className="flex items-center gap-2 text-xs font-bold text-[#7A6B58]">
            <span className="flex items-center gap-1 bg-[#F4EFDE] px-2 py-1 rounded-lg">
              <Monitor className="w-3.5 h-3.5 text-[#1A4E47]" />
              <span>حاسوب: {data?.countsByDevice?.desktop || 0}</span>
            </span>
            <span className="flex items-center gap-1 bg-[#F4EFDE] px-2 py-1 rounded-lg">
              <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
              <span>هاتف: {data?.countsByDevice?.mobile || 0}</span>
            </span>
            {data?.countsByDevice?.tablet ? (
              <span className="flex items-center gap-1 bg-[#F4EFDE] px-2 py-1 rounded-lg">
                <Tablet className="w-3.5 h-3.5 text-amber-600" />
                <span>لوحة: {data.countsByDevice.tablet}</span>
              </span>
            ) : null}
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 text-[#7A6B58] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="بحث باسم الزائر، البريد، عنوان IP، أو نوع الجهاز..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-9 pl-3 py-2 text-xs font-bold rounded-xl border border-[#D9CEB0] bg-[#FAF8F5] text-[#2A2118] focus:outline-hidden focus:border-[#1A4E47] focus:bg-white"
          />
        </div>
      </div>

      {/* Visitors List Table */}
      <div className="bg-white border border-[#E4DBC0] rounded-2xl overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center text-xs font-bold text-[#7A6B58] flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-[#1A4E47]" />
            <span>جاري تحميل سجلات زوار الموقع...</span>
          </div>
        ) : filteredVisitors.length === 0 ? (
          <div className="p-12 text-center text-[#7A6B58]">
            <Users className="w-10 h-10 mx-auto mb-2 text-[#D9CEB0]" />
            <div className="font-bold text-xs text-[#2A2118]">لا توجد سجلات زوار مطابقة</div>
            <div className="text-[11px] text-[#7A6B58] mt-0.5">لم يتم تسجيل أي زيارات مطابقة للتصفية الحالية.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-[#EFE9D5] text-[#2A2118] border-b border-[#D9CEB0]">
                  <th className="p-3 font-bold w-12 text-center">#</th>
                  <th className="p-3 font-bold">نوع الزائر</th>
                  <th className="p-3 font-bold">هوية الزائر / الحساب</th>
                  <th className="p-3 font-bold">الجهاز والمتصفح</th>
                  <th className="p-3 font-bold">عنوان IP</th>
                  <th className="p-3 font-bold">الصفحة / المسار</th>
                  <th className="p-3 font-bold text-center">النشاط الأخير</th>
                  <th className="p-3 font-bold text-center">عدد الزيارات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4DBC0]">
                {filteredVisitors.map((v, idx) => (
                  <tr key={v.id || idx} className="hover:bg-[#FAF8F2] transition-colors">
                    <td className="p-3 text-center font-bold text-[#7A6B58]">{idx + 1}</td>

                    {/* Visitor Type Badge */}
                    <td className="p-3">
                      {v.visitorType === 'admin' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          <Shield className="w-3 h-3 text-amber-700" />
                          <span>مدير التطبيق</span>
                        </span>
                      ) : v.visitorType === 'director' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                          <Building className="w-3 h-3 text-emerald-700" />
                          <span>مدير المؤسسة</span>
                        </span>
                      ) : v.visitorType === 'teacher' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#E8F2F0] text-[#1A4E47] border border-[#B9D8D2]">
                          <GraduationCap className="w-3 h-3 text-[#1A4E47]" />
                          <span>أستاذ(ة)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                          <Globe className="w-3 h-3 text-slate-500" />
                          <span>زائر عادي</span>
                        </span>
                      )}
                    </td>

                    {/* User Identity */}
                    <td className="p-3">
                      {v.userName ? (
                        <div>
                          <div className="font-bold text-[#2A2118] text-[13px]">{v.userName}</div>
                          {v.subject && (
                            <span className="text-[11px] text-[#2D5A27] font-semibold">مادة {v.subject}</span>
                          )}
                          {v.userEmail && (
                            <div className="text-[10px] text-[#7A6B58] font-mono">{v.userEmail}</div>
                          )}
                        </div>
                      ) : (
                        <div className="text-[#7A6B58]">
                          <span className="font-bold text-slate-700">زائر ضيف</span>
                          <span className="text-[10px] font-mono block text-slate-400">
                            #{v.visitorId.slice(0, 14)}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Device & Browser */}
                    <td className="p-3 text-[#2A2118]">
                      <div className="flex items-center gap-1.5 font-bold">
                        {v.deviceType === 'mobile' ? (
                          <Smartphone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : v.deviceType === 'tablet' ? (
                          <Tablet className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        ) : (
                          <Monitor className="w-3.5 h-3.5 text-[#1A4E47] shrink-0" />
                        )}
                        <span>{v.os || 'نظام غير معروف'}</span>
                      </div>
                      <div className="text-[11px] text-[#7A6B58] mt-0.5">
                        {v.browser || 'متصفح'}
                      </div>
                    </td>

                    {/* IP Address */}
                    <td className="p-3 font-mono font-bold text-xs text-slate-700">
                      {v.ipAddress ? (
                        <span className="bg-[#FAF8F5] border border-[#D9CEB0] px-2 py-0.5 rounded-md">
                          {v.ipAddress === '::1' || v.ipAddress === '127.0.0.1' ? 'محلي (Localhost)' : v.ipAddress}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* Visited Page */}
                    <td className="p-3 text-xs text-[#5B5040]">
                      <span className="bg-[#F4EFDE] px-2 py-0.5 rounded-md font-mono text-[11px]">
                        {v.path || '/'}
                      </span>
                    </td>

                    {/* Online status / Last seen */}
                    <td className="p-3 text-center">
                      {v.isOnline ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span>متصل الآن</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#7A6B58] flex items-center justify-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatTimeAgo(v.lastSeenAt)}</span>
                        </span>
                      )}
                    </td>

                    {/* Visit Count */}
                    <td className="p-3 text-center font-mono font-bold text-xs text-[#1A4E47]">
                      {v.visitCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
