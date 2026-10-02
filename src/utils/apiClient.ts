/**
 * Universal Resilient API Client for all web hosts:
 * Works on root domain, subfolders (XAMPP /school/), InfinityFree, cPanel, and Node.js
 */

export function getBaseApiUrl(): string {
  // If running in development or root
  const pathname = window.location.pathname;
  // If loaded in a subfolder like /school/ or /school/index.html
  const dir = pathname.substring(0, pathname.lastIndexOf('/') + 1);
  return dir;
}

export async function safeApiFetch(endpoint: string, options?: RequestInit): Promise<any> {
  const cleanPath = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
  
  // Strategy 1: standard endpoint (e.g. /api/auth/login or /school/api/auth/login)
  const base = getBaseApiUrl();
  const directUrl = `${base}${cleanPath}`.replace(/\/+/g, '/');

  let res: Response;
  let text = '';
  
  try {
    res = await fetch(directUrl, options);
    text = await res.text();
  } catch (netErr: any) {
    // If standard fetch failed due to network, try fallback query route
    try {
      const routeParam = cleanPath.replace(/^api\//, '');
      const fallbackUrl = `${base}api/index.php?route=${encodeURIComponent(routeParam)}`.replace(/\/+/g, '/');
      res = await fetch(fallbackUrl, options);
      text = await res.text();
    } catch (fallbackErr: any) {
      throw new Error('تعذر الاتصال بالخادم. يرجى التأكد من تشغيل خادم الويب والاتصال بالإنترنت.');
    }
  }

  // Check if response returned HTML or 404 and try fallback
  if ((!res.ok || text.trim().startsWith('<') || text.trim().startsWith('<!DOCTYPE')) && cleanPath.startsWith('api/')) {
    try {
      const routeParam = cleanPath.replace(/^api\//, '');
      const fallbackUrl = `${base}api/index.php?route=${encodeURIComponent(routeParam)}`.replace(/\/+/g, '/');
      const fallbackRes = await fetch(fallbackUrl, options);
      const fallbackText = await fallbackRes.text();
      if (!fallbackText.trim().startsWith('<')) {
        res = fallbackRes;
        text = fallbackText;
      }
    } catch (e) {
      // Ignore and proceed to parse text
    }
  }

  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch (parseErr) {
    // If text contains HTML or raw error
    if (text.includes('Access denied') || text.includes('1045')) {
      throw new Error('خطأ في الاتصال بقاعدة البيانات: اسم المستخدم أو كلمة المرور في config.php غير صحيحة.');
    }
    if (text.includes('Connection refused') || text.includes('2002')) {
      throw new Error('خطأ في خادم MySQL: تأكد من استخدام Host الخادم الصحيح في config.php (وليس localhost على الاستضافات السحابية).');
    }
    if (text.includes('Unknown database') || text.includes('1049')) {
      throw new Error('قاعدة البيانات غير موجودة: تأكد من اسم قاعدة البيانات في config.php.');
    }
    throw new Error('تعذر الاتصال بقاعدة البيانات. يرجى مراجعة بيانات ملف config.php والتأكد من إعدادات الخادم.');
  }

  if (data && data.success === false) {
    const errorMsg = data.error || data.message || 'حدث خطأ غير متوقع';
    const errObj = new Error(errorMsg);
    (errObj as any).data = data;
    throw errObj;
  }

  return data;
}
