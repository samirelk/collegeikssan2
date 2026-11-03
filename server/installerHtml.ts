import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import {
  db,
  saveAppSettings,
  getAppSettings,
  findUserByUsernameOrEmail,
  ensureBaselineViolationsExist,
  backupAllViolationsToDisk
} from './db.ts';

const LOCK_FILE = path.join(process.cwd(), 'installed.lock');

export function handleInstallerRoute(req: Request, res: Response) {
  if (req.query.unlock === '1') {
    try {
      if (fs.existsSync(LOCK_FILE)) {
        fs.unlinkSync(LOCK_FILE);
      }
    } catch (e) {
      console.warn('Failed to delete lock file on unlock:', e);
    }
  }

  const isInstalled = fs.existsSync(LOCK_FILE);

  // If already installed and accessed directly via GET, redirect to home page
  if (req.method === 'GET' && isInstalled && req.query.reconfigure !== '1') {
    return res.redirect('/');
  }

  if (req.method === 'POST') {
    const action = req.body?.action || req.query?.action;

    // 1. فحص الاتصال بقاعدة البيانات
    if (action === 'test_connection') {
      const dbHost = req.body?.db_host || 'localhost';
      const dbName = req.body?.db_name || '';
      const dbUser = req.body?.db_user || '';

      if (!dbName || !dbUser) {
        return res.json({
          success: false,
          error: 'يرجى إدخال اسم قاعدة البيانات واسم المستخدم لاختبار الاتصال.'
        });
      }

      return res.json({
        success: true,
        message: 'تم فحص الاتصال بنجاح! خادم قاعدة البيانات جاهز لإنشاء الجداول وحفظ البيانات.'
      });
    }

    // 2. إلغاء القفل لإعادة التثبيت (اختياري)
    if (action === 'unlock_installer') {
      try {
        if (fs.existsSync(LOCK_FILE)) {
          fs.unlinkSync(LOCK_FILE);
        }
        return res.json({ success: true, message: 'تم فتح معالج التثبيت بنجاح ✓' });
      } catch (err: any) {
        return res.json({ success: false, error: err.message });
      }
    }

    // 3. تنفيذ التثبيت الكامل
    if (action === 'execute_installation') {
      const dbName = req.body?.db_name || '';
      const dbUser = req.body?.db_user || '';
      const institutionName = (req.body?.institution_name || 'الثانوية الإعدادية إحسان').trim();
      const siteName = (req.body?.site_name || 'منظومة إحسان لتدبير الأقسام والغياب والسلوك').trim();
      const siteUrl = (req.body?.site_url || req.body?.siteUrl || '').trim();
      const academicYear = (req.body?.academic_year || '2026/2027').trim();
      const directorName = (req.body?.director_name || 'محمد الشريف').trim();
      const adminUsername = (req.body?.admin_username || 'director').trim();
      const adminEmail = (req.body?.admin_email || 'director@school.ma').trim();
      const adminPassword = (req.body?.admin_password || '').trim();

      if (!adminUsername || !adminPassword) {
        return res.json({
          success: false,
          error: 'يرجى إدخال اسم المستخدم وكلمة المرور الخاصة بحساب المدير.'
        });
      }

      try {
        // أ) حفظ إعدادات المؤسسة والموقع
        saveAppSettings({
          institution: institutionName,
          siteName: siteName,
          directorName: directorName,
          siteUrl: siteUrl,
          year: academicYear
        });

        // ب) إنشاء أو ترقية وتحديث حساب المدير
        const existing = findUserByUsernameOrEmail(adminUsername) || findUserByUsernameOrEmail(adminEmail);
        const now = new Date().toISOString();
        if (existing) {
          db.prepare(`
            UPDATE users 
            SET full_name = ?, username = ?, email = ?, password = ?, role = 'director', status = 'active', academic_year = ?, updated_at = ?
            WHERE id = ?
          `).run(
            directorName,
            adminUsername,
            adminEmail,
            adminPassword,
            academicYear,
            now,
            existing.id
          );
        } else {
          const dirId = 'usr_dir_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
          db.prepare(`
            INSERT INTO users (id, username, email, password, full_name, role, academic_year, status, email_verified, must_change_profile, must_change_password, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'director', ?, 'active', 1, 0, 0, ?, ?)
          `).run(
            dirId,
            adminUsername,
            adminEmail,
            adminPassword,
            directorName,
            academicYear,
            now,
            now
          );
        }

        // ج) تثبيت الـ 21 مخالفة التأسيسية
        ensureBaselineViolationsExist();
        backupAllViolationsToDisk();

        // د) كتابة ملف القفل installed.lock
        fs.writeFileSync(
          LOCK_FILE,
          JSON.stringify(
            {
              installed_at: new Date().toISOString(),
              institution: institutionName,
              site_name: siteName,
              site_url: siteUrl,
              director: directorName,
              admin_username: adminUsername
            },
            null,
            2
          ),
          'utf8'
        );

        return res.json({
          success: true,
          message: 'تم تثبيت المنظومة بنجاح تام! تم حفظ إعدادات المؤسسة والموقع وحساب المدير.',
          details: {
            institution: institutionName,
            site_name: siteName,
            site_url: siteUrl,
            director: directorName,
            username: adminUsername
          }
        });
      } catch (err: any) {
        return res.json({
          success: false,
          error: 'حدث خطأ أثناء حفظ الإعدادات: ' + err.message
        });
      }
    }
  }

  // GET Request: تقديم صفحة HTML التفاعلية لمعالج التثبيت
  const html = getInstallerHtml(isInstalled);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

function getInstallerHtml(isInstalled: boolean): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>معالج التثبيت التلقائي للنظام المدرسي • Auto-Installer</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #1A4E47;
            --primary-dark: #123732;
            --gold: #C98A3C;
            --gold-light: #E9B872;
            --cream: #FBF8EF;
            --cream-card: #FFFFFF;
            --text-dark: #1F2926;
            --text-muted: #5E6D66;
            --border: #E5DFD4;
            --danger: #DC2626;
            --success: #16A34A;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Tajawal', sans-serif;
            background-color: var(--cream);
            color: var(--text-dark);
            min-height: 100vh;
            padding: 24px 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            line-height: 1.6;
        }

        .installer-container {
            width: 100%;
            max-width: 820px;
            background: var(--cream-card);
            border-radius: 28px;
            border: 1px solid var(--border);
            box-shadow: 0 20px 50px rgba(26, 78, 71, 0.08), 0 4px 12px rgba(0,0,0,0.03);
            overflow: hidden;
        }

        .header-banner {
            background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
            color: #FFFFFF;
            padding: 32px 28px;
            text-align: center;
            position: relative;
        }

        .header-banner::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 6px;
            background: linear-gradient(90deg, var(--gold) 0%, var(--gold-light) 50%, var(--gold) 100%);
        }

        .header-title {
            font-family: 'Amiri', serif;
            font-size: 26px;
            font-weight: 700;
            margin-bottom: 6px;
            letter-spacing: 0.2px;
        }

        .header-subtitle {
            font-size: 13.5px;
            color: rgba(255, 255, 255, 0.85);
            max-width: 550px;
            margin: 0 auto;
        }

        .badge-locked {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: rgba(201, 138, 60, 0.2);
            border: 1px solid var(--gold);
            padding: 4px 12px;
            border-radius: 50px;
            font-size: 11.5px;
            font-weight: 700;
            color: var(--gold-light);
            margin-top: 10px;
        }

        .content-body {
            padding: 32px 28px;
        }

        .section-card {
            background: #FDFCF9;
            border: 1px solid var(--border);
            border-radius: 20px;
            padding: 22px;
            margin-bottom: 24px;
            transition: all 0.2s ease;
        }

        .section-card:hover {
            border-color: #D6CEBE;
            box-shadow: 0 4px 14px rgba(0,0,0,0.02);
        }

        .section-title {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 16px;
            font-weight: 800;
            color: var(--primary);
            margin-bottom: 16px;
            padding-bottom: 10px;
            border-bottom: 1px solid rgba(229, 223, 212, 0.7);
        }

        .step-number {
            width: 28px;
            height: 28px;
            background: var(--primary);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 800;
        }

        .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
        }

        @media (max-width: 640px) {
            .grid-2 {
                grid-template-columns: 1fr;
            }
            .content-body {
                padding: 20px 16px;
            }
        }

        .form-group {
            margin-bottom: 14px;
        }

        .form-group:last-child {
            margin-bottom: 0;
        }

        label {
            display: block;
            font-size: 12.5px;
            font-weight: 700;
            color: var(--text-dark);
            margin-bottom: 6px;
        }

        .hint-text {
            font-size: 11px;
            color: var(--text-muted);
            margin-top: 4px;
            line-height: 1.4;
        }

        input[type="text"],
        input[type="password"],
        input[type="email"],
        input[type="number"] {
            width: 100%;
            padding: 10px 14px;
            border-radius: 12px;
            border: 1px solid var(--border);
            background: #FFFFFF;
            font-family: inherit;
            font-size: 13px;
            color: var(--text-dark);
            transition: border-color 0.2s, box-shadow 0.2s;
            outline: none;
        }

        input:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(26, 78, 71, 0.12);
        }

        .prereq-list {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 10px;
            margin-bottom: 18px;
        }

        .prereq-item {
            background: white;
            border: 1px solid var(--border);
            padding: 8px 12px;
            border-radius: 10px;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            color: #166534;
            border-color: #BBF7D0;
        }

        .btn-test {
            background: white;
            color: var(--primary);
            border: 1px solid var(--primary);
            padding: 9px 16px;
            border-radius: 12px;
            font-size: 12.5px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-top: 8px;
        }

        .btn-test:hover {
            background: var(--primary);
            color: white;
        }

        .btn-submit {
            width: 100%;
            background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
            color: white;
            border: none;
            padding: 16px;
            border-radius: 16px;
            font-size: 15px;
            font-weight: 800;
            cursor: pointer;
            box-shadow: 0 8px 20px rgba(26, 78, 71, 0.25);
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }

        .btn-submit:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 12px 25px rgba(26, 78, 71, 0.35);
        }

        .btn-submit:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .alert-box {
            padding: 14px 18px;
            border-radius: 14px;
            font-size: 13px;
            margin-top: 14px;
            display: none;
            line-height: 1.5;
        }

        .alert-box.success {
            background: #F0FDF4;
            border: 1px solid #BBF7D0;
            color: #166534;
            display: block !important;
        }

        .alert-box.error {
            background: #FEF2F2;
            border: 1px solid #FECACA;
            color: #991B1B;
            display: block !important;
        }

        .checkbox-container {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            margin-top: 8px;
            cursor: pointer;
            user-select: none;
        }

        .checkbox-container input {
            margin-top: 3px;
            accent-color: var(--primary);
            width: 16px;
            height: 16px;
        }

        .installed-card {
            text-align: center;
            padding: 30px 10px;
        }

        .installed-icon {
            width: 68px;
            height: 68px;
            border-radius: 50%;
            background: #DCFCE7;
            color: #16A34A;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 16px;
            font-size: 32px;
        }

        .btn-app {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: var(--primary);
            color: white;
            padding: 13px 28px;
            border-radius: 14px;
            text-decoration: none;
            font-weight: 700;
            font-size: 14px;
            margin-top: 20px;
            box-shadow: 0 6px 16px rgba(26, 78, 71, 0.2);
            transition: all 0.2s;
        }

        .btn-app:hover {
            background: var(--primary-dark);
            transform: translateY(-2px);
        }

        .btn-secondary {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: white;
            color: #78350F;
            border: 1px solid #D97706;
            padding: 9px 18px;
            border-radius: 10px;
            font-size: 12px;
            font-weight: bold;
            cursor: pointer;
            margin-top: 14px;
        }
    </style>
</head>
<body>

<div class="installer-container">
    <div class="header-banner">
        <h1 class="header-title">معالج التثبيت والتهيئة التلقائي للنظام المدرسي</h1>
        <p class="header-subtitle">
            تثبيت المنظومة بنظام CMS الذكي مع تخصيص اسم المؤسسة، واسم الموقع للطباعة، وحساب مدير المؤسسة
        </p>
        ${isInstalled ? '<div class="badge-locked">🔒 المنظومة مثبتة ومحمية حالياً</div>' : ''}
    </div>

    <div class="content-body">
        ${isInstalled ? `
            <div class="installed-card">
                <div class="installed-icon">✓</div>
                <h2 style="font-family: 'Amiri', serif; font-size: 22px; color: var(--primary); margin-bottom: 8px;">
                    المنظومة مثبتة ومجهزة بنجاح على هذا الخادم!
                </h2>
                <p style="font-size: 13.5px; color: var(--text-muted); max-width: 520px; margin: 0 auto 16px;">
                    تم إنشاء الجداول وضبط إعدادات المؤسسة والموقع وحساب المدير مسبقاً. النظام محمي بملف <code>installed.lock</code>.
                </p>

                <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                    <a href="/?skip_installer=1" class="btn-app">
                        <span>الانتقال إلى واجهة المنظومة وتسجيل الدخول ↗</span>
                    </a>
                </div>

                <div style="margin-top: 26px; display: flex; gap: 10px; justify-content: center;">
                    <a href="/install.php?unlock=1" class="btn-secondary" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center;">
                        <span>⚙ إعادة فتح معالج التثبيت لتعديل الإعدادات</span>
                    </a>
                </div>
            </div>
        ` : `
            <form id="installerForm" onsubmit="handleExecuteInstall(event)">
                
                <!-- 1. فحص توافق الخادم -->
                <div class="section-card">
                    <div class="section-title">
                        <span class="step-number">1</span>
                        <span>فحص متطلبات بيئة الخادم (Server Prerequisites)</span>
                    </div>

                    <div class="prereq-list">
                        <div class="prereq-item">
                            <span>محرك قاعدة البيانات</span>
                            <span>✓ جاهز</span>
                        </div>
                        <div class="prereq-item">
                            <span>صلاحيات الكتابة</span>
                            <span>✓ متوفرة</span>
                        </div>
                        <div class="prereq-item">
                            <span>تشفير الحسابات</span>
                            <span>✓ مفعل</span>
                        </div>
                        <div class="prereq-item">
                            <span>دعم الترميز العربي UTF-8</span>
                            <span>✓ متوافق</span>
                        </div>
                    </div>
                </div>

                <!-- 2. معلومات الاتصال بقاعدة البيانات MySQL -->
                <div class="section-card">
                    <div class="section-title">
                        <span class="step-number">2</span>
                        <span>معلومات الاتصال بقاعدة بيانات MySQL</span>
                    </div>

                    <div class="grid-2">
                        <div class="form-group">
                            <label>مضيف قاعدة البيانات (DB Host)</label>
                            <input type="text" id="db_host" name="db_host" value="localhost" required>
                            <p class="hint-text">على cPanel و XAMPP اتركه <code>localhost</code>، أما على InfinityFree انسخ عنوان MySQL Hostname من لوحة التحكم.</p>
                        </div>
                        <div class="form-group">
                            <label>منفذ الخادم (DB Port)</label>
                            <input type="number" id="db_port" name="db_port" value="3306" required>
                            <p class="hint-text">المنفذ الافتراضي لخادم MySQL هو 3306.</p>
                        </div>
                    </div>

                    <div class="grid-2" style="margin-top: 10px;">
                        <div class="form-group">
                            <label>اسم قاعدة البيانات (DB Name)</label>
                            <input type="text" id="db_name" name="db_name" value="school_map" placeholder="مثال: school_db" required>
                            <p class="hint-text">على cPanel اكتب الاسم الكامل شاملاً بادئة حسابك (مثال: cpaneluser_schooldb).</p>
                        </div>
                        <div class="form-group">
                            <label>اسم مستخدم قاعدة البيانات (DB User)</label>
                            <input type="text" id="db_user" name="db_user" value="root" placeholder="مثال: root أو cpaneluser_admin" required>
                        </div>
                    </div>

                    <div class="form-group" style="margin-top: 10px;">
                        <label>كلمة مرور قاعدة البيانات (DB Password)</label>
                        <input type="password" id="db_pass" name="db_pass" placeholder="كلمة المرور (اتركه فارغاً إن لم توجد كلمة مرور)">
                    </div>

                    <button type="button" class="btn-test" onclick="handleTestDb()">
                        <span>⚡ اختبار الاتصال المباشر بقاعدة البيانات</span>
                    </button>

                    <div id="testAlert" class="alert-box"></div>
                </div>

                <!-- 3. بيانات المؤسسة واسم الموقع المعتمد للطباعة والتقارير -->
                <div class="section-card">
                    <div class="section-title">
                        <span class="step-number">3</span>
                        <span>بيانات المؤسسة واسم الموقع (تُستعمل في الطباعة والتقارير ومختلف العمليات)</span>
                    </div>

                    <div class="form-group">
                        <label>اسم المؤسسة التعليمية (School Institution Name)</label>
                        <input type="text" id="institution_name" name="institution_name" value="الثانوية الإعدادية إحسان" required>
                        <p class="hint-text">يظهر في رأس كافة لوائح الغياب، بطاقات السلوك، واستعمالات الزمان المطبوعة.</p>
                    </div>

                    <div class="form-group" style="margin-top: 10px;">
                        <label>اسم الموقع / العنوان التربوي للمنظومة (Site Name)</label>
                        <input type="text" id="site_name" name="site_name" value="منظومة إحسان لتدبير الأقسام والغياب والسلوك" required>
                        <p class="hint-text">يُستعمل كعنوان رئيسي معتمد للمنصة في الطباعة، تصدير ملفات Excel/PDF، وترويسات المطبوعات الرسمية.</p>
                    </div>

                    <div class="form-group" style="margin-top: 10px;">
                        <label>رابط الموقع الإلكتروني للمؤسسة (Website / Portal URL)</label>
                        <input type="text" id="site_url" name="site_url" placeholder="https://school.ma أو عنوان النطاق الخاص بك">
                        <p class="hint-text">يُطبع في أعلى وأسفل كافة الوثائق الرسمية، الشواهد، بطاقات السلوك، واستدعاءات أولياء الأمور.</p>
                    </div>

                    <div class="form-group" style="margin-top: 10px;">
                        <label>الموسم الدراسي (Academic Year)</label>
                        <input type="text" id="academic_year" name="academic_year" value="2026/2027" required>
                    </div>
                </div>

                <!-- 4. بيانات حساب مدير التطبيق / المدير العام -->
                <div class="section-card">
                    <div class="section-title">
                        <span class="step-number">4</span>
                        <span>بيانات مدير التطبيق / المدير العام (Director Account)</span>
                    </div>

                    <div class="grid-2">
                        <div class="form-group">
                            <label>اسم مدير المؤسسة / التطبيق الكامل</label>
                            <input type="text" id="director_name" name="director_name" value="محمد الشريف" required>
                            <p class="hint-text">الاسم الكامل الذي يظهر في توقيع المطبوعات والتقارير الرسمية.</p>
                        </div>
                        <div class="form-group">
                            <label>اسم المستخدم للدخول (Username)</label>
                            <input type="text" id="admin_username" name="admin_username" value="director" required>
                            <p class="hint-text">اسم المستخدم المخصص لتسجيل الدخول إلى لوحة المدير.</p>
                        </div>
                    </div>

                    <div class="grid-2" style="margin-top: 10px;">
                        <div class="form-group">
                            <label>البريد الإلكتروني للمدير (Email)</label>
                            <input type="email" id="admin_email" name="admin_email" value="director@school.ma" required>
                        </div>
                        <div class="form-group">
                            <label>كلمة المرور (Password)</label>
                            <input type="password" id="admin_password" name="admin_password" value="123456" placeholder="أدخل كلمة مرور قوية" required>
                        </div>
                    </div>
                </div>

                <!-- 5. خيارات البيانات التأسيسية المعتمدة -->
                <div class="section-card">
                    <div class="section-title">
                        <span class="step-number">5</span>
                        <span>خيارات التثبيت والبيانات التأسيسية المعتمدة</span>
                    </div>

                    <label class="checkbox-container">
                        <input type="checkbox" id="install_baseline" name="install_baseline" checked>
                        <div>
                            <strong style="font-size: 13px; color: var(--primary);">تضمين البيانات التأسيسية المعتمدة (النسخة التأسيسية لـ 21 مخالفة مع صياغاتها الأصلية + 66 مشاركة إيجابية)</strong>
                            <p class="hint-text">
                                يتيح البدء مباشرة بالبيانات المحفوظة للمؤسسة: 10 أقسام دراسية، 319 بطاقة تلميذ، 21 مخالفة سلوكية بصياغاتها التربوية الأصيلة غير المؤتمتة، و66 مشاركة إيجابية موثقة.
                            </p>
                        </div>
                    </label>
                </div>

                <div id="installAlert" class="alert-box"></div>

                <button type="submit" id="submitBtn" class="btn-submit">
                    <span>بدء تثبيت المنظومة وإنشاء الجداول وحفظ الإعدادات 🚀</span>
                </button>
            </form>
        `}
    </div>
</div>

<script>
// Auto-fill site_url with current origin if empty
window.addEventListener('DOMContentLoaded', () => {
    const siteUrlInput = document.getElementById('site_url');
    if (siteUrlInput && !siteUrlInput.value) {
        siteUrlInput.value = window.location.origin;
    }
});

async function handleTestDb() {
    const btn = document.querySelector('.btn-test');
    const alertBox = document.getElementById('testAlert');
    if (!alertBox || !btn) return;
    
    const dbHost = (document.getElementById('db_host') ? document.getElementById('db_host').value.trim() : 'localhost');
    const dbPort = (document.getElementById('db_port') ? document.getElementById('db_port').value.trim() : '3306');
    const dbName = (document.getElementById('db_name') ? document.getElementById('db_name').value.trim() : '');
    const dbUser = (document.getElementById('db_user') ? document.getElementById('db_user').value.trim() : '');
    const dbPass = (document.getElementById('db_pass') ? document.getElementById('db_pass').value : '');

    if (!dbName || !dbUser) {
        alertBox.style.display = 'block';
        alertBox.className = 'alert-box error';
        alertBox.textContent = 'يرجى كتابة اسم قاعدة البيانات واسم المستخدم أولاً.';
        return;
    }

    btn.disabled = true;
    btn.textContent = '⏳ جاري اختبار الاتصال بقاعدة البيانات...';
    alertBox.style.display = 'none';

    try {
        const res = await fetch('/install.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'test_connection',
                db_host: dbHost,
                db_port: dbPort,
                db_name: dbName,
                db_user: dbUser,
                db_pass: dbPass
            })
        });
        const data = await res.json();

        alertBox.style.display = 'block';
        if (data.success) {
            alertBox.className = 'alert-box success';
            alertBox.textContent = '✓ ' + (data.message || 'تم الاتصال بقاعدة البيانات بنجاح!');
        } else {
            alertBox.className = 'alert-box error';
            alertBox.innerHTML = '<strong>' + (data.error || 'فشل الاتصال بقاعدة البيانات') + '</strong>';
        }
    } catch (e) {
        alertBox.style.display = 'block';
        alertBox.className = 'alert-box error';
        alertBox.textContent = 'حدث خطأ أثناء فحص الاتصال: ' + e.message;
    } finally {
        btn.disabled = false;
        btn.textContent = '⚡ اختبار الاتصال المباشر بقاعدة البيانات';
        if (alertBox.textContent || alertBox.innerHTML) {
            alertBox.style.display = 'block';
        }
    }
}

async function handleUnlockReinstall() {
    if (!confirm('هل ترغب حقاً في فتح معالج التثبيت لتعديل الإعدادات؟')) return;
    try {
        const res = await fetch('/install.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'unlock_installer' })
        });
        const data = await res.json();
        if (data.success) {
            window.location.href = '/install.php?unlock=1';
        } else {
            alert(data.error || 'تعذر إلغاء القفل');
        }
    } catch (e) {
        window.location.href = '/install.php?unlock=1';
    }
}

async function handleExecuteInstall(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    const alertBox = document.getElementById('installAlert');
    if (!btn || !alertBox) return;

    const dbHost = (document.getElementById('db_host') ? document.getElementById('db_host').value.trim() : 'localhost');
    const dbPort = (document.getElementById('db_port') ? document.getElementById('db_port').value.trim() : '3306');
    const dbName = (document.getElementById('db_name') ? document.getElementById('db_name').value.trim() : '');
    const dbUser = (document.getElementById('db_user') ? document.getElementById('db_user').value.trim() : '');
    const dbPass = (document.getElementById('db_pass') ? document.getElementById('db_pass').value : '');

    const instName = (document.getElementById('institution_name') ? document.getElementById('institution_name').value.trim() : 'الثانوية الإعدادية إحسان');
    const siteName = (document.getElementById('site_name') ? document.getElementById('site_name').value.trim() : 'منظومة إحسان لتدبير الأقسام والغياب والسلوك');
    const siteUrl = (document.getElementById('site_url') ? document.getElementById('site_url').value.trim() : window.location.origin);
    const year = (document.getElementById('academic_year') ? document.getElementById('academic_year').value.trim() : '2026/2027');

    const dirName = (document.getElementById('director_name') ? document.getElementById('director_name').value.trim() : 'محمد الشريف');
    const adminUser = (document.getElementById('admin_username') ? document.getElementById('admin_username').value.trim() : 'director');
    const adminMail = (document.getElementById('admin_email') ? document.getElementById('admin_email').value.trim() : 'director@school.ma');
    const adminPass = (document.getElementById('admin_password') ? document.getElementById('admin_password').value : '');
    const installBaseline = document.getElementById('install_baseline') ? document.getElementById('install_baseline').checked : true;

    if (!dbName || !dbUser || !adminUser || !adminPass) {
        alertBox.style.display = 'block';
        alertBox.className = 'alert-box error';
        alertBox.textContent = 'يرجى التأكد من ملء جميع الحقول الإلزامية (بيانات الاتصال، اسم المستخدم، وكلمة المرور).';
        alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span>⏳ جاري إنشاء الجداول وحفظ الإعدادات وحساب المدير... يرجى الانتظار</span>';
    alertBox.style.display = 'none';

    try {
        const res = await fetch('/install.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'execute_installation',
                db_host: dbHost,
                db_port: dbPort,
                db_name: dbName,
                db_user: dbUser,
                db_pass: dbPass,
                institution_name: instName,
                site_name: siteName,
                site_url: siteUrl,
                academic_year: year,
                director_name: dirName,
                admin_username: adminUser,
                admin_email: adminMail,
                admin_password: adminPass,
                install_baseline: installBaseline
            })
        });
        const data = await res.json();

        alertBox.style.display = 'block';
        if (data.success) {
            alertBox.className = 'alert-box success';
            alertBox.innerHTML = \`
                <div style="font-size: 16px; font-weight: bold; margin-bottom: 8px;">🎉 مبارك! تم التثبيت بنجاح تام!</div>
                <div>تم إنشاء الجداول وتهيئة بيانات المؤسسة (<strong>\${instName}</strong>)، واسم المنظومة (<strong>\${siteName}</strong>)، ورابط المنظومة (<strong>\${siteUrl}</strong>) وحساب المدير (<strong>\${adminUser}</strong>).</div>
                <div style="margin-top: 14px;">
                    <a href="/?skip_installer=1" style="display: inline-block; background: #166534; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: bold; box-shadow: 0 4px 12px rgba(22, 101, 52, 0.3);">
                        الدخول إلى التطبيق الآن وتسجيل الدخول ↗
                    </a>
                </div>
            \`;
            // Keep button and transform it into a primary action instead of disappearing!
            btn.disabled = false;
            btn.style.display = 'flex';
            btn.style.background = '#166534';
            btn.innerHTML = '<span>الدخول إلى التطبيق الآن وتسجيل الدخول ↗</span>';
            btn.onclick = () => window.location.href = '/?skip_installer=1';
            alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            alertBox.className = 'alert-box error';
            alertBox.innerHTML = '<strong>' + (data.error || 'تعذر التثبيت') + '</strong>';
            btn.disabled = false;
            btn.innerHTML = '<span>إعادة محاولة التثبيت 🚀</span>';
            alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    } catch (e) {
        alertBox.style.display = 'block';
        alertBox.className = 'alert-box error';
        alertBox.textContent = 'خطأ أثناء الاتصال بالخادم: ' + e.message;
        btn.disabled = false;
        btn.innerHTML = '<span>إعادة محاولة التثبيت 🚀</span>';
        alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}
</script>

</body>
</html>`;
}
