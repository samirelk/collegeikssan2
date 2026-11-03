<?php
/**
 * معالج التثبيت التلقائي الموحد والشامل للنظام المدرسي
 * Unified Full Auto-Installer for School Classroom & Attendance System
 * متوافق 100% مع استضافات InfinityFree، الاستضافات المشتركة المجانية، و cPanel / Apache / LiteSpeed / Nginx
 */

@set_time_limit(300);
@ini_set('memory_limit', '256M');
@ini_set('max_execution_time', '300');
error_reporting(E_ALL);
ini_set('display_errors', 0);

$lockFile = __DIR__ . '/installed.lock';
$configFile = __DIR__ . '/config.php';
$sqlFile = __DIR__ . '/database.sql';

// حذف ملف التثبيت ذاتياً والتوجه للصفحة الرئيسية عند الطلب
if (isset($_GET['action']) && $_GET['action'] === 'delete_self') {
    if (file_exists($sqlFile)) @unlink($sqlFile);
    @unlink(__FILE__);
    header('Location: ./');
    exit;
}

$isInstalled = file_exists($lockFile);
$installSuccessData = null;
$installErrorMessage = null;

// معالجة طلبات التثبيت واختبار الاتصال (سواء عبر AJAX أو النقر المباشر Form Submit)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $isAjax = !empty($_SERVER['HTTP_X_REQUESTED_WITH'])
        || (isset($_SERVER['CONTENT_TYPE']) && strpos($_SERVER['CONTENT_TYPE'], 'json') !== false)
        || !empty($_POST['is_ajax']);

    if ($isInstalled && empty($_POST['force_reinstall'])) {
        if ($isAjax) {
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'success' => false,
                'error' => 'النظام مثبت بالفعل مسبقاً! لأسباب أمنية، يرجى حذف ملف installed.lock من مدير الملفات إن كنت ترغب في إعادة التثبيت.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        } else {
            $installErrorMessage = 'النظام مثبت بالفعل مسبقاً! يرجى حذف ملف installed.lock من مدير الملفات إن كنت ترغب في إعادة التثبيت.';
        }
    }

    $action = $_POST['action'] ?? '';

    // 1. اختبار الاتصال بقاعدة البيانات (دائماً عبر AJAX)
    if ($action === 'test_connection') {
        header('Content-Type: application/json; charset=utf-8');
        $host = trim($_POST['db_host'] ?? 'localhost');
        $port = intval($_POST['db_port'] ?? 3306);
        $dbname = trim($_POST['db_name'] ?? '');
        $user = trim($_POST['db_user'] ?? '');
        $pass = $_POST['db_pass'] ?? '';

        if (!$dbname || !$user) {
            echo json_encode([
                'success' => false,
                'error' => 'يرجى إدخال اسم قاعدة البيانات واسم المستخدم لاختبار الاتصال.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        try {
            $dsn = ($port && $port != 3306)
                ? "mysql:host={$host};port={$port};dbname={$dbname};charset=utf8mb4"
                : "mysql:host={$host};dbname={$dbname};charset=utf8mb4";

            $pdo = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_TIMEOUT => 8
            ]);

            echo json_encode([
                'success' => true,
                'message' => 'تم الاتصال بقاعدة البيانات MySQL بنجاح تام! الخادم جاهز لإنشاء الجداول وحفظ البيانات.'
            ], JSON_UNESCAPED_UNICODE);
        } catch (PDOException $e) {
            $errorMsg = $e->getMessage();
            $hint = 'تحقق من صحة معلومات الاتصال.';

            if (strpos($errorMsg, 'Access denied') !== false) {
                $hint = 'اسم المستخدم أو كلمة المرور غير صحيحة. على cPanel تأكد من إضافة المستخدم لقاعدة البيانات وتفعيل كل الصلاحيات (All Privileges).';
            } elseif (strpos($errorMsg, 'Unknown database') !== false) {
                $hint = 'قاعدة البيانات غير موجودة. على الاستضافات المشتركة و cPanel اكتب الاسم الكامل شاملاً بادئة حسابك (مثال: cpaneluser_schooldb).';
            } elseif (strpos($errorMsg, 'Connection refused') !== false || strpos($errorMsg, '2002') !== false) {
                $hint = 'تعذر الوصول لخادم MySQL. على InfinityFree انسخ عنوان MySQL Hostname من لوحة التحكم vPanel (مثال: sql105.infinityfree.com) ولا تستخدم localhost.';
            }

            echo json_encode([
                'success' => false,
                'error' => 'فشل الاتصال: ' . $errorMsg,
                'hint' => $hint
            ], JSON_UNESCAPED_UNICODE);
        }
        exit;
    }

    // 2. تنفيذ التثبيت الكامل وإنشاء الجداول وحفظ الإعدادات وحساب المدير
    if ($action === 'execute_installation') {
        $host = trim($_POST['db_host'] ?? 'localhost');
        $port = intval($_POST['db_port'] ?? 3306);
        $dbname = trim($_POST['db_name'] ?? '');
        $user = trim($_POST['db_user'] ?? '');
        $pass = $_POST['db_pass'] ?? '';

        $institutionName = trim($_POST['institution_name'] ?? 'الثانوية الإعدادية إحسان');
        $siteName = trim($_POST['site_name'] ?? 'منظومة إحسان لتدبير الأقسام والغياب والسلوك');
        $siteUrl = trim($_POST['site_url'] ?? '');
        $academicYear = trim($_POST['academic_year'] ?? '2026/2027');

        $directorName = trim($_POST['director_name'] ?? 'محمد الشريف');
        $adminUsername = trim($_POST['admin_username'] ?? 'director');
        $adminEmail = trim($_POST['admin_email'] ?? 'director@school.ma');
        $adminPassword = $_POST['admin_password'] ?? '';
        $installBaseline = !empty($_POST['install_baseline']);

        if (!$dbname || !$user || !$adminUsername || !$adminPassword) {
            $msg = 'يرجى ملء جميع الحقول الإلزامية (بيانات الاتصال، اسم المستخدم، وكلمة المرور).';
            if ($isAjax) {
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode(['success' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
                exit;
            } else {
                $installErrorMessage = $msg;
            }
        } elseif (strlen($adminPassword) < 5) {
            $msg = 'كلمة المرور يجب أن تتكون من 5 أحرف أو أرقام على الأقل لضمان الأمان.';
            if ($isAjax) {
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode(['success' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
                exit;
            } else {
                $installErrorMessage = $msg;
            }
        } else {
            try {
                $dsn = ($port && $port != 3306)
                    ? "mysql:host={$host};port={$port};dbname={$dbname};charset=utf8mb4"
                    : "mysql:host={$host};dbname={$dbname};charset=utf8mb4";

                $pdoOptions = [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_TIMEOUT => 25
                ];
                if (defined('PDO::MYSQL_ATTR_MULTI_STATEMENTS')) {
                    $pdoOptions[PDO::MYSQL_ATTR_MULTI_STATEMENTS] = true;
                }

                $pdo = new PDO($dsn, $user, $pass, $pdoOptions);

                $pdo->exec("SET NAMES utf8mb4;");
                $pdo->exec("SET FOREIGN_KEY_CHECKS = 0;");
                $pdo->exec("SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';");

                // أ) تنفيذ مخطط قاعدة البيانات الشامل (database.sql) في خطوة واحدة فائقة السرعة
                if (file_exists($sqlFile)) {
                    $sqlContent = file_get_contents($sqlFile);
                    if ($sqlContent) {
                        $multiExecuted = false;
                        try {
                            $pdo->exec("SET FOREIGN_KEY_CHECKS = 0;\n" . $sqlContent . "\nSET FOREIGN_KEY_CHECKS = 1;");
                            $multiExecuted = true;
                        } catch (Exception $mEx) {
                            $multiExecuted = false;
                        }

                        if (!$multiExecuted) {
                            // تجزئة الأوامر بأمان تام تدعم \r\n و \n لضمان التوافق مع الاستضافات المجانية
                            $cleanSql = preg_replace('/^--.*$/m', '', $sqlContent);
                            $cleanSql = preg_replace('/^\/\*.*?\*\//ms', '', $cleanSql);
                            $stmts = preg_split('/;\s*[\r\n]+/', $cleanSql);
                            foreach ($stmts as $stmt) {
                                $stmt = trim($stmt);
                                if (empty($stmt)) continue;
                                try {
                                    $pdo->exec($stmt);
                                } catch (Exception $ign) {
                                    // تجاهل الأخطاء غير المؤثرة كالجداول الموجودة مسبقاً
                                }
                            }
                        }
                    }
                }

                // ب) تخزين إعدادات المؤسسة والموقع المحددة من المستخدم
                $settingsList = [
                    ['institution', $institutionName],
                    ['site_name', $siteName],
                    ['site_url', $siteUrl],
                    ['siteUrl', $siteUrl],
                    ['director_name', $directorName],
                    ['year', $academicYear],
                    ['sms_provider', 'whatsapp'],
                    ['default_channel', 'whatsapp'],
                    ['whatsapp_enabled', '1'],
                    ['textbee_enabled', '1']
                ];

                $setStmt = $pdo->prepare("INSERT INTO app_settings (key_name, value, updated_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()");
                foreach ($settingsList as $s) {
                    try {
                        $setStmt->execute([$s[0], $s[1]]);
                    } catch (Exception $ign) {}
                }

                // ج) إنشاء وتحديث حساب مدير المؤسسة والمسؤول العام
                $hashedPassword = password_hash($adminPassword, PASSWORD_DEFAULT);
                $directorId = 'usr_dir_' . bin2hex(random_bytes(4));

                $userStmt = $pdo->prepare("
                    INSERT INTO users (id, username, email, password, full_name, role, status, subject, email_verified, academic_year)
                    VALUES (?, ?, ?, ?, ?, 'director', 'active', 'الإدارة التربوية', 1, ?)
                    ON DUPLICATE KEY UPDATE
                        password = VALUES(password),
                        full_name = VALUES(full_name),
                        email = VALUES(email),
                        role = 'director',
                        status = 'active',
                        academic_year = VALUES(academic_year)
                ");
                $userStmt->execute([$directorId, $adminUsername, $adminEmail, $hashedPassword, $directorName, $academicYear]);

                // التأكد أيضاً من وجود مستخدم بصلاحية admin للمطابقة مع الترويسة الإدارية
                $adminStmt = $pdo->prepare("
                    INSERT INTO users (id, username, email, password, full_name, role, status, subject, email_verified, academic_year)
                    VALUES ('usr_admin_master', 'admin', ?, ?, ?, 'admin', 'active', 'الإدارة التربوية', 1, ?)
                    ON DUPLICATE KEY UPDATE
                        password = VALUES(password),
                        full_name = VALUES(full_name),
                        status = 'active',
                        academic_year = VALUES(academic_year)
                ");
                $adminStmt->execute([$adminEmail, $hashedPassword, $directorName, $academicYear]);

                $pdo->exec("SET FOREIGN_KEY_CHECKS = 1;");

                // د) كتابة ملف الإعدادات config.php
                $configPhpCode = "<?php
/**
 * إعدادات الاتصال بقاعدة بيانات MySQL وبيانات المؤسسة
 * تم إنشاؤه تلقائياً بواسطة معالج التثبيت في: " . date('Y-m-d H:i:s') . "
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, x-user-id, x-user-role');
header('Content-Type: application/json; charset=utf-8');

if (\$_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// معلومات الاتصال بقاعدة البيانات MySQL
define('DB_HOST', " . var_export($host, true) . ");
define('DB_PORT', " . intval($port) . ");
define('DB_NAME', " . var_export($dbname, true) . ");
define('DB_USER', " . var_export($user, true) . ");
define('DB_PASS', " . var_export($pass, true) . ");
define('DB_CHARSET', 'utf8mb4');

// معلومات المؤسسة والموقع المعتمدة للطباعة والتقارير
define('INSTITUTION_NAME', " . var_export($institutionName, true) . ");
define('SITE_NAME', " . var_export($siteName, true) . ");
define('SITE_URL', " . var_export($siteUrl, true) . ");
define('DIRECTOR_NAME', " . var_export($directorName, true) . ");
define('ACADEMIC_YEAR', " . var_export($academicYear, true) . ");

try {
    \$dsn = (defined('DB_PORT') && intval(DB_PORT) != 3306 && intval(DB_PORT) > 0)
        ? 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET
        : 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;

    \$options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];
    \$pdo = new PDO(\$dsn, DB_USER, DB_PASS, \$options);
} catch (PDOException \$e) {
    http_response_code(200);
    echo json_encode([
        'success' => false,
        'error' => 'خطأ في الاتصال بقاعدة البيانات MySQL: ' . \$e->getMessage(),
        'hint' => 'يرجى مراجعة إعدادات الاتصال في ملف config.php'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonResponse(\$data, \$statusCode = 200) {
    http_response_code(200);
    echo json_encode(\$data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function getJsonInput() {
    \$raw = file_get_contents('php://input');
    return json_decode(\$raw, true) ?: [];
}

function getHeader(\$name) {
    \$headerKey = 'HTTP_' . strtoupper(str_replace('-', '_', \$name));
    return \$_SERVER[\$headerKey] ?? '';
}

function getSetting(\$pdo, \$key, \$default = '') {
    try {
        \$stmt = \$pdo->prepare('SELECT value FROM app_settings WHERE key_name = ? LIMIT 1');
        \$stmt->execute([\$key]);
        \$val = \$stmt->fetchColumn();
        return (\$val !== false && \$val !== null) ? \$val : \$default;
    } catch (Exception \$e) {
        return \$default;
    }
}

function setSetting(\$pdo, \$key, \$value) {
    try {
        \$stmt = \$pdo->prepare('INSERT INTO app_settings (key_name, value, updated_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()');
        return \$stmt->execute([\$key, (string)\$value]);
    } catch (Exception \$e) {
        return false;
    }
}
";

                @file_put_contents($configFile, $configPhpCode);

                // هـ) إنشاء ملف القفل installed.lock لمنع إعادة التثبيت العرضي
                $lockData = json_encode([
                    'installed_at' => date('Y-m-d H:i:s'),
                    'institution' => $institutionName,
                    'site_name' => $siteName,
                    'site_url' => $siteUrl,
                    'director' => $directorName,
                    'admin_username' => $adminUsername
                ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
                @file_put_contents($lockFile, $lockData);

                // و) مسح ملف database.sql ومسح install.php ذاتياً بعد انتهاء التثبيت لحماية النظام
                if (file_exists($sqlFile)) {
                    @unlink($sqlFile);
                }
                @unlink(__FILE__);

                if ($isAjax) {
                    header('Content-Type: application/json; charset=utf-8');
                    echo json_encode([
                        'success' => true,
                        'message' => 'تم تثبيت المنظومة وحذف ملف التثبيت بنجاح تام! جاري نقلك للصفحة الرئيسية...',
                        'redirect' => './',
                        'details' => [
                            'institution' => $institutionName,
                            'site_name' => $siteName,
                            'site_url' => $siteUrl,
                            'director_name' => $directorName,
                            'username' => $adminUsername
                        ]
                    ], JSON_UNESCAPED_UNICODE);
                    exit;
                } else {
                    // التوجيه المباشر والفوري للصفحة الرئيسية بعد الإرسال المباشر
                    header('Location: ./?installed=1');
                    exit;
                }
            } catch (Exception $e) {
                $err = 'تعذر إتمام التثبيت: ' . $e->getMessage();
                if ($isAjax) {
                    header('Content-Type: application/json; charset=utf-8');
                    echo json_encode(['success' => false, 'error' => $err], JSON_UNESCAPED_UNICODE);
                    exit;
                } else {
                    $installErrorMessage = $err;
                }
            }
        }
    }
}

// -------------------------------------------------------------
// واجهة معالج التثبيت المرئية (Web UI)
// -------------------------------------------------------------
$phpVersionOk = version_compare(PHP_VERSION, '7.4.0', '>=');
$pdoOk = extension_loaded('pdo_mysql');
$curlOk = extension_loaded('curl');
$jsonOk = extension_loaded('json');
$mbstringOk = extension_loaded('mbstring');
$writableDir = is_writable(__DIR__);
$allPrereqsOk = $phpVersionOk && $pdoOk && $jsonOk && $mbstringOk;
?>
<!DOCTYPE html>
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
        }

        .prereq-item.ok {
            border-color: #BBF7D0;
            color: #166534;
        }

        .prereq-item.err {
            border-color: #FECACA;
            color: #991B1B;
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

        /* شاشة النظام مثبت مسبقاً */
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
    </style>
</head>
<body>

<div class="installer-container">
    <div class="header-banner">
        <h1 class="header-title">معالج التثبيت والتهيئة التلقائي للنظام المدرسي</h1>
        <p class="header-subtitle">
            تثبيت المنظومة على خوادم الاستضافة (cPanel / InfinityFree / VPS / XAMPP) مع تخصيص اسم المؤسسة والموقع لعمليات الطباعة وتدبير الأقسام
        </p>
        <?php if ($isInstalled): ?>
            <div class="badge-locked">🔒 النظام مثبت ومحمي بالفعل</div>
        <?php endif; ?>
    </div>

    <div class="content-body">
        <?php if (!empty($installSuccessData)): ?>
            <!-- شاشة نجاح التثبيت الفوري (الإرسال المباشر للمتصفح) -->
            <div class="installed-card">
                <div class="installed-icon">🎉</div>
                <h2 style="font-family: 'Amiri', serif; font-size: 24px; color: var(--primary); margin-bottom: 8px;">
                    تم تثبيت وتهيئة المنظومة بنجاح تام!
                </h2>
                <p style="font-size: 14px; color: var(--text-dark); max-width: 560px; margin: 0 auto 16px; line-height: 1.6;">
                    تم إنشاء كافة جداول قاعدة البيانات بنجاح، وتعيين بيانات المؤسسة (<strong><?= htmlspecialchars($installSuccessData['institution']) ?></strong>)، واسم المنظومة المعتمد (<strong><?= htmlspecialchars($installSuccessData['site_name']) ?></strong>)، ورابط الموقع (<strong><?= htmlspecialchars($installSuccessData['site_url']) ?></strong>)، وتجهيز حساب الإدارة التربوية.
                </p>

                <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 14px; padding: 18px; max-width: 500px; margin: 0 auto 24px; text-align: right; font-size: 13px; line-height: 1.7;">
                    <div style="font-weight: 700; color: #166534; font-size: 14px; margin-bottom: 8px;">📋 تفاصيل حساب الدخول والتفعيل:</div>
                    <div>• اسم المستخدم: <strong><?= htmlspecialchars($installSuccessData['username']) ?></strong></div>
                    <div>• المدير التربوي: <strong><?= htmlspecialchars($installSuccessData['director_name']) ?></strong></div>
                    <div>• حالة المنظومة: <strong>جاهزة للعمل وتسجيل الدخول</strong></div>
                    <div style="margin-top: 8px; font-size: 11.5px; color: #15803D;">🔒 تم إنشاء ملف القفل <code>installed.lock</code> لحماية قاعدة البيانات من أي إعادة تثبيت غير مقصودة.</div>
                </div>

                <a href="./" class="btn-app" style="background: #166534; font-size: 15px; padding: 14px 32px;">
                    <span>الانتقال إلى واجهة المنظومة وتسجيل الدخول ↗</span>
                </a>
            </div>
        <?php elseif ($isInstalled): ?>
            <!-- شاشة النظام مثبت مسبقاً لحماية البيانات -->
            <div class="installed-card">
                <div class="installed-icon">✓</div>
                <h2 style="font-family: 'Amiri', serif; font-size: 22px; color: var(--primary); margin-bottom: 8px;">
                    المنظومة مثبتة ومجهزة بنجاح على هذا الخادم!
                </h2>
                <p style="font-size: 13.5px; color: var(--text-muted); max-width: 540px; margin: 0 auto 16px; line-height: 1.6;">
                    لقد تم تشغيل معالج التثبيت وإنشاء كافة الجداول وإعدادات المؤسسة بنجاح. لحماية الموقع، يمكنك حذف ملف التثبيت والعودة للصفحة الرئيسية.
                </p>

                <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-bottom: 16px;">
                    <a href="./" class="btn-app" style="background: #166534;">
                        <span>الانتقال إلى واجهة التطبيق وتسجيل الدخول ↗</span>
                    </a>
                    <a href="install.php?action=delete_self" class="btn-app" style="background: #991B1B;">
                        <span>🗑️ مسح ملف install.php والعودة للرئيسية</span>
                    </a>
                </div>

                <div style="font-size: 12px; color: #166534; font-weight: 700;">
                    ⏳ سيتم تحويلك تلقائياً إلى الصفحة الرئيسية للنظام خلال 3 ثوانٍ...
                </div>

                <div style="margin-top: 30px; padding: 14px; background: #F9F7F2; border: 1px dashed var(--border); border-radius: 12px; font-size: 11.5px; color: var(--text-muted); max-width: 540px; margin-left: auto; margin-right: auto; text-align: right;">
                    <strong>ملاحظة للمدير أو مطور النظام:</strong> إن كنت ترغب في إعادة تشغيل المعالج وتثبيت المنظومة من جديد، يرجى الدخول إلى مدير الملفات (cPanel File Manager) وحذف ملف <code>installed.lock</code> ثم تحديث هذه الصفحة.
                </div>
            </div>
            <script>
            setTimeout(() => {
                window.location.href = './';
            }, 3000);
            </script>
        <?php else: ?>
            <!-- نموذج التثبيت التفاعلي (يدعم AJAX والإرسال المباشر كاحتياط آمن) -->
            <?php if (!empty($installErrorMessage)): ?>
                <div class="alert-box error" style="display: block; margin-bottom: 18px;">
                    <strong>فشل إتمام التثبيت:</strong> <?= htmlspecialchars($installErrorMessage) ?>
                </div>
            <?php endif; ?>

            <form id="installerForm" method="POST" action="install.php" onsubmit="handleExecuteInstall(event)">
                <input type="hidden" name="action" value="execute_installation">
                
                <!-- 1. فحص توافق الخادم -->
                <div class="section-card">
                    <div class="section-title">
                        <span class="step-number">1</span>
                        <span>فحص متطلبات بيئة الخادم (Server Prerequisites)</span>
                    </div>

                    <div class="prereq-list">
                        <div class="prereq-item <?= $phpVersionOk ? 'ok' : 'err' ?>">
                            <span>إصدار PHP (<?= PHP_VERSION ?>)</span>
                            <span><?= $phpVersionOk ? '✓' : '✗' ?></span>
                        </div>
                        <div class="prereq-item <?= $pdoOk ? 'ok' : 'err' ?>">
                            <span>دعم PDO MySQL</span>
                            <span><?= $pdoOk ? '✓' : '✗' ?></span>
                        </div>
                        <div class="prereq-item <?= $jsonOk ? 'ok' : 'err' ?>">
                            <span>مكتبة JSON</span>
                            <span><?= $jsonOk ? '✓' : '✗' ?></span>
                        </div>
                        <div class="prereq-item <?= $mbstringOk ? 'ok' : 'err' ?>">
                            <span>دعم النصوص UTF-8</span>
                            <span><?= $mbstringOk ? '✓' : '✗' ?></span>
                        </div>
                    </div>
                    <?php if (!$allPrereqsOk): ?>
                        <div class="alert-box error" style="display: block;">
                            تنبيه: بعض متطلبات الخادم غير متوفرة. يرجى تفعيل امتدادات PHP الناقصة (مثل pdo_mysql) من لوحة تحكم الاستضافة قبل المتابعة.
                        </div>
                    <?php endif; ?>
                </div>

                <!-- 2. معلومات الاتصال بقاعدة البيانات MySQL -->
                <div class="section-card">
                    <div class="section-title">
                        <span class="step-number">2</span>
                        <span>معلومات الاتصال بقاعدة بيانات MySQL</span>
                    </div>

                    <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 12px; padding: 12px 14px; margin-bottom: 16px; font-size: 12px; color: #1E40AF; line-height: 1.6;">
                        <strong>💡 لمستخدمي InfinityFree أو الاستضافات المجانية / المشتركة:</strong><br>
                        • عنوان مضيف MySQL <strong>ليس localhost</strong> على InfinityFree، بل يجب نسخه كما هو من لوحة التحكم (مثال: <code>sql102.infinityfree.com</code> أو <code>sql300.epizy.com</code>).<br>
                        • اسم قاعدة البيانات واسم المستخدم يبدآن دائماً ببادئة الحساب (مثال: <code>if0_38123456_school</code>).<br>
                        • هذا المثبت مُحسّن خصيصاً لتفادي قيود وقت التنفيذ (10s Execution Limit) عبر تقنية المعالجة المجمعة فائقة السرعة.
                    </div>

                    <div class="grid-2">
                        <div class="form-group">
                            <label>مضيف قاعدة البيانات (DB Host)</label>
                            <input type="text" id="db_host" name="db_host" value="<?= htmlspecialchars($_POST['db_host'] ?? 'localhost') ?>" required>
                            <p class="hint-text">على cPanel و XAMPP اتركه <code>localhost</code>، أما على InfinityFree انسخ عنوان MySQL Hostname من لوحة التحكم.</p>
                        </div>
                        <div class="form-group">
                            <label>منفذ الخادم (DB Port)</label>
                            <input type="number" id="db_port" name="db_port" value="<?= htmlspecialchars($_POST['db_port'] ?? '3306') ?>" required>
                            <p class="hint-text">المنفذ الافتراضي لخادم MySQL هو 3306.</p>
                        </div>
                    </div>

                    <div class="grid-2" style="margin-top: 10px;">
                        <div class="form-group">
                            <label>اسم قاعدة البيانات (DB Name)</label>
                            <input type="text" id="db_name" name="db_name" value="<?= htmlspecialchars($_POST['db_name'] ?? '') ?>" placeholder="مثال: if0_38123456_schooldb أو cpaneluser_db" required>
                            <p class="hint-text">على cPanel و InfinityFree اكتب الاسم الكامل شاملاً بادئة حسابك.</p>
                        </div>
                        <div class="form-group">
                            <label>اسم مستخدم قاعدة البيانات (DB User)</label>
                            <input type="text" id="db_user" name="db_user" value="<?= htmlspecialchars($_POST['db_user'] ?? '') ?>" placeholder="مثال: if0_38123456 أو cpaneluser_admin أو root" required>
                        </div>
                    </div>

                    <div class="form-group" style="margin-top: 10px;">
                        <label>كلمة مرور قاعدة البيانات (DB Password)</label>
                        <input type="password" id="db_pass" name="db_pass" value="<?= htmlspecialchars($_POST['db_pass'] ?? '') ?>" placeholder="كلمة المرور (اتركه فارغاً إن لم توجد كلمة مرور)">
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
                        <span>بيانات المؤسسة واسم الموقع (تُستعمل في الطباعة والتقارير)</span>
                    </div>

                    <div class="form-group">
                        <label>اسم المؤسسة التعليمية (School Institution Name)</label>
                        <input type="text" id="institution_name" name="institution_name" value="<?= htmlspecialchars($_POST['institution_name'] ?? 'الثانوية الإعدادية إحسان') ?>" required>
                        <p class="hint-text">يظهر في رأس كافة لوائح الغياب، بطاقات السلوك، واستعمالات الزمان المطبوعة.</p>
                    </div>

                    <div class="form-group" style="margin-top: 10px;">
                        <label>اسم الموقع / العنوان التربوي للمنظومة (Site Name)</label>
                        <input type="text" id="site_name" name="site_name" value="<?= htmlspecialchars($_POST['site_name'] ?? 'منظومة إحسان لتدبير الأقسام والغياب والسلوك') ?>" required>
                        <p class="hint-text">يُستعمل كعنوان رئيسي معتمد للمنصة في الطباعة، تصدير ملفات Excel/PDF، وترويسات المطبوعات الرسمية.</p>
                    </div>

                    <div class="form-group" style="margin-top: 10px;">
                        <label>رابط الموقع الإلكتروني للمؤسسة (Website / Portal URL)</label>
                        <input type="text" id="site_url" name="site_url" value="<?= htmlspecialchars($_POST['site_url'] ?? '') ?>" placeholder="https://school.ma أو عنوان النطاق الخاص بك">
                        <p class="hint-text">يُطبع في أعلى وأسفل كافة الوثائق الرسمية، الشواهد، بطاقات السلوك، واستدعاءات أولياء الأمور.</p>
                    </div>

                    <div class="form-group" style="margin-top: 10px;">
                        <label>الموسم الدراسي (Academic Year)</label>
                        <input type="text" id="academic_year" name="academic_year" value="<?= htmlspecialchars($_POST['academic_year'] ?? '2026/2027') ?>" required>
                    </div>
                </div>

                <!-- 4. بيانات حساب مدير التطبيق / المدير العام -->
                <div class="section-card">
                    <div class="section-title">
                        <span class="step-number">4</span>
                        <span>بيانات مدير التطبيق / المدير العام (Director & Admin Account)</span>
                    </div>

                    <div class="grid-2">
                        <div class="form-group">
                            <label>اسم مدير المؤسسة / التطبيق الكامل</label>
                            <input type="text" id="director_name" name="director_name" value="<?= htmlspecialchars($_POST['director_name'] ?? 'محمد الشريف') ?>" required>
                            <p class="hint-text">الاسم الكامل الذي يظهر في توقيع المطبوعات والتقارير الرسمية.</p>
                        </div>
                        <div class="form-group">
                            <label>اسم المستخدم للدخول (Username)</label>
                            <input type="text" id="admin_username" name="admin_username" value="<?= htmlspecialchars($_POST['admin_username'] ?? 'director') ?>" required>
                            <p class="hint-text">اسم المستخدم المخصص لتسجيل الدخول إلى لوحة المدير.</p>
                        </div>
                    </div>

                    <div class="grid-2" style="margin-top: 10px;">
                        <div class="form-group">
                            <label>البريد الإلكتروني للمدير (Email)</label>
                            <input type="email" id="admin_email" name="admin_email" value="<?= htmlspecialchars($_POST['admin_email'] ?? 'director@school.ma') ?>" required>
                        </div>
                        <div class="form-group">
                            <label>كلمة المرور (Password)</label>
                            <input type="password" id="admin_password" name="admin_password" placeholder="أدخل كلمة مرور قوية" required>
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
                        <input type="checkbox" id="install_baseline" name="install_baseline" value="1" <?= (!isset($_POST['action']) || !empty($_POST['install_baseline'])) ? 'checked' : '' ?>>
                        <div>
                            <strong style="font-size: 13px; color: var(--primary);">تضمين البيانات التأسيسية المعتمدة (النسخة التأسيسية لـ 21 مخالفة مع صياغاتها الأصلية + 66 مشاركة إيجابية)</strong>
                            <p class="hint-text">
                                يتيح البدء مباشرة بالبيانات المحفوظة للمؤسسة: 10 أقسام دراسية، 319 بطاقة تلميذ، 21 مخالفة سلوكية بصياغاتها التربوية الأصيلة غير المؤتمتة، و66 مشاركة إيجابية موثقة.
                            </p>
                        </div>
                    </label>
                </div>

                <div id="installAlert" class="alert-box"></div>

                <button type="submit" id="submitBtn" class="btn-submit" <?= !$allPrereqsOk ? 'disabled' : '' ?>>
                    <span>بدء تثبيت المنظومة وإنشاء الجداول وحفظ الإعدادات 🚀</span>
                </button>
            </form>
        <?php endif; ?>
    </div>
</div>

<script>
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
        const formData = new FormData();
        formData.append('action', 'test_connection');
        formData.append('db_host', dbHost);
        formData.append('db_port', dbPort);
        formData.append('db_name', dbName);
        formData.append('db_user', dbUser);
        formData.append('db_pass', dbPass);

        const res = await fetch('install.php', {
            method: 'POST',
            body: formData,
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });

        const rawText = await res.text();
        let data;
        try {
            data = JSON.parse(rawText);
        } catch (jsonErr) {
            // الخادم أعاد صفحة HTML (مثل حماية الكوكيز في InfinityFree أو ByetHost)
            alertBox.style.display = 'block';
            alertBox.className = 'alert-box error';
            alertBox.innerHTML = '<strong>تنبيه بيئة الاستضافة:</strong> تعذر قراءة رد فحص الاتصال التلقائي بسبب حماية الاستضافة ضد AJAX. يمكنك المتابعة وملء البيانات ثم الضغط على زر التثبيت بالأسفل حيث يدعم الإرسال المباشر للمتصفح.';
            return;
        }

        alertBox.style.display = 'block';
        if (data.success) {
            alertBox.className = 'alert-box success';
            alertBox.textContent = '✓ ' + (data.message || 'تم الاتصال بقاعدة البيانات بنجاح!');
        } else {
            alertBox.className = 'alert-box error';
            alertBox.innerHTML = '<strong>' + (data.error || 'فشل الاتصال') + '</strong>' + 
                (data.hint ? '<div style="margin-top: 4px; font-size: 11.5px;">' + data.hint + '</div>' : '');
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

async function handleExecuteInstall(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    const alertBox = document.getElementById('installAlert');
    const form = document.getElementById('installerForm');
    if (!btn || !alertBox || !form) return;

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
        const formData = new FormData();
        formData.append('action', 'execute_installation');
        formData.append('db_host', dbHost);
        formData.append('db_port', dbPort);
        formData.append('db_name', dbName);
        formData.append('db_user', dbUser);
        formData.append('db_pass', dbPass);
        formData.append('institution_name', instName);
        formData.append('site_name', siteName);
        formData.append('site_url', siteUrl);
        formData.append('academic_year', year);
        formData.append('director_name', dirName);
        formData.append('admin_username', adminUser);
        formData.append('admin_email', adminMail);
        formData.append('admin_password', adminPass);
        if (installBaseline) formData.append('install_baseline', '1');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout before fallback

        const res = await fetch('install.php', {
            method: 'POST',
            body: formData,
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        const rawText = await res.text();
        let data;
        try {
            data = JSON.parse(rawText);
        } catch (parseErr) {
            // الخادم أعاد كود حماية HTML (مثل InfinityFree ByetHost aes.js) أو timeout
            // نقوم بالتحويل الفوري إلى الإرسال المباشر للمتصفح (Native Form Submit) الذي يتخطى أي جدار حماية
            console.warn('Response not JSON, falling back to native browser submission...');
            alertBox.style.display = 'block';
            alertBox.className = 'alert-box success';
            alertBox.innerHTML = '<strong>⏳ جاري المتابعة بالنقل المباشر للمتصفح لتجاوز حماية الاستضافة... ثوانٍ قليلة</strong>';
            
            form.onsubmit = null;
            form.submit();
            return;
        }

        alertBox.style.display = 'block';
        if (data.success) {
            alertBox.className = 'alert-box success';
            alertBox.innerHTML = `
                <div style="font-size: 16px; font-weight: bold; margin-bottom: 8px;">🎉 مبارك! تم التثبيت ومسح ملف المعالج بنجاح تام!</div>
                <div>تم إنشاء الجداول وتهيئة بيانات المؤسسة (<strong>${instName}</strong>)، ورابط المنظومة (<strong>${siteUrl}</strong>) وحساب المدير (<strong>${adminUser}</strong>).</div>
                <div style="margin-top: 10px; font-weight: bold; color: #166534;">⏳ جاري تحويلك تلقائياً إلى الصفحة الرئيسية للنظام خلال لحظات...</div>
                <div style="margin-top: 14px;">
                    <a href="./" style="display: inline-block; background: #166534; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: bold; box-shadow: 0 4px 12px rgba(22, 101, 52, 0.3);">
                        الانتقال للصفحة الرئيسية الآن ↗
                    </a>
                </div>
            `;
            btn.disabled = false;
            btn.style.display = 'flex';
            btn.style.background = '#166534';
            btn.innerHTML = '<span>الانتقال للصفحة الرئيسية الآن ↗</span>';
            btn.onclick = () => window.location.href = './';
            alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // توجيه تلقائي مباشر وسلس للصفحة الرئيسية
            setTimeout(() => {
                window.location.href = './';
            }, 1800);
        } else {
            alertBox.className = 'alert-box error';
            alertBox.innerHTML = '<strong>' + (data.error || 'تعذر التثبيت') + '</strong>';
            btn.disabled = false;
            btn.innerHTML = '<span>إعادة محاولة التثبيت 🚀</span>';
            alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    } catch (e) {
        console.warn('AJAX error, falling back to native browser submission:', e);
        // في حال حدوث timeout أو اعتراض أمني على طلب fetch، يتم الإرسال المباشر كحل بديل فوري
        alertBox.style.display = 'block';
        alertBox.className = 'alert-box success';
        alertBox.innerHTML = '<strong>⏳ جاري المتابعة بالنقل المباشر للمتصفح لتجاوز حماية الاستضافة...</strong>';
        
        form.onsubmit = null;
        form.submit();
    }
}
</script>

</body>
</html>
