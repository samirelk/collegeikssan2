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
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'تعذر الاتصال بقاعدة البيانات MySQL: ' . $e->getMessage(),
        'tip' => 'يرجى مراجعة إعدادات الاتصال في ملف config.php والتأكد من استيراد database.sql'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * دوال مساعدة للاستجابة
 */
function jsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
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
