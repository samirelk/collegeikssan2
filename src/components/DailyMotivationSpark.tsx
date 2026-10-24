import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Lightbulb,
  Quote,
  Copy,
  Check,
  Star,
  Shuffle,
  Calendar,
  Share2,
  ChevronRight,
  ChevronLeft,
  X,
  Flame,
  Award
} from 'lucide-react';

export interface MotivationalQuote {
  id: number;
  text: string;
  author: string;
  category: 'العلم والاجتهاد' | 'تنظيم الوقت' | 'الإصرار والمثابرة' | 'الأخلاق والقدوة' | 'التفوق والنجاح';
  practicalTip: string;
}

export const MOTIVATIONAL_QUOTES: MotivationalQuote[] = [
  {
    id: 1,
    text: 'تعلَم فليسَ المرءُ يُولدُ عالِماً، وليسَ أخو عِلمٍ كمن هو جاهلُ.',
    author: 'الإمام الشافعي',
    category: 'العلم والاجتهاد',
    practicalTip: 'ابدأ يومك بنية صادقة لتعلم معلومة جديدة اليوم في حصصك ولم تكن تعرفها من قبل.'
  },
  {
    id: 2,
    text: 'الوقت كالسيف، إن لم تقطعه قطعك.',
    author: 'حكمة مأثورة',
    category: 'تنظيم الوقت',
    practicalTip: 'قسّم فترة مراجعتك المسائية إلى فترات مدة كل منها 25 دقيقة تركيز دون تشتت بالهاتف.'
  },
  {
    id: 3,
    text: 'ليس العيب أن نسقط، ولكن العار أن لا نستطيع النهوض.',
    author: 'حكمة عربية',
    category: 'الإصرار والمثابرة',
    practicalTip: 'إذا تعثرت في تمرين أو فرض سابق، راجع تصحيحه اليوم فوراً لتجعله نقطة انطلاق جديدة.'
  },
  {
    id: 4,
    text: 'من سلك طريقاً يلتمس فيه علماً، سهل الله له به طريقاً إلى الجنة.',
    author: 'حديث نبوي شريف',
    category: 'العلم والاجتهاد',
    practicalTip: 'تذكر دائماً أن جهدك في قاعة الدرس عبادة وعمل صالح ترقى به عند الله ومجتمعك.'
  },
  {
    id: 5,
    text: 'النجاح هو مجموع مجهودات صغيرة تتكرر يوماً بعد يوم دون انقطاع.',
    author: 'روبرت كولير',
    category: 'التفوق والنجاح',
    practicalTip: 'حل تمرينين اثنين فقط بتركيز كل مساء يجعلك متفوقاً في نهاية الدورة بلا أدنى شك.'
  },
  {
    id: 6,
    text: 'العلم في الصغر كالنقش على الحجر.',
    author: 'مثل مغربي مأثور',
    category: 'العلم والاجتهاد',
    practicalTip: 'دوّن الملاحظات الأساسية التي يؤكد عليها أستاذك في دفتر جانبي أثناء الشرح.'
  },
  {
    id: 7,
    text: 'إنما الأمم الأخلاق ما بقيت، فإن هم ذهبت أخلاقهم ذهبوا.',
    author: 'أحمد شوقي',
    category: 'الأخلاق والقدوة',
    practicalTip: 'بادر اليوم بتحية أستاذك بابتسامة وكن عوناً لزميلك المحتاج للمساعدة في القسم.'
  },
  {
    id: 8,
    text: 'لا تؤجل عمل اليوم إلى الغد، فالغد له واجباته الخاصة.',
    author: 'حكمة مأثورة',
    category: 'تنظيم الوقت',
    practicalTip: 'أنجز الواجب المنزلي اليوم بمجرد عودتك للمنزل حتى تفرغ ذهنك وتنام مرتاح البال.'
  },
  {
    id: 9,
    text: 'الهمة العالية تغلي في القلوب غليان المرجل، وتدفع صاحبها لمعالي الأمور.',
    author: 'ابن القيم',
    category: 'الإصرار والمثابرة',
    practicalTip: 'ضع لنفسك هدفاً واضحاً في معدل الفرض القادم ولا ترضَ بأقل من قدراتك الحقيقية.'
  },
  {
    id: 10,
    text: 'على قدر أهل العزم تأتي العزائم، وتأتي على قدر الكرام المكارم.',
    author: 'أبو الطيب المتنبي',
    category: 'الإصرار والمثابرة',
    practicalTip: 'واجه المواد التي تشعر فيها بصعوبة كأنها تحدٍ بطولي، واسأل أستاذك دون حرج.'
  },
  {
    id: 11,
    text: 'أعز مكان في الدنى سرج سابح، وخير جليس في الزمان كتاب.',
    author: 'المتنبي',
    category: 'العلم والاجتهاد',
    practicalTip: 'اقرأ 5 صفحات من كتاب أدبي أو علمي خارج المقرر الدراسي لتنمي رصيدك المعرفي.'
  },
  {
    id: 12,
    text: 'التنظيم نصف النجاح، فالمكتب المرتب عقلٌ مرتب ومستقبل مشرق.',
    author: 'حكمة أكاديمية',
    category: 'تنظيم الوقت',
    practicalTip: 'رتب محفظتك ومكتبك الليلة قبل النوم وتأكد من تجهيز دفاتر جدول الغد.'
  },
  {
    id: 13,
    text: 'الانضباط هو الجسر الرابط بين الأهداف والإنجازات الملموسة.',
    author: 'جيم رون',
    category: 'التفوق والنجاح',
    practicalTip: 'حضورك في الوقت المحدد يمنحك هدوءاً نفسياً ويجعل الأستاذ يقدّر جديتك.'
  },
  {
    id: 14,
    text: 'التواضع في طلب العلم يرفع صاحبه إلى أعلى المراتب.',
    author: 'الحسن البصري',
    category: 'الأخلاق والقدوة',
    practicalTip: 'لا تخجل من قول "لم أفهم يا أستاذ"، فالسؤال مفتاح العلم والحكمة.'
  },
  {
    id: 15,
    text: 'التعليم جواز السفر إلى المستقبل، فالغد ينتمي للذين يستعدون له اليوم.',
    author: 'مالكوم إكس',
    category: 'العلم والاجتهاد',
    practicalTip: 'فكر في المهنة أو الطموح الذي تحلم به في المستقبل واجعل درس اليوم خطوة نحوه.'
  },
  {
    id: 16,
    text: 'لا يقاس النجاح بالموقع الذي يتبوأه المرء في حياته، بل بالصعاب التي تغلب عليها.',
    author: 'بوكر واشنطن',
    category: 'الإصرار والمثابرة',
    practicalTip: 'افتخر بكل خطأ اكتشفته وصححته بنفسك، فهو دليل واضح على أنك تتقدم.'
  },
  {
    id: 17,
    text: 'من لم يذق مر التعلم ساعةً، تجرع ذل الجهل طول حياته.',
    author: 'الإمام الشافعي',
    category: 'العلم والاجتهاد',
    practicalTip: 'الصبر على المذاكرة ساعة واحدة يمنحك فخراً وفرحة تدوم طوال العام الدراسي.'
  },
  {
    id: 18,
    text: 'نظّم يومك بحكمة: ساعة للجد، وساعة للراحة، وساعة للأسرة، وساعة للعبادة.',
    author: 'أبو حامد الغزالي',
    category: 'تنظيم الوقت',
    practicalTip: 'وازن بين مراجعتك وممارسة هوايتك أو الرياضة لتجديد نشاطك الذهني والبدني.'
  },
  {
    id: 19,
    text: 'العقل ليس وعاءً يجب ملؤه، بل هو شعلة يجب إيقادها بالشغف والفضول.',
    author: 'بلوتارخ',
    category: 'العلم والاجتهاد',
    practicalTip: 'اطرح سؤالاً ذكياً عن سبب الظاهرة في حصة العلوم أو الفيزياء لتثير التفكير المشترك.'
  },
  {
    id: 20,
    text: 'من جد وجد ومن زرع حصد، ومن سار على الدرب وصل.',
    author: 'مَثَل عربي شهير',
    category: 'التفوق والنجاح',
    practicalTip: 'كل جهد تبذله في السر أثناء مراجعتك ستراه فرحة وفخراً علنياً في نتيجتك الدورية.'
  },
  {
    id: 21,
    text: 'برّ الوالدين وطاعتهما يفتح لك أبواب التوفيق والتيسير في كل دروب حياتك.',
    author: 'حكمة تربوية',
    category: 'الأخلاق والقدوة',
    practicalTip: 'أخبر والديك اليوم بكلمة طيبة وشكرهما على تعبهما لتوفير سبل دراستك.'
  },
  {
    id: 22,
    text: 'الصبر مفتاح الفرج، والصبر على المسألة الرياضية الصعبة مفتاح العبقرية.',
    author: 'ابن الهيثم',
    category: 'الإصرار والمثابرة',
    practicalTip: 'لا تستسلم عند مواجهة مسألة معقدة؛ جرب تفكيكها إلى خطوات أبسط وأصغر.'
  },
  {
    id: 23,
    text: 'التركيز هو سر القوة، شعاع الشمس لا يحرق إلا إذا تجمع في بؤرة واحدة.',
    author: 'ألكسندر بيل',
    category: 'تنظيم الوقت',
    practicalTip: 'أبعد هاتفك الذكي وضعه في غرفة أخرى تماماً أثناء حل التمارين والواجبات.'
  },
  {
    id: 24,
    text: 'إذا أردت أن تسير سريعاً فسر وحدك، وإذا أردت أن تسير بعيداً فسر مع فريقك.',
    author: 'حكمة أفريقية',
    category: 'الأخلاق والقدوة',
    practicalTip: 'شارك زملاءك في مراجعة جماعية أو تعاون في شرح نقطة صعبة لأحدهم.'
  },
  {
    id: 25,
    text: 'كل إنسان تصادفه يعرف شيئاً أنت لا تعرفه، فتعلم منه دائماً.',
    author: 'رالف والدو إمرسون',
    category: 'العلم والاجتهاد',
    practicalTip: 'استمع بانتباه لمداخلات زملائك في القسم، فقد تجد في كلامهم فكرة ممتازة لم تنتبه لها.'
  }
];

interface DailyMotivationSparkProps {
  studentName: string;
  massarNumber: string;
}

export const DailyMotivationSpark: React.FC<DailyMotivationSparkProps> = ({
  studentName,
  massarNumber
}) => {
  // Deterministic daily index based on date
  const getDailyIndex = () => {
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 0);
    const diff = today.getTime() - startOfYear.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    return (today.getFullYear() * 7 + dayOfYear) % MOTIVATIONAL_QUOTES.length;
  };

  const dailyIndex = getDailyIndex();
  const [currentIndex, setCurrentIndex] = useState<number>(dailyIndex);
  const [copied, setCopied] = useState<boolean>(false);
  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [showFavoritesModal, setShowFavoritesModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load saved favorites from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`student_fav_quotes_${massarNumber}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setFavorites(parsed);
        }
      }
    } catch {}
  }, [massarNumber]);

  // Check if current quote is favorite
  useEffect(() => {
    const currentId = MOTIVATIONAL_QUOTES[currentIndex].id;
    setIsFavorite(favorites.includes(currentId));
  }, [currentIndex, favorites]);

  const currentQuote = MOTIVATIONAL_QUOTES[currentIndex];
  const isTodayQuote = currentIndex === dailyIndex;

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % MOTIVATIONAL_QUOTES.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + MOTIVATIONAL_QUOTES.length) % MOTIVATIONAL_QUOTES.length);
  };

  const handleRandom = () => {
    let nextIdx = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
    if (nextIdx === currentIndex) {
      nextIdx = (nextIdx + 1) % MOTIVATIONAL_QUOTES.length;
    }
    setCurrentIndex(nextIdx);
  };

  const handleBackToToday = () => {
    setCurrentIndex(dailyIndex);
  };

  const handleCopyQuote = async () => {
    const textToCopy = `«${currentQuote.text}»\n— ${currentQuote.author}\n\n💡 فكرة تطبيقية: ${currentQuote.practicalTip}\n(مقتبس من فضاء التلميذ • منصة مدرستي)`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      triggerToast('تم نسخ الحكمة بنجاح إلى الحافظة ✓');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      triggerToast('تعذر النسخ تلقائياً');
    }
  };

  const handleToggleFavorite = () => {
    const currentId = currentQuote.id;
    let updated: number[];
    if (favorites.includes(currentId)) {
      updated = favorites.filter(id => id !== currentId);
      triggerToast('تمت إزالة الحكمة من المفضلة');
    } else {
      updated = [...favorites, currentId];
      triggerToast('تم حفظ الحكمة في مفضلتك الذهبية ⭐');
    }
    setFavorites(updated);
    try {
      localStorage.setItem(`student_fav_quotes_${massarNumber}`, JSON.stringify(updated));
    } catch {}
  };

  const handleShareQuote = async () => {
    const shareText = `«${currentQuote.text}»\n— ${currentQuote.author}\n\n💡 خطوة اليوم: ${currentQuote.practicalTip}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'رسالة اليوم الملهمة • فضاء التلميذ',
          text: shareText
        });
      } catch {}
    } else {
      handleCopyQuote();
    }
  };

  const categoryColor = {
    'العلم والاجتهاد': 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
    'تنظيم الوقت': 'bg-blue-500/20 text-blue-300 border-blue-400/40',
    'الإصرار والمثابرة': 'bg-amber-500/20 text-amber-300 border-amber-400/40',
    'الأخلاق والقدوة': 'bg-purple-500/20 text-purple-300 border-purple-400/40',
    'التفوق والنجاح': 'bg-rose-500/20 text-rose-300 border-rose-400/40'
  }[currentQuote.category];

  return (
    <>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0E2E2A] via-[#1A4E47] to-[#123832] border-2 border-[#C98A3C]/40 shadow-xl text-white">
        {/* Subtle Moroccan Geometric Accent Background */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-[#C98A3C]/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />

        {/* Card Header */}
        <div className="relative p-4 sm:p-5 border-b border-white/10 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#C98A3C]/20 border border-[#C98A3C]/60 flex items-center justify-center text-[#C98A3C] shadow-inner shrink-0">
              <Sparkles className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[#C98A3C] tracking-wide uppercase flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-[#C98A3C]" />
                  <span>إشراقة الهمة • قبس اليوم</span>
                </span>
                {isTodayQuote ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5" />
                    <span>حكمة اليوم الرسمية</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleBackToToday}
                    className="px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white/90 text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                    title="العودة لحكمة اليوم"
                  >
                    <Calendar className="w-2.5 h-2.5" />
                    <span>العودة لليوم</span>
                  </button>
                )}
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide mt-0.5">
                رسالة ملهمة لك اليوم يا <span className="text-[#F2EFE3] font-serif underline decoration-[#C98A3C]/60 underline-offset-4">{studentName}</span>
              </h3>
            </div>
          </div>

          {/* Action buttons on header */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {favorites.length > 0 && (
              <button
                type="button"
                onClick={() => setShowFavoritesModal(true)}
                className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-amber-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                title="عرض الحكم المفضلة"
              >
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span className="text-[11px]">مفضلتي ({favorites.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleRandom}
              className="px-3 py-1.5 rounded-xl bg-[#C98A3C]/20 hover:bg-[#C98A3C]/30 border border-[#C98A3C]/50 text-[#F2EFE3] text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              title="استكشف حكمة أخرى عشوائياً"
            >
              <Shuffle className="w-3.5 h-3.5 text-[#C98A3C]" />
              <span className="hidden sm:inline">حكمة أخرى</span>
            </button>
          </div>
        </div>

        {/* Card Body with Quote */}
        <div className="relative p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border ${categoryColor}`}>
              {currentQuote.category}
            </span>

            <div className="flex items-center gap-1 text-white/50 text-[11px] font-mono">
              <span>{currentIndex + 1}</span>
              <span>/</span>
              <span>{MOTIVATIONAL_QUOTES.length}</span>
            </div>
          </div>

          {/* Quote Text */}
          <div className="relative py-2 px-3 sm:px-6">
            <Quote className="absolute -top-3 right-0 w-8 h-8 text-[#C98A3C]/20 -scale-x-100 pointer-events-none" />
            <p className="text-base sm:text-xl font-serif font-bold text-white leading-relaxed sm:leading-loose text-center">
              « {currentQuote.text} »
            </p>
            <Quote className="absolute -bottom-3 left-0 w-8 h-8 text-[#C98A3C]/20 pointer-events-none" />
          </div>

          {/* Author Badge */}
          <div className="flex items-center justify-center gap-2">
            <span className="w-8 h-0.5 bg-[#C98A3C]/40 rounded-full" />
            <span className="text-xs sm:text-sm font-bold text-[#C98A3C] font-serif">
              — {currentQuote.author}
            </span>
            <span className="w-8 h-0.5 bg-[#C98A3C]/40 rounded-full" />
          </div>

          {/* Practical Application Tip for Today */}
          <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-xs flex items-start gap-3">
            <div className="w-7 h-7 rounded-xl bg-amber-400/20 border border-amber-300/40 text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
              <Lightbulb className="w-4 h-4 text-amber-300" />
            </div>
            <div className="space-y-0.5 text-right flex-1">
              <span className="text-[11px] font-bold text-amber-300 block">
                💡 خطوتك التطبيقية لليوم (تحدي الإنجاز):
              </span>
              <p className="text-xs text-white/90 leading-relaxed font-sans">
                {currentQuote.practicalTip}
              </p>
            </div>
          </div>
        </div>

        {/* Card Footer with Interaction Buttons */}
        <div className="relative p-3.5 sm:p-4 bg-black/20 border-t border-white/10 flex items-center justify-between flex-wrap gap-2">
          {/* Navigation Arrows */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrev}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer border border-white/15"
              title="الحكمة السابقة"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer border border-white/15"
              title="الحكمة التالية"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Interaction controls: Favorite, Copy, Share */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggleFavorite}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                isFavorite
                  ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                  : 'bg-white/10 hover:bg-white/20 border-white/15 text-white/80'
              }`}
              title={isFavorite ? 'محفوظة في مفضلتك' : 'إضافة إلى مفضلتي'}
            >
              <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
              <span className="text-[11px]">{isFavorite ? 'في المفضلة' : 'حفظ'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyQuote}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              title="نسخ نص الحكمة"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px] text-emerald-300">تم النسخ</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#C98A3C]" />
                  <span className="text-[11px]">نسخ</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleShareQuote}
              className="px-3 py-1.5 rounded-xl bg-[#C98A3C] hover:bg-[#B37932] text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
              title="مشاركة مع الزملاء أو العائلة"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="text-[11px]">مشاركة</span>
            </button>
          </div>
        </div>

        {/* In-Card Toast */}
        {toastMessage && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-2 rounded-2xl bg-black/85 border border-[#C98A3C]/70 text-[#F2EFE3] text-xs font-bold shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 z-20 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#C98A3C]" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>

      {/* Favorites Modal */}
      {showFavoritesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#FAF8F5] w-full max-w-xl rounded-3xl shadow-2xl border border-[#E5DFD4] overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-[#1A4E47] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#C98A3C]/20 border border-[#C98A3C]/60 flex items-center justify-center text-[#C98A3C]">
                  <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base font-serif">
                    الحكم والأقوال المفضلة لديك ⭐
                  </h3>
                  <p className="text-xs text-white/70">
                    رصيدك الذهبي من درر الحكم التي قمت بحفظها
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFavoritesModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal List */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
              {favorites.length === 0 ? (
                <div className="text-center py-10 text-[#6C6356]">
                  <Star className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="font-bold text-sm">لا توجد حكم مفضلة بعد</p>
                  <p className="text-xs text-gray-500 mt-1">
                    انقر على زر "حفظ" أسفل أي حكمة لإضافتها إلى قائمتك هنا.
                  </p>
                </div>
              ) : (
                favorites.map((favId) => {
                  const q = MOTIVATIONAL_QUOTES.find((item) => item.id === favId);
                  if (!q) return null;
                  return (
                    <div
                      key={q.id}
                      className="p-4 rounded-2xl bg-white border border-[#E5DFD4] shadow-xs space-y-2 hover:border-[#1A4E47]/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-[#1A4E47] bg-[#E8F2F0] px-2 py-0.5 rounded-full">
                          {q.category}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = favorites.filter((id) => id !== q.id);
                            setFavorites(updated);
                            try {
                              localStorage.setItem(`student_fav_quotes_${massarNumber}`, JSON.stringify(updated));
                            } catch {}
                          }}
                          className="text-[11px] text-rose-600 hover:text-rose-800 font-bold transition-colors cursor-pointer"
                        >
                          إزالة
                        </button>
                      </div>
                      <p className="text-xs sm:text-sm font-serif font-bold text-[#1F2926] leading-relaxed">
                        « {q.text} »
                      </p>
                      <div className="flex items-center justify-between pt-1 border-t border-[#F2EFE9] text-xs">
                        <span className="text-[#C98A3C] font-bold text-[11px]">— {q.author}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const idx = MOTIVATIONAL_QUOTES.findIndex((item) => item.id === q.id);
                            if (idx !== -1) {
                              setCurrentIndex(idx);
                              setShowFavoritesModal(false);
                            }
                          }}
                          className="text-[11px] font-bold text-[#1A4E47] hover:underline cursor-pointer"
                        >
                          عرض في اللوحة ⬅
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-white border-t border-[#E5DFD4] flex items-center justify-between text-xs text-[#6C6356]">
              <span>إجمالي الحكم المحفوظة: {favorites.length}</span>
              <button
                type="button"
                onClick={() => setShowFavoritesModal(false)}
                className="px-4 py-1.5 rounded-xl bg-[#1A4E47] text-white font-bold text-xs hover:bg-[#133D37] transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
