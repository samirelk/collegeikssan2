# دليل تثبيت ونشر التطبيق على استضافة InfinityFree
**المسار المحدد للاستضافة:** `/home/vol18_2/infinityfree.com/if0_43015270/`

---

## 1. فهم طبيعة الاستضافة (InfinityFree)

استضافة **InfinityFree** هي استضافة ويب مجانية تعمل بنظام **Apache + PHP + MySQL (cPanel / vPanel)**.
* **المجلد الرئيسي للمستخدم:**
  `/home/vol18_2/infinityfree.com/if0_43015270/`
* **المجلد الفعلي للموقع المتاح للزوار (Web Root):**
  `/home/vol18_2/infinityfree.com/if0_43015270/htdocs/`
  *(أي ملف يوضع خارج مجلد `htdocs` لن يمكن الوصول إليه عبر المتصفح)*.

> **تنبيه تقني هام:**
> استضافات cPanel المجانية مثل InfinityFree لا تدعم تشغيل خوادم خلفية مستمرة (Node.js persistent processes / `node server.ts`)، ولكنها تدعم بشكل مثالي تشغيل واجهات **React SPA** السريعة والخفيفة بعد بنائها (`npm run build`).

---

## 2. خطوات التثبيت خطوة بخطوة

### الخطوة 1: بناء ملفات الواجهة للإنتاج (Build Production)
على جهازك أو بيئة التطوير، قم بتنفيذ أمر البناء:
```bash
npm run build
```
سيقوم هذا الأمر بإنشاء مجلد باسم `dist/` يحتوي على:
* `index.html`
* مجلد `assets/` (ملفات JavaScript و CSS المضغوطة)
* ملف `.htaccess` (تم تضمينه تلقائياً للتعامل مع توجيه الروابط)

---

### الخطوة 2: الاتصال بالاستضافة عبر بروتوكول FTP

يمكنك استخدام برنامج **FileZilla** أو أداة **Monsta FTP (Online File Manager)** الموجودة داخل لوحة تحكم InfinityFree:

1. **بيانات الاتصال عبر FileZilla:**
   * **Host (الخادم):** `ftpupload.net`
   * **Username (اسم المستخدم):** `if0_43015270`
   * **Password (كلمة المرور):** كلمة مرور حساب vPanel الخاص بك على InfinityFree
   * **Port (المنفذ):** `21`
2. اضغط على **اتصال سريع (Quickconnect)**.

---

### الخطوة 3: رفع الملفات إلى مجلد `htdocs`

1. انتقل في جهة الخادم إلى المسار:
   `/home/vol18_2/infinityfree.com/if0_43015270/htdocs/`
2. إذا وجدت أي ملفات افتراضية داخل `htdocs` (مثل ملف `index2.html` أو `default.php`)، قم بحذفها.
3. قم بنسخ جميع الملفات الموجودة **داخل مجلد `dist/`** وضعها مباشرة داخل `htdocs/`.
   * يجب أن يكون مسار ملف الدخول الرئيسي هو:
     `/home/vol18_2/infinityfree.com/if0_43015270/htdocs/index.html`

---

### الخطوة 4: التحقق من ملف التوجيه (`.htaccess`)
لضمان عمل روابط React SPA والتحديث دون ظهور خطأ 404، تأكد من وجود ملف `.htaccess` داخل مجلد `htdocs/` بهذا المحتوى:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteCond %{REQUEST_FILENAME} !-l
  RewriteRule . /index.html [L]
</IfModule>
```
*(تم تجهيز هذا الملف بالفعل داخل مجلد `public/.htaccess` وسيتم تضمينه تلقائياً في مجلد `dist`)*.

---

## 3. ربط قاعدة البيانات والمزامنة السحابية

يعتمد التطبيق على **Google Cloud Firebase Firestore** للمزامنة الفورية للبيانات وحفظ الأقسام والمقاعد والغيابات والمشاركات الإيجابية.
* قاعدة بيانات Firestore مهيأة ومربوطة بالفعل بالتطبيق.
* عند رفع ملفات `dist` إلى الاستضافة، يتصل تطبيق الواجهة مباشرة بقاعدة البيانات السحابية بسرعة وأمان ودون الحاجة لتنصيب خادم محلي.

---

## 4. الفحص والتشغيل التجريبي
1. افتح متصفحك وادخل على النطاق المجاني المرتبط بحسابك على InfinityFree (مثال: `https://yourname.infinityfreeapp.com`).
2. قم بتسجيل الدخول بحساب المشرف أو الأستاذ.
3. تأكد من تحميل الأقسام والمقاعد الدراسية، وتسجيل الحضور والمشاركات الإيجابية بنجاح.
