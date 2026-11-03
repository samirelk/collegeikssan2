<?php
/**
 * منظومة تدبير الأقسام والغياب والسلوك المدرسي
 * نظام إدارة المحتوى والتحكم بالبوابة على غرار WordPress و CMS العالمية
 * School Management CMS Front Controller & WordPress-style Auto-Installer Gatekeeper
 */

define('APP_ROOT', __DIR__);
$lockFile = APP_ROOT . '/installed.lock';
$installFile = APP_ROOT . '/install.php';
$configFile = APP_ROOT . '/config.php';

// 1. التحقق الذكي من حالة التثبيت (Smart Installation Detection)
$isInstalled = file_exists($lockFile) || file_exists(APP_ROOT . '/install.lock');

// إذا كان ملف التثبيت غير موجود أصلاً (تم مسحه أو إعادة تسميته لحماية النظام)، فالموقع مثبت حتماً
if (!file_exists($installFile)) {
    $isInstalled = true;
}

// فحص إضافي: إذا كان ملف الإعدادات config.php مهيأ بقاعدة بيانات حقيقية
if (!$isInstalled && file_exists($configFile)) {
    $cfg = @file_get_contents($configFile);
    if ($cfg && (strpos($cfg, 'تم إنشاؤه تلقائياً') !== false || (strpos($cfg, 'DB_NAME') !== false && strpos($cfg, "'school_map'") === false))) {
        $isInstalled = true;
        @file_put_contents($lockFile, json_encode([
            'installed_at' => date('Y-m-d H:i:s'),
            'auto_detected' => true
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        
        // مسح ملفات التثبيت وقاعدة البيانات تلقائياً لحماية المنظومة
        if (file_exists($installFile)) {
            @unlink($installFile);
        }
        if (file_exists(APP_ROOT . '/database.sql')) {
            @unlink(APP_ROOT . '/database.sql');
        }
    }
}

// 2. إذا لم يكن النظام مثبتاً بعد وما زال ملف install.php موجوداً، التوجيه لمعالج التثبيت
if (!$isInstalled && file_exists($installFile)) {
    header('Location: install.php');
    exit;
}

// 3. تقديم واجهة التطبيق التفاعلية React SPA
$appHtml = APP_ROOT . '/app.html';
if (!file_exists($appHtml)) {
    $appHtml = APP_ROOT . '/index.html';
}

if (file_exists($appHtml)) {
    header('Content-Type: text/html; charset=utf-8');
    header('X-Frame-Options: SAMEORIGIN');
    readfile($appHtml);
    exit;
} else {
    header('Content-Type: text/html; charset=utf-8');
    echo '<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">';
    echo '<title>منظومة تدبير المؤسسة</title>';
    echo '<style>body{font-family:sans-serif; text-align:center; padding:50px; background:#FBF8EF; color:#1F2926;}</style>';
    echo '</head><body>';
    echo '<div style="max-width:600px; margin:0 auto; background:white; padding:30px; border-radius:16px; border:1px solid #E5DFD4;">';
    echo '<h2 style="color:#1A4E47; margin-bottom:12px;">✓ المنظومة مثبتة بنجاح</h2>';
    echo '<p style="color:#5E6D66; font-size:14px;">تم تهيئة قاعدة البيانات بنجاح. يرجى التأكد من وجود ملف واجهة التطبيق <code>app.html</code> في المجلد الرئيسي.</p>';
    if (file_exists($installFile)) {
        echo '<a href="install.php" style="display:inline-block; margin-top:16px; background:#1A4E47; color:white; padding:10px 20px; border-radius:8px; text-decoration:none;">معالج التثبيت</a>';
    }
    echo '</div></body></html>';
    exit;
}
