<?php
/**
 * إعدادات الاتصال بقاعدة بيانات MySQL وبيانات المؤسسة
 * قم بتعديل هذه البيانات لتطابق إعدادات الخادم أو لوحة التحكم cPanel الخاصة بك
 * أو استخدم معالج التثبيت التلقائي: install.php
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
if (!defined('DB_HOST')) define('DB_HOST', 'localhost');
if (!defined('DB_PORT')) define('DB_PORT', 3306);
if (!defined('DB_NAME')) define('DB_NAME', 'school_map');     // اسم قاعدة البيانات (مثال على cPanel: username_schoolmap)
if (!defined('DB_USER')) define('DB_USER', 'root');           // اسم مستخدم قاعدة البيانات
if (!defined('DB_PASS')) define('DB_PASS', '');               // كلمة مرور قاعدة البيانات
if (!defined('DB_CHARSET')) define('DB_CHARSET', 'utf8mb4');

// -------------------------------------------------------------
// معلومات المؤسسة والموقع المعتمدة (تُستعمل في الطباعة والتقارير)
// -------------------------------------------------------------
if (!defined('INSTITUTION_NAME')) define('INSTITUTION_NAME', 'الثانوية الإعدادية إحسان');
if (!defined('SITE_NAME')) define('SITE_NAME', 'منظومة إحسان لتدبير الأقسام والغياب والسلوك');
if (!defined('SITE_URL')) define('SITE_URL', '');
if (!defined('DIRECTOR_NAME')) define('DIRECTOR_NAME', 'محمد الشريف');
if (!defined('ACADEMIC_YEAR')) define('ACADEMIC_YEAR', '2026/2027');

try {
    $cleanHost = DB_HOST;
    $dbPort = defined('DB_PORT') ? intval(DB_PORT) : 3306;
    if (strpos($cleanHost, ':') !== false) {
        $parts = explode(':', $cleanHost, 2);
        $cleanHost = $parts[0];
        if (is_numeric($parts[1])) {
            $dbPort = intval($parts[1]);
        }
    }
    $dsn = ($dbPort > 0 && $dbPort !== 3306)
        ? "mysql:host={$cleanHost};port={$dbPort};dbname=" . DB_NAME . ";charset=" . DB_CHARSET
        : "mysql:host={$cleanHost};dbname=" . DB_NAME . ";charset=" . DB_CHARSET;

    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];
    $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
} catch (PDOException $e) {
    http_response_code(200);
    $err = $e->getMessage();
    $hint = 'يرجى مراجعة إعدادات الاتصال في ملف config.php أو تشغيل معالج التثبيت التلقائي: install.php';
    if (strpos($err, 'Connection refused') !== false || strpos($err, '2002') !== false) {
        $hint = 'خادم قاعدة البيانات غير صحيح. في استضافات InfinityFree، انسخ عنوان MySQL Hostname من لوحة التحكم (مثال: sql100.infinityfree.com) ولا تستخدم localhost!';
    } elseif (strpos($err, 'Access denied') !== false || strpos($err, '1045') !== false) {
        $hint = 'اسم المستخدم أو كلمة المرور لقاعدة البيانات غير صحيحة. تأكد من كلمة مرور حسابك في الاستضافة.';
    } elseif (strpos($err, 'Unknown database') !== false || strpos($err, '1049') !== false) {
        $hint = 'اسم قاعدة البيانات غير موجود. يمكنك إنشاء قاعدة البيانات ثم تشغيل معالج التثبيت install.php لإنشاء الجداول وحفظ الإعدادات.';
    }
    echo json_encode([
        'success' => false,
        'error' => 'خطأ في الاتصال بقاعدة البيانات: ' . $err,
        'hint' => $hint,
        'installer_url' => 'install.php'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * دوال مساعدة للاستجابة
 */
function jsonResponse($data, $statusCode = 200) {
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

function getSetting($pdo, $key, $default = '') {
    try {
        $stmt = $pdo->prepare("SELECT value FROM app_settings WHERE key_name = ? LIMIT 1");
        $stmt->execute([$key]);
        $val = $stmt->fetchColumn();
        return ($val !== false && $val !== null) ? $val : $default;
    } catch (Exception $e) {
        return $default;
    }
}

function setSetting($pdo, $key, $value) {
    try {
        $stmt = $pdo->prepare("INSERT INTO app_settings (key_name, value, updated_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()");
        return $stmt->execute([$key, (string)$value]);
    } catch (Exception $e) {
        return false;
    }
}
