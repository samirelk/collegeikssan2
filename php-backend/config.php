<?php
/**
 * إعدادات الاتصال بقاعدة بيانات MySQL
 * قم بتعديل هذه البيانات لتطابق إعدادات الخادم أو لوحة التحكم cPanel الخاصة بك
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, x-user-id, x-user-role');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// -------------------------------------------------------------
// معلومات الاتصال بقاعدة البيانات MySQL
// -------------------------------------------------------------
define('DB_HOST', 'localhost');
define('DB_NAME', 'school_map');     // اسم قاعدة البيانات (مثال على cPanel: username_schoolmap)
define('DB_USER', 'root');           // اسم مستخدم قاعدة البيانات
define('DB_PASS', '');               // كلمة مرور قاعدة البيانات
define('DB_CHARSET', 'utf8mb4');

try {
    $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];
    $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
} catch (PDOException $e) {
    // نستخدم كود 200 دائماً لمنع الخوادم المجانية من استبدال الرد بصفحة HTML 500
    http_response_code(200);
    $err = $e->getMessage();
    $hint = 'يرجى مراجعة إعدادات الاتصال في ملف config.php';
    if (strpos($err, 'Connection refused') !== false || strpos($err, '2002') !== false) {
        $hint = 'خادم قاعدة البيانات غير صحيح. في استضافات InfinityFree، انسخ عنوان MySQL Hostname من لوحة التحكم (مثال: sql100.infinityfree.com) ولا تستخدم localhost!';
    } elseif (strpos($err, 'Access denied') !== false || strpos($err, '1045') !== false) {
        $hint = 'اسم المستخدم أو كلمة المرور لقاعدة البيانات غير صحيحة. تأكد من كلمة مرور حسابك في الاستضافة.';
    } elseif (strpos($err, 'Unknown database') !== false || strpos($err, '1049') !== false) {
        $hint = 'اسم قاعدة البيانات غير موجود. تأكد من كتابة الاسم الكامل مع البادئة (مثال: if0_xxxx_dbname).';
    }
    echo json_encode([
        'success' => false,
        'error' => 'خطأ في الاتصال بقاعدة البيانات: ' . $err,
        'hint' => $hint
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * دوال مساعدة للاستجابة
 */
function jsonResponse($data, $statusCode = 200) {
    // نستخدم 200 دائماً لضمان عدم قيام استضافات cPanel/InfinityFree باستبدال الـ JSON بصفحات خطأ HTML
    http_response_code(200);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function getJsonInput() {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?: [];
}

function getHeader($name) {
    $headerKey = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    return $_SERVER[$headerKey] ?? '';
}
