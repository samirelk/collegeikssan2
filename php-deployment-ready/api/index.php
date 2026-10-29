<?php
/**
 * خادم واجهة البرمجة (REST API) بنظام PHP & MySQL
 * بديل كامل ومتوافق 100% مع واجهة React الأمامية لتشغيلها على أي استضافة مشتركة
 */

require_once __DIR__ . '/../config.php';

$method = $_SERVER['REQUEST_METHOD'];
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// دعم التوجيه عبر الرابط الجميل أو عبر باراميتر route= أو المسارات الفرعية
$basePath = '/api';
$pos = strpos($uri, $basePath);
$path = ($pos !== false) ? substr($uri, $pos + strlen($basePath)) : $uri;
$path = trim($path, '/');
if (!empty($_GET['route'])) {
    $path = trim($_GET['route'], '/');
}
$segments = $path ? explode('/', $path) : [];
$segments = array_map(function($s) { return preg_replace('/\.php$/i', '', $s); }, $segments);

$userId = getHeader('x-user-id') ?: ($_GET['userId'] ?? '');
$userRole = getHeader('x-user-role') ?: ($_GET['userRole'] ?? 'teacher');

// -------------------------------------------------------------
// 1. المصادقة والمستخدمون (Authentication & Users)
// -------------------------------------------------------------
if (isset($segments[0]) && $segments[0] === 'auth') {
    $action = $segments[1] ?? '';

    // تسجيل الدخول
    if ($action === 'login' && $method === 'POST') {
        $input = getJsonInput();
        $identifier = trim($input['identifier'] ?? $input['username'] ?? $input['email'] ?? '');
        $password = (string)($input['password'] ?? '');

        if (!$identifier || !$password) {
            jsonResponse(['success' => false, 'error' => 'يرجى إدخال اسم المستخدم وكلمة المرور.']);
        }

        $stmt = $pdo->prepare("SELECT * FROM users WHERE (username = ? OR email = ?) LIMIT 1");
        $stmt->execute([$identifier, $identifier]);
        $user = $stmt->fetch();

        if ($user) {
            $isCorrect = false;
            if (password_verify($password, $user['password'])) {
                $isCorrect = true;
            } elseif ($password === $user['password']) {
                $isCorrect = true;
            } elseif ($user['password'] === md5($password)) {
                $isCorrect = true;
            }

            if ($isCorrect) {
                if (isset($user['status']) && $user['status'] !== 'active') {
                    jsonResponse(['success' => false, 'isPending' => true, 'error' => 'حسابك في انتظار تفعيل الإدارة التربوية.']);
                }
                unset($user['password']);
                jsonResponse(['success' => true, 'user' => $user]);
            }
        }
        jsonResponse(['success' => false, 'error' => 'اسم المستخدم أو كلمة المرور غير صحيحة.']);
    }

    // تسجيل حساب جديد
    if ($action === 'register' && $method === 'POST') {
        $input = getJsonInput();
        $id = 'usr_' . bin2hex(random_bytes(8));
        $username = trim($input['username'] ?? '');
        $email = trim($input['email'] ?? '');
        $fullName = trim($input['fullName'] ?? '');
        $password = password_hash($input['password'] ?? '123456', PASSWORD_DEFAULT);
        $role = $input['role'] ?? 'teacher';
        $subject = $input['subject'] ?? 'الرياضيات';

        try {
            $stmt = $pdo->prepare("INSERT INTO users (id, username, email, password, full_name, role, status, subject) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)");
            $stmt->execute([$id, $username, $email, $password, $fullName, $role, $subject]);
            jsonResponse(['success' => true, 'message' => 'تم إنشاء الحساب بنجاح وهو في انتظار موافقة الإدارة']);
        } catch (PDOException $e) {
            jsonResponse(['success' => false, 'error' => 'اسم المستخدم أو البريد الإلكتروني مسجل مسبقاً.'], 400);
        }
    }

    // قائمة المستخدمين أو الأساتذة للمدير
    if (($action === 'users' || $action === 'teachers') && $method === 'GET') {
        $stmt = $pdo->query("SELECT id, username, email, full_name as fullName, role, status, subject, academic_year as academicYear, email_verified as emailVerified, created_at as createdAt FROM users WHERE role = 'teacher' OR ? = 'users' ORDER BY created_at DESC");
        $stmt->execute([$action]);
        $rows = $stmt->fetchAll();
        jsonResponse(['success' => true, 'users' => $rows, 'teachers' => $rows]);
    }

    // إنشاء أستاذ مفعل مباشرة من الإدارة
    if (($action === 'admin-create-teacher' || $action === 'teachers') && $method === 'POST') {
        $input = getJsonInput();
        $id = 'usr_' . bin2hex(random_bytes(8));
        $username = trim($input['username'] ?? '');
        $email = trim($input['email'] ?? '');
        $fullName = trim($input['fullName'] ?? '');
        $password = password_hash($input['password'] ?? '123456', PASSWORD_DEFAULT);
        $role = 'teacher';
        $subject = $input['subject'] ?? 'الرياضيات';

        try {
            $stmt = $pdo->prepare("INSERT INTO users (id, username, email, password, full_name, role, status, subject, email_verified) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, 1)");
            $stmt->execute([$id, $username, $email, $password, $fullName, $role, $subject]);
            jsonResponse(['success' => true, 'message' => 'تم إنشاء حساب الأستاذ وتفعيله بنجاح']);
        } catch (PDOException $e) {
            jsonResponse(['success' => false, 'error' => 'اسم المستخدم أو البريد الإلكتروني مسجل مسبقاً']);
        }
    }

    // تفعيل البريد الإلكتروني يدوياً
    if ($action === 'manual-verify-email' && $method === 'POST') {
        $input = getJsonInput();
        $email = trim($input['email'] ?? '');
        $pdo->prepare("UPDATE users SET email_verified = 1 WHERE email = ?")->execute([$email]);
        jsonResponse(['success' => true, 'message' => 'تم تأكيد البريد الإلكتروني بنجاح']);
    }

    // إعادة تعيين كلمة مرور أستاذ
    if (($action === 'teachers' || $action === 'users') && isset($segments[2]) && $segments[2] === 'reset-password' && $method === 'PUT') {
        $targetId = $segments[1];
        $input = getJsonInput();
        $newPass = password_hash($input['password'] ?? '123456', PASSWORD_DEFAULT);
        $pdo->prepare("UPDATE users SET password = ? WHERE id = ?")->execute([$newPass, $targetId]);
        jsonResponse(['success' => true, 'message' => 'تمت إعادة تعيين كلمة المرور بنجاح']);
    }

    // تعديل حالة مستخدم أو أستاذ (قبول / تفعيل / تعطيل)
    if (($action === 'users' || $action === 'teachers') && isset($segments[1]) && isset($segments[2]) && $segments[2] === 'status' && $method === 'PUT') {
        $targetId = $segments[1];
        $input = getJsonInput();
        $newStatus = $input['status'] ?? 'active';

        $stmt = $pdo->prepare("UPDATE users SET status = ? WHERE id = ?");
        $stmt->execute([$newStatus, $targetId]);
        jsonResponse(['success' => true, 'message' => 'تم تحديث حالة المستخدم بنجاح']);
    }

    // حذف أستاذ
    if (($action === 'teachers' || $action === 'users') && isset($segments[1]) && $method === 'DELETE') {
        $targetId = $segments[1];
        $pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$targetId]);
        jsonResponse(['success' => true, 'message' => 'تم حذف المستخدم بنجاح']);
    }
}

// -------------------------------------------------------------
// 2. إعدادات المؤسسة (Settings)
// -------------------------------------------------------------
if ($segments[0] === 'settings') {
    if ($method === 'GET') {
        $stmt = $pdo->query("SELECT key_name, value FROM app_settings");
        $settings = [];
        while ($row = $stmt->fetch()) {
            $settings[$row['key_name']] = $row['value'];
        }
        jsonResponse([
            'institution' => $settings['institution'] ?? 'الثانوية الإعدادية ايكسان',
            'year' => $settings['year'] ?? '2026/2027',
            'teacher' => $settings['teacher'] ?? ''
        ]);
    }

    if ($method === 'POST') {
        $input = getJsonInput();
        foreach (['institution', 'year', 'teacher'] as $key) {
            if (isset($input[$key])) {
                $stmt = $pdo->prepare("INSERT INTO app_settings (key_name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?");
                $stmt->execute([$key, $input[$key], $input[$key]]);
            }
        }
        jsonResponse(['success' => true, 'message' => 'تم حفظ الإعدادات بنجاح']);
    }
}

// -------------------------------------------------------------
// 3. الأقسام والمقاعد (Sections & Seats)
// -------------------------------------------------------------
if ($segments[0] === 'sections') {
    // جلب جميع الأقسام مع مقاعدها وتفاصيلها
    if ($method === 'GET' && count($segments) === 1) {
        $stmt = $pdo->query("SELECT * FROM sections ORDER BY level ASC, class_number ASC");
        $sections = $stmt->fetchAll();

        $result = [];
        foreach ($sections as $sec) {
            $secId = $sec['id'];

            // جلب المقاعد
            $seatStmt = $pdo->prepare("SELECT * FROM seats WHERE section_id = ? ORDER BY seat_num ASC");
            $seatStmt->execute([$secId]);
            $seatsRows = $seatStmt->fetchAll();

            // جلب تخصيصات الأستاذ إن وجدت
            $overrideMap = [];
            if ($userRole === 'teacher' && $userId) {
                $ovStmt = $pdo->prepare("SELECT * FROM teacher_seat_overrides WHERE teacher_id = ? AND section_id = ?");
                $ovStmt->execute([$userId, $secId]);
                while ($ov = $ovStmt->fetch()) {
                    $overrideMap[$ov['seat_num']] = $ov;
                }
            }

            // جلب المشاركات الإيجابية للقسم
            $posStmt = $pdo->prepare("SELECT * FROM positive_participations WHERE section_id = ? ORDER BY created_at DESC");
            $posStmt->execute([$secId]);
            $posRows = $posStmt->fetchAll();

            // جلب المخالفات للقسم
            $vioStmt = $pdo->prepare("SELECT * FROM daily_violations WHERE section_id = ? ORDER BY created_at DESC");
            $vioStmt->execute([$secId]);
            $vioRows = $vioStmt->fetchAll();

            $seats = [];
            for ($i = 1; $i <= 40; $i++) {
                $s = null;
                foreach ($seatsRows as $row) {
                    if ($row['seat_num'] == $i) { $s = $row; break; }
                }
                $ov = $overrideMap[$i] ?? null;

                $stName = $ov ? $ov['student_name'] : ($s['student_name'] ?? '');
                $stNum = $ov ? $ov['student_number'] : ($s['student_number'] ?? '');
                $stMassar = $ov ? $ov['massar_number'] : ($s['massar_number'] ?? '');
                $stColor = $ov ? $ov['status_color'] : ($s['status_color'] ?? 'default');
                $stAtt = $s['attendance'] ?? null;

                // مطابقة المشاركات الإيجابية لهذا المقعد/التلميذ
                $matchingPos = [];
                if ($stName) {
                    foreach ($posRows as $p) {
                        if (trim($p['student_name']) === trim($stName)) {
                            $matchingPos[] = [
                                'id' => $p['id'],
                                'sectionId' => $p['section_id'],
                                'seatNum' => $i,
                                'studentName' => $p['student_name'],
                                'studentNumber' => $p['student_number'],
                                'massarNumber' => $p['massar_number'],
                                'participationType' => $p['participation_type'],
                                'points' => (int)$p['points'],
                                'note' => $p['note'],
                                'teacherName' => $p['teacher_name'],
                                'teacherSubject' => $p['teacher_subject'],
                                'recordedDate' => $p['recorded_date'],
                                'recordedTime' => $p['recorded_time'],
                                'createdAt' => $p['created_at']
                            ];
                        }
                    }
                }

                // مطابقة المخالفات لهذا المقعد/التلميذ
                $matchingVio = [];
                if ($stName) {
                    foreach ($vioRows as $v) {
                        if (trim($v['student_name']) === trim($stName)) {
                            $matchingVio[] = [
                                'id' => $v['id'],
                                'sectionId' => $v['section_id'],
                                'seatNum' => $i,
                                'studentName' => $v['student_name'],
                                'violationType' => $v['violation_type'],
                                'description' => $v['description'],
                                'actionTaken' => $v['action_taken'],
                                'teacherName' => $v['teacher_name'],
                                'recordedDate' => $v['recorded_date']
                            ];
                        }
                    }
                }

                $posCount = array_reduce($matchingPos, function($acc, $item) { return $acc + ($item['points'] ?? 1); }, 0);

                $seats[] = [
                    'seat' => $i,
                    'name' => $stName,
                    'number' => $stNum,
                    'massarNumber' => $stMassar,
                    'rosterId' => $s['roster_id'] ?? null,
                    'statusColor' => $stColor,
                    'attendance' => $stAtt,
                    'positiveParticipations' => $matchingPos,
                    'positiveParticipationCount' => $posCount,
                    'violations' => $matchingVio,
                    'notes' => []
                ];
            }

            $roster = json_decode($sec['roster_json'] ?? '[]', true) ?: [];

            $result[] = [
                'id' => $sec['id'],
                'level' => $sec['level'],
                'classNumber' => $sec['class_number'],
                'teacher' => $sec['teacher'],
                'assignedTeacherId' => $sec['assigned_teacher_id'],
                'academicYear' => $sec['academic_year'],
                'roster' => $roster,
                'seats' => $seats
            ];
        }

        jsonResponse(['success' => true, 'sections' => $result]);
    }

    // إضافة قسم جديد
    if ($method === 'POST' && count($segments) === 1) {
        $input = getJsonInput();
        $id = 'sec_' . bin2hex(random_bytes(6));
        $level = $input['level'] ?? 'المستوى الأول';
        $classNumber = $input['classNumber'] ?? '1';
        $teacher = $input['teacher'] ?? '';

        $stmt = $pdo->prepare("INSERT INTO sections (id, level, class_number, teacher) VALUES (?, ?, ?, ?)");
        $stmt->execute([$id, $level, $classNumber, $teacher]);

        // تهيئة 40 مقعد فارغ للقسم
        $seatStmt = $pdo->prepare("INSERT INTO seats (section_id, seat_num) VALUES (?, ?)");
        for ($i = 1; $i <= 40; $i++) {
            $seatStmt->execute([$id, $i]);
        }

        jsonResponse(['success' => true, 'section' => ['id' => $id, 'level' => $level, 'classNumber' => $classNumber, 'seats' => []]]);
    }

    // تحديث مجمع للمقاعد (Batch Update)
    if (isset($segments[1]) && isset($segments[2]) && $segments[2] === 'seats' && isset($segments[3]) && $segments[3] === 'batch-update' && $method === 'POST') {
        $secId = $segments[1];
        $input = getJsonInput();
        $updates = $input['updates'] ?? [];

        $pdo->beginTransaction();
        try {
            foreach ($updates as $u) {
                $seatNum = (int)$u['seatNum'];
                $name = $u['name'] ?? null;
                $num = $u['number'] ?? null;
                $massar = $u['massarNumber'] ?? null;
                $rosterId = $u['rosterId'] ?? null;
                $color = $u['statusColor'] ?? null;
                $attendance = array_key_exists('attendance', $u) ? $u['attendance'] : null;

                // إذا كان أستاذ ومعه تغيير ترتيب خاص
                if ($userRole === 'teacher' && $userId && !array_key_exists('attendance', $u)) {
                    $ovStmt = $pdo->prepare("INSERT INTO teacher_seat_overrides (teacher_id, section_id, seat_num, student_name, student_number, massar_number, status_color)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE student_name = VALUES(student_name), student_number = VALUES(student_number), massar_number = VALUES(massar_number), status_color = VALUES(status_color)");
                    $ovStmt->execute([$userId, $secId, $seatNum, $name ?: '', $num ?: '', $massar ?: '', $color ?: 'default']);
                } else {
                    // تحديث أساسي للقسم والمقعد
                    $sql = "UPDATE seats SET updated_at = NOW()";
                    $params = [];
                    if ($name !== null) { $sql .= ", student_name = ?"; $params[] = $name; }
                    if ($num !== null) { $sql .= ", student_number = ?"; $params[] = $num; }
                    if ($massar !== null) { $sql .= ", massar_number = ?"; $params[] = $massar; }
                    if ($rosterId !== null) { $sql .= ", roster_id = ?"; $params[] = $rosterId; }
                    if ($color !== null) { $sql .= ", status_color = ?"; $params[] = $color; }
                    if (array_key_exists('attendance', $u)) { $sql .= ", attendance = ?"; $params[] = $attendance; }

                    $sql .= " WHERE section_id = ? AND seat_num = ?";
                    $params[] = $secId;
                    $params[] = $seatNum;

                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($params);

                    // إذا تم تغيير حالة الحضور إلى غائب أو متأخر، سجل في أرشيف الغياب
                    if (($attendance === 'absent' || $attendance === 'late') && $name) {
                        $today = date('Y-m-d');
                        $chk = $pdo->prepare("SELECT id FROM attendance_history WHERE section_id = ? AND student_name = ? AND recorded_date = ?");
                        $chk->execute([$secId, trim($name), $today]);
                        if (!$chk->fetch()) {
                            $insAtt = $pdo->prepare("INSERT INTO attendance_history (section_id, seat_num, student_name, student_number, status, recorded_date, session_period, teacher_name) VALUES (?, ?, ?, ?, ?, ?, '1 ساعة', ?)");
                            $insAtt->execute([$secId, $seatNum, trim($name), trim($num ?: ''), $attendance, $today, $userId]);
                        }
                    } elseif ($attendance === null || $attendance === 'present') {
                        $today = date('Y-m-d');
                        $chk = $pdo->prepare("SELECT * FROM attendance_history WHERE section_id = ? AND (seat_num = ? OR student_name = ?) AND recorded_date = ? ORDER BY created_at DESC LIMIT 1");
                        $chk->execute([$secId, $seatNum, trim($name), $today]);
                        $attRow = $chk->fetch();

                        if ($attRow) {
                            $createdTimestamp = strtotime($attRow['created_at']);
                            $diffSec = time() - $createdTimestamp;
                            $sameTeacher = $userId && ($attRow['teacher_name'] == $userId || ($attRow['created_by'] ?? '') == $userId);
                            $isQuickUndo = $sameTeacher && $diffSec <= 3600; // خلال نفس الحصة (60 دقيقة)

                            if ($isQuickUndo) {
                                // خطأ تسجيل في نفس الفترة: حذف نهائي ولا يُسجل في الأرشيف
                                $delAtt = $pdo->prepare("DELETE FROM attendance_history WHERE id = ?");
                                $delAtt->execute([$attRow['id']]);
                            } else {
                                // تسوية نظامية: توثيق الإزالة والمدة في الأرشيف
                                $removerStmt = $pdo->prepare("SELECT full_name, subject FROM users WHERE id = ?");
                                $removerStmt->execute([$userId]);
                                $removerUser = $removerStmt->fetch();

                                $removerName = $removerUser ? $removerUser['full_name'] : ($userRole === 'director' ? 'إدارة المؤسسة' : 'الأستاذ');
                                $removerSub = $removerUser ? $removerUser['subject'] : '';

                                $hours = max(1, round($diffSec / 3600));
                                if ($hours < 8) {
                                    $durLabel = $hours . ' ساعة';
                                    $durDays = 0;
                                } else {
                                    $durDays = max(1, round($hours / 24));
                                    $durLabel = ($durDays == 1 ? '1 يوم' : ($durDays == 2 ? '2 يومان' : ($durDays <= 10 ? $durDays . ' أيام' : $durDays . ' يوم')));
                                }

                                $updAtt = $pdo->prepare("UPDATE attendance_history SET removed_by = ?, removed_at = NOW(), remover_name = ?, remover_subject = ?, duration_hours = ?, duration_days = ?, duration_label = ? WHERE id = ?");
                                $updAtt->execute([$userId, $removerName, $removerSub, $hours, $durDays, $durLabel, $attRow['id']]);
                            }
                        }
                    }
                }
            }
            $pdo->commit();
            jsonResponse(['success' => true, 'count' => count($updates)]);
        } catch (Exception $e) {
            $pdo->rollBack();
            jsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    // تسجيل مشاركة إيجابية
    if (isset($segments[1]) && isset($segments[2]) && $segments[2] === 'seats' && isset($segments[4]) && $segments[4] === 'positive-participations' && $method === 'POST') {
        $secId = $segments[1];
        $seatNum = (int)$segments[3];
        $input = getJsonInput();

        $id = 'pos_' . round(microtime(true) * 1000) . '_' . bin2hex(random_bytes(3));
        $studentName = trim($input['studentName'] ?? '');
        $studentNumber = trim($input['studentNumber'] ?? '');
        $massarNumber = trim($input['massarNumber'] ?? '');
        $pType = $input['participationType'] ?? 'مشاركة صفية متميزة';
        $points = max(1, (int)($input['points'] ?? 1));
        $note = $input['note'] ?? '';
        $teacherName = $input['teacherName'] ?? '';
        $teacherSubject = $input['teacherSubject'] ?? '';
        $date = $input['recordedDate'] ?? date('Y-m-d');
        $time = $input['recordedTime'] ?? date('H:i');

        if (!$studentName) {
            jsonResponse(['success' => false, 'error' => 'اسم التلميذ مطلوب لتسجيل المشاركة'], 400);
        }

        $stmt = $pdo->prepare("INSERT INTO positive_participations (id, section_id, seat_num, student_name, student_number, massar_number, participation_type, points, note, teacher_name, teacher_subject, recorded_date, recorded_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$id, $secId, $seatNum, $studentName, $studentNumber, $massarNumber, $pType, $points, $note, $teacherName, $teacherSubject, $date, $time]);

        jsonResponse([
            'success' => true,
            'participation' => [
                'id' => $id,
                'sectionId' => $secId,
                'seatNum' => $seatNum,
                'studentName' => $studentName,
                'studentNumber' => $studentNumber,
                'massarNumber' => $massarNumber,
                'participationType' => $pType,
                'points' => $points,
                'note' => $note,
                'teacherName' => $teacherName,
                'teacherSubject' => $teacherSubject,
                'recordedDate' => $date,
                'recordedTime' => $time,
                'createdAt' => date('c')
            ]
        ]);
    }

    // حذف مشاركة إيجابية
    if (isset($segments[1]) && isset($segments[2]) && $segments[2] === 'positive-participations' && isset($segments[3]) && $method === 'DELETE') {
        $pId = $segments[3];
        $stmt = $pdo->prepare("DELETE FROM positive_participations WHERE id = ?");
        $stmt->execute([$pId]);
        jsonResponse(['success' => true, 'message' => 'تم حذف المشاركة الإيجابية']);
    }

    // تبديل مقاعد التلاميذ (Swap Seats)
    if (isset($segments[1]) && isset($segments[2]) && $segments[2] === 'swap-seats' && $method === 'POST') {
        $secId = $segments[1];
        $input = getJsonInput();
        $seatA = (int)($input['seatA'] ?? 0);
        $seatB = (int)($input['seatB'] ?? 0);

        if ($seatA <= 0 || $seatB <= 0 || $seatA === $seatB) {
            jsonResponse(['success' => false, 'message' => 'أرقام المقاعد غير صالحة'], 400);
        }

        $pdo->beginTransaction();
        try {
            $stA = $pdo->prepare("SELECT * FROM seats WHERE section_id = ? AND seat_num = ?");
            $stA->execute([$secId, $seatA]);
            $rowA = $stA->fetch() ?: ['student_name' => '', 'student_number' => '', 'massar_number' => '', 'roster_id' => null, 'status_color' => 'default', 'attendance' => null];

            $stB = $pdo->prepare("SELECT * FROM seats WHERE section_id = ? AND seat_num = ?");
            $stB->execute([$secId, $seatB]);
            $rowB = $stB->fetch() ?: ['student_name' => '', 'student_number' => '', 'massar_number' => '', 'roster_id' => null, 'status_color' => 'default', 'attendance' => null];

            // 1. Swap in seats table
            $upd = $pdo->prepare("UPDATE seats SET student_name = ?, student_number = ?, massar_number = ?, roster_id = ?, status_color = ?, attendance = ?, updated_at = NOW() WHERE section_id = ? AND seat_num = ?");
            $upd->execute([$rowB['student_name'] ?? '', $rowB['student_number'] ?? '', $rowB['massar_number'] ?? '', $rowB['roster_id'] ?? null, $rowB['status_color'] ?? 'default', $rowB['attendance'] ?? null, $secId, $seatA]);
            $upd->execute([$rowA['student_name'] ?? '', $rowA['student_number'] ?? '', $rowA['massar_number'] ?? '', $rowA['roster_id'] ?? null, $rowA['status_color'] ?? 'default', $rowA['attendance'] ?? null, $secId, $seatB]);

            // 2. Move student records
            $pdo->prepare("UPDATE notes SET seat_num = -999 WHERE section_id = ? AND seat_num = ?")->execute([$secId, $seatA]);
            $pdo->prepare("UPDATE notes SET seat_num = ? WHERE section_id = ? AND seat_num = ?")->execute([$seatA, $secId, $seatB]);
            $pdo->prepare("UPDATE notes SET seat_num = ? WHERE section_id = ? AND seat_num = -999")->execute([$seatB, $secId]);

            $pdo->prepare("UPDATE attendance_history SET seat_num = -999 WHERE section_id = ? AND seat_num = ?")->execute([$secId, $seatA]);
            $pdo->prepare("UPDATE attendance_history SET seat_num = ? WHERE section_id = ? AND seat_num = ?")->execute([$seatA, $secId, $seatB]);
            $pdo->prepare("UPDATE attendance_history SET seat_num = ? WHERE section_id = ? AND seat_num = -999")->execute([$seatB, $secId]);

            $pdo->prepare("UPDATE daily_violations SET seat_num = -999 WHERE section_id = ? AND seat_num = ?")->execute([$secId, $seatA]);
            $pdo->prepare("UPDATE daily_violations SET seat_num = ? WHERE section_id = ? AND seat_num = ?")->execute([$seatA, $secId, $seatB]);
            $pdo->prepare("UPDATE daily_violations SET seat_num = ? WHERE section_id = ? AND seat_num = -999")->execute([$seatB, $secId]);

            $pdo->prepare("UPDATE positive_participations SET seat_num = -999 WHERE section_id = ? AND seat_num = ?")->execute([$secId, $seatA]);
            $pdo->prepare("UPDATE positive_participations SET seat_num = ? WHERE section_id = ? AND seat_num = ?")->execute([$seatA, $secId, $seatB]);
            $pdo->prepare("UPDATE positive_participations SET seat_num = ? WHERE section_id = ? AND seat_num = -999")->execute([$seatB, $secId]);

            $pdo->commit();
            jsonResponse(['success' => true, 'message' => 'تم تبديل المقاعد بنجاح']);
        } catch (\Exception $e) {
            $pdo->rollBack();
            jsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    // إعادة ترتيب وترقيم تلاميذ القسم تسلسلياً وتصاعدياً (Renumber & Reorder Students)
    if (isset($segments[1]) && isset($segments[2]) && ($segments[2] === 'renumber' || $segments[2] === 'reorder-students') && $method === 'POST') {
        $secId = $segments[1];
        $input = getJsonInput();
        $sourceIdx = isset($input['sourceIndex']) ? (int)$input['sourceIndex'] : null;
        $targetIdx = isset($input['targetIndex']) ? (int)$input['targetIndex'] : null;
        $targetName = trim($input['studentName'] ?? '');
        $newPos = isset($input['newPosition']) ? (int)$input['newPosition'] : null;

        // جلب المقاعد المشغولة
        $stStmt = $pdo->prepare("SELECT * FROM seats WHERE section_id = ? AND student_name IS NOT NULL AND TRIM(student_name) != '' ORDER BY CAST(student_number AS UNSIGNED) ASC, seat_num ASC");
        $stStmt->execute([$secId]);
        $occupied = $stStmt->fetchAll();

        if (empty($occupied)) {
            jsonResponse(['success' => true, 'totalStudents' => 0, 'roster' => []]);
        }

        // تطبيق الترتيب
        if ($sourceIdx !== null && $targetIdx !== null && isset($occupied[$sourceIdx])) {
            $moved = array_splice($occupied, $sourceIdx, 1);
            $targetIdx = max(0, min($targetIdx, count($occupied)));
            array_splice($occupied, $targetIdx, 0, $moved);
        } elseif ($targetName && $newPos !== null) {
            $foundIdx = -1;
            foreach ($occupied as $idx => $st) {
                if (trim($st['student_name']) === $targetName) {
                    $foundIdx = $idx;
                    break;
                }
            }
            if ($foundIdx !== -1) {
                $moved = array_splice($occupied, $foundIdx, 1);
                $tgt = max(0, min($newPos - 1, count($occupied)));
                array_splice($occupied, $tgt, 0, $moved);
            }
        }

        // تحيين الأرقام تسلسلياً 1..N
        $pdo->beginTransaction();
        try {
            $newRoster = [];
            foreach ($occupied as $i => $st) {
                $newNum = (string)($i + 1);
                $updSeat = $pdo->prepare("UPDATE seats SET student_number = ?, updated_at = NOW() WHERE section_id = ? AND seat_num = ?");
                $updSeat->execute([$newNum, $secId, $st['seat_num']]);

                // تحيين السجلات الملحقة
                $pdo->prepare("UPDATE attendance_history SET student_number = ? WHERE section_id = ? AND student_name = ?")->execute([$newNum, $secId, $st['student_name']]);
                $pdo->prepare("UPDATE daily_violations SET student_number = ? WHERE section_id = ? AND student_name = ?")->execute([$newNum, $secId, $st['student_name']]);
                $pdo->prepare("UPDATE positive_participations SET student_number = ? WHERE section_id = ? AND student_name = ?")->execute([$newNum, $secId, $st['student_name']]);

                $newRoster[] = [
                    'id' => $st['roster_id'] ?: 'r_' . $secId . '_' . ($i + 1),
                    'name' => $st['student_name'],
                    'number' => $newNum,
                    'massarNumber' => $st['massar_number'] ?: ''
                ];
            }

            $pdo->prepare("UPDATE sections SET roster_json = ?, updated_at = NOW() WHERE id = ?")->execute([json_encode($newRoster, JSON_UNESCAPED_UNICODE), $secId]);
            $pdo->commit();

            jsonResponse([
                'success' => true,
                'totalStudents' => count($newRoster),
                'roster' => $newRoster,
                'message' => 'تم تحيين أرقام تلاميذ القسم تصاعدياً (من 1 إلى ' . count($newRoster) . ') بنجاح'
            ]);
        } catch (Exception $e) {
            $pdo->rollBack();
            jsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }
}

// -------------------------------------------------------------
// 4. الأرشيف وسجل الغياب اليومي (Daily Archive & Absences)
// -------------------------------------------------------------
if ($segments[0] === 'daily-archive') {
    $sub = $segments[1] ?? '';

    // جلب أرشيف تاريخ معين
    if ($method === 'GET' && !$sub) {
        $date = $_GET['date'] ?? date('Y-m-d');
        $secId = $_GET['sectionId'] ?? '';

        $sql = "SELECT * FROM attendance_history WHERE recorded_date = ?";
        $params = [$date];
        if ($secId) {
            $sql .= " AND section_id = ?";
            $params[] = $secId;
        }
        $sql .= " ORDER BY created_at DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $absences = $stmt->fetchAll();

        // جلب المخالفات لنفس التاريخ
        $vSql = "SELECT * FROM daily_violations WHERE recorded_date = ?";
        $vParams = [$date];
        if ($secId) {
            $vSql .= " AND section_id = ?";
            $vParams[] = $secId;
        }
        $vSql .= " ORDER BY created_at DESC";
        $vStmt = $pdo->prepare($vSql);
        $vStmt->execute($vParams);
        $violations = $vStmt->fetchAll();

        // جلب الغيابات النشطة التي لم تتم تسويتها بعد
        $actSql = "SELECT * FROM attendance_history WHERE status = 'absent' AND (removed_at IS NULL OR removed_at = '')";
        $actParams = [];
        if ($secId) {
            $actSql .= " AND section_id = ?";
            $actParams[] = $secId;
        }
        $actSql .= " ORDER BY recorded_date DESC, created_at DESC";
        $actStmt = $pdo->prepare($actSql);
        $actStmt->execute($actParams);
        $activeAbsences = $actStmt->fetchAll();

        jsonResponse([
            'success' => true,
            'absences' => $absences,
            'activeAbsences' => $activeAbsences,
            'violations' => $violations,
            'stats' => [
                'totalAbsences' => count($absences),
                'totalViolations' => count($violations)
            ]
        ]);
    }

    // إضافة غياب من لوحة الإدارة
    if ($sub === 'absences' && $method === 'POST') {
        $input = getJsonInput();
        $secId = $input['sectionId'] ?? '';
        $seatNum = (int)($input['seatNum'] ?? 0);
        $name = trim($input['studentName'] ?? '');
        $num = trim($input['studentNumber'] ?? '');
        $status = $input['status'] ?? 'absent';
        $date = $input['recordedDate'] ?? date('Y-m-d');
        $session = $input['sessionPeriod'] ?? '1 ساعة';
        $justified = $input['justified'] ?? 'unjustified';
        $reason = $input['justificationReason'] ?? '';
        $notes = $input['notes'] ?? '';

        $stmt = $pdo->prepare("INSERT INTO attendance_history (section_id, seat_num, student_name, student_number, status, recorded_date, session_period, justified, justification_reason, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$secId, $seatNum, $name, $num, $status, $date, $session, $justified, $reason, $notes]);

        jsonResponse(['success' => true, 'id' => $pdo->lastInsertId(), 'message' => 'تم تسجيل الغياب اليومي بنجاح']);
    }

    // إنهاء حالة الغياب وتوثيقها في الأرشيف
    if ($sub === 'absences' && isset($segments[2]) && isset($segments[3]) && $segments[3] === 'resolve' && $method === 'POST') {
        $id = (int)$segments[2];
        $input = getJsonInput();
        $actorName = $input['actorName'] ?? ($userRole === 'director' ? 'إدارة المؤسسة' : 'الأستاذ');
        $actorSub = $input['actorSubject'] ?? '';

        $chk = $pdo->prepare("SELECT * FROM attendance_history WHERE id = ?");
        $chk->execute([$id]);
        $existing = $chk->fetch();

        if ($existing) {
            $createdTs = strtotime($existing['created_at']);
            $diffSec = time() - $createdTs;
            $hours = max(1, round($diffSec / 3600));
            if ($hours < 8) {
                $durLabel = $hours . ' ساعة';
                $durDays = 0;
            } else {
                $durDays = max(1, round($hours / 24));
                $durLabel = ($durDays == 1 ? '1 يوم' : ($durDays == 2 ? '2 يومان' : ($durDays <= 10 ? $durDays . ' أيام' : $durDays . ' يوم')));
            }

            $upd = $pdo->prepare("UPDATE attendance_history SET removed_by = ?, removed_at = NOW(), remover_name = ?, remover_subject = ?, duration_hours = ?, duration_days = ?, duration_label = ? WHERE id = ?");
            $upd->execute([$userId, $actorName, $actorSub, $hours, $durDays, $durLabel, $id]);

            // Reset active seat attendance
            if ($existing['seat_num']) {
                $pdo->prepare("UPDATE seats SET attendance = NULL WHERE section_id = ? AND seat_num = ?")->execute([$existing['section_id'], $existing['seat_num']]);
            }
        }

        jsonResponse(['success' => true, 'message' => 'تم إنهاء حالة الغياب الحالي وتوثيقها في الأرشيف بنجاح']);
    }

    // حذف غياب
    if ($sub === 'absences' && isset($segments[2]) && $method === 'DELETE') {
        $id = (int)$segments[2];
        $stmt = $pdo->prepare("DELETE FROM attendance_history WHERE id = ?");
        $stmt->execute([$id]);
        jsonResponse(['success' => true, 'message' => 'تم حذف سجل الغياب بنجاح']);
    }

    // تعديل تبرير غياب
    if ($sub === 'absences' && isset($segments[2]) && $method === 'PUT') {
        $id = (int)$segments[2];
        $input = getJsonInput();
        $justified = $input['justified'] ?? 'justified';
        $reason = $input['justificationReason'] ?? '';

        $stmt = $pdo->prepare("UPDATE attendance_history SET justified = ?, justification_reason = ? WHERE id = ?");
        $stmt->execute([$justified, $reason, $id]);
        jsonResponse(['success' => true, 'message' => 'تم تحديث التبرير بنجاح']);
    }
}

// تصفير الغيابات والمواظبة (Attendance Reset)
if (($segments[0] === 'attendance' && ($segments[1] ?? '') === 'reset') || ($segments[0] === 'director' && ($segments[1] ?? '') === 'reset-absences')) {
    if ($method !== 'POST') {
        jsonResponse(['error' => 'Method not allowed'], 405);
    }
    $input = getJsonInput();
    $mode = $input['mode'] ?? 'today';
    $sectionId = $input['sectionId'] ?? null;
    $today = date('Y-m-d');

    $clearedSeats = 0;
    $clearedHistory = 0;

    if ($mode === 'today') {
        if ($sectionId) {
            $stmt = $pdo->prepare("UPDATE seats SET attendance = NULL WHERE section_id = ? AND (attendance = 'absent' OR attendance = 'late')");
            $stmt->execute([$sectionId]);
            $clearedSeats = $stmt->rowCount();
            $hStmt = $pdo->prepare("DELETE FROM attendance_history WHERE section_id = ? AND recorded_date = ?");
            $hStmt->execute([$sectionId, $today]);
            $clearedHistory = $hStmt->rowCount();
        } else {
            $stmt = $pdo->query("UPDATE seats SET attendance = NULL WHERE attendance = 'absent' OR attendance = 'late'");
            $clearedSeats = $stmt->rowCount();
            $hStmt = $pdo->prepare("DELETE FROM attendance_history WHERE recorded_date = ?");
            $hStmt->execute([$today]);
            $clearedHistory = $hStmt->rowCount();
        }
    } elseif ($mode === 'section' && $sectionId) {
        $stmt = $pdo->prepare("UPDATE seats SET attendance = NULL WHERE section_id = ? AND (attendance = 'absent' OR attendance = 'late')");
        $stmt->execute([$sectionId]);
        $clearedSeats = $stmt->rowCount();
        $hStmt = $pdo->prepare("DELETE FROM attendance_history WHERE section_id = ?");
        $hStmt->execute([$sectionId]);
        $clearedHistory = $hStmt->rowCount();
    } elseif ($mode === 'all') {
        $stmt = $pdo->query("UPDATE seats SET attendance = NULL WHERE attendance = 'absent' OR attendance = 'late'");
        $clearedSeats = $stmt->rowCount();
        $hStmt = $pdo->query("DELETE FROM attendance_history");
        $clearedHistory = $hStmt->rowCount();
    }

    jsonResponse([
        'success' => true,
        'message' => 'تم تصفير الغيابات بنجاح',
        'clearedSeats' => $clearedSeats,
        'clearedHistory' => $clearedHistory
    ]);
}

// -------------------------------------------------------------
// 7. المواسم الدراسية (Academic Years)
// -------------------------------------------------------------
if ($segments[0] === 'academic-years') {
    // التأكد من وجود جدول المواسم الدراسية تلقائياً
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `academic_years` (
          `id` VARCHAR(64) NOT NULL PRIMARY KEY,
          `name` VARCHAR(32) NOT NULL UNIQUE,
          `start_date` DATE NOT NULL,
          `end_date` DATE NOT NULL,
          `is_current` TINYINT(1) NOT NULL DEFAULT 0,
          `is_archived` TINYINT(1) NOT NULL DEFAULT 0,
          `notes` TEXT DEFAULT NULL,
          `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          `archived_at` DATETIME DEFAULT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $chkYear = $pdo->query("SELECT COUNT(*) FROM `academic_years`")->fetchColumn();
        if ($chkYear == 0) {
            $pdo->exec("INSERT INTO `academic_years` (`id`, `name`, `start_date`, `end_date`, `is_current`, `is_archived`, `notes`)
            VALUES ('ay_2026_2027', '2026/2027', '2026-09-01', '2027-07-30', 1, 0, 'الموسم الدراسي الافتراضي')");
        }
    } catch (Exception $e) {}

    $subId = $segments[1] ?? '';
    $subAction = $segments[2] ?? '';

    // جلب كافة المواسم الدراسية
    if ($method === 'GET' && empty($subId)) {
        $stmt = $pdo->query("SELECT id, name, start_date as startDate, end_date as endDate, is_current as isCurrent, is_archived as isArchived, notes, created_at as createdAt, archived_at as archivedAt FROM academic_years ORDER BY start_date DESC");
        $rows = $stmt->fetchAll();
        $formatted = array_map(function($r) {
            $r['isCurrent'] = (bool)$r['isCurrent'];
            $r['isArchived'] = (bool)$r['isArchived'];
            return $r;
        }, $rows);
        jsonResponse(['success' => true, 'academicYears' => $formatted]);
    }

    // إضافة موسم دراسي جديد
    if ($method === 'POST' && empty($subId)) {
        $input = getJsonInput();
        $name = trim($input['name'] ?? '');
        if (!$name) {
            jsonResponse(['success' => false, 'error' => 'اسم الموسم الدراسي مطلوب (مثال: 2026/2027)']);
        }

        $startDate = trim($input['startDate'] ?? '');
        $endDate = trim($input['endDate'] ?? '');
        if (!$startDate || !$endDate) {
            $parts = preg_split('/[\/\-_]/', $name);
            $startYear = isset($parts[0]) ? (int)$parts[0] : 2026;
            if ($startYear >= 2000 && $startYear <= 2100) {
                if (!$startDate) $startDate = "{$startYear}-09-01";
                if (!$endDate) $endDate = ($startYear + 1) . "-07-30";
            } else {
                if (!$startDate) $startDate = '2026-09-01';
                if (!$endDate) $endDate = '2027-07-30';
            }
        }

        $isCurrent = !empty($input['isCurrent']) ? 1 : 0;
        $notes = trim($input['notes'] ?? '');
        $id = 'ay_' . bin2hex(random_bytes(6));

        try {
            if ($isCurrent === 1) {
                $pdo->exec("UPDATE academic_years SET is_current = 0");
                $pdo->prepare("INSERT INTO app_settings (key_name, value) VALUES ('year', ?) ON DUPLICATE KEY UPDATE value = ?")->execute([$name, $name]);
                $pdo->prepare("UPDATE users SET academic_year = ?")->execute([$name]);
            }

            $stmt = $pdo->prepare("INSERT INTO academic_years (id, name, start_date, end_date, is_current, is_archived, notes, created_at) VALUES (?, ?, ?, ?, ?, 0, ?, NOW())");
            $stmt->execute([$id, $name, $startDate, $endDate, $isCurrent, $notes]);

            $all = $pdo->query("SELECT id, name, start_date as startDate, end_date as endDate, is_current as isCurrent, is_archived as isArchived, notes, created_at as createdAt, archived_at as archivedAt FROM academic_years ORDER BY start_date DESC")->fetchAll();
            $formatted = array_map(function($r) {
                $r['isCurrent'] = (bool)$r['isCurrent'];
                $r['isArchived'] = (bool)$r['isArchived'];
                return $r;
            }, $all);

            jsonResponse(['success' => true, 'academicYears' => $formatted, 'message' => 'تمت إضافة الموسم الدراسي بنجاح']);
        } catch (PDOException $e) {
            jsonResponse(['success' => false, 'error' => 'الموسم الدراسي (' . $name . ') مسجل بالفعل']);
        }
    }

    // تفعيل كموسم حالي
    if ($subAction === 'set-current' && $method === 'PUT') {
        $stmt = $pdo->prepare("SELECT * FROM academic_years WHERE id = ?");
        $stmt->execute([$subId]);
        $row = $stmt->fetch();
        if (!$row) jsonResponse(['success' => false, 'error' => 'الموسم الدراسي غير موجود']);

        $pdo->exec("UPDATE academic_years SET is_current = 0");
        $pdo->prepare("UPDATE academic_years SET is_current = 1 WHERE id = ?")->execute([$subId]);
        $pdo->prepare("INSERT INTO app_settings (key_name, value) VALUES ('year', ?) ON DUPLICATE KEY UPDATE value = ?")->execute([$row['name'], $row['name']]);
        $pdo->prepare("UPDATE users SET academic_year = ?")->execute([$row['name']]);

        $all = $pdo->query("SELECT id, name, start_date as startDate, end_date as endDate, is_current as isCurrent, is_archived as isArchived, notes, created_at as createdAt, archived_at as archivedAt FROM academic_years ORDER BY start_date DESC")->fetchAll();
        $formatted = array_map(function($r) {
            $r['isCurrent'] = (bool)$r['isCurrent'];
            $r['isArchived'] = (bool)$r['isArchived'];
            return $r;
        }, $all);

        jsonResponse(['success' => true, 'academicYears' => $formatted, 'message' => 'تم تعيين الموسم الدراسي كنشط حالياً']);
    }

    // أرشفة الموسم
    if ($subAction === 'archive' && $method === 'PUT') {
        $pdo->prepare("UPDATE academic_years SET is_archived = 1, archived_at = NOW() WHERE id = ?")->execute([$subId]);
        $all = $pdo->query("SELECT id, name, start_date as startDate, end_date as endDate, is_current as isCurrent, is_archived as isArchived, notes, created_at as createdAt, archived_at as archivedAt FROM academic_years ORDER BY start_date DESC")->fetchAll();
        $formatted = array_map(function($r) {
            $r['isCurrent'] = (bool)$r['isCurrent'];
            $r['isArchived'] = (bool)$r['isArchived'];
            return $r;
        }, $all);
        jsonResponse(['success' => true, 'academicYears' => $formatted, 'message' => 'تمت أرشفة الموسم الدراسي بنجاح']);
    }

    // إلغاء الأرشفة
    if ($subAction === 'unarchive' && $method === 'PUT') {
        $pdo->prepare("UPDATE academic_years SET is_archived = 0, archived_at = NULL WHERE id = ?")->execute([$subId]);
        $all = $pdo->query("SELECT id, name, start_date as startDate, end_date as endDate, is_current as isCurrent, is_archived as isArchived, notes, created_at as createdAt, archived_at as archivedAt FROM academic_years ORDER BY start_date DESC")->fetchAll();
        $formatted = array_map(function($r) {
            $r['isCurrent'] = (bool)$r['isCurrent'];
            $r['isArchived'] = (bool)$r['isArchived'];
            return $r;
        }, $all);
        jsonResponse(['success' => true, 'academicYears' => $formatted, 'message' => 'تم إلغاء أرشفة الموسم الدراسي']);
    }

    // حذف الموسم
    if ($method === 'DELETE' && !empty($subId)) {
        $stmt = $pdo->prepare("SELECT is_current FROM academic_years WHERE id = ?");
        $stmt->execute([$subId]);
        $row = $stmt->fetch();
        if ($row && $row['is_current']) {
            jsonResponse(['success' => false, 'error' => 'لا يمكن حذف الموسم الدراسي الجاري حالياً. يرجى تفعيل موسم آخر أولاً.']);
        }
        $pdo->prepare("DELETE FROM academic_years WHERE id = ?")->execute([$subId]);
        $all = $pdo->query("SELECT id, name, start_date as startDate, end_date as endDate, is_current as isCurrent, is_archived as isArchived, notes, created_at as createdAt, archived_at as archivedAt FROM academic_years ORDER BY start_date DESC")->fetchAll();
        $formatted = array_map(function($r) {
            $r['isCurrent'] = (bool)$r['isCurrent'];
            $r['isArchived'] = (bool)$r['isArchived'];
            return $r;
        }, $all);
        jsonResponse(['success' => true, 'academicYears' => $formatted, 'message' => 'تم حذف الموسم الدراسي بنجاح']);
    }
}

// -------------------------------------------------------------
// 8. إحصائيات المدير (Director Analytics)
// -------------------------------------------------------------
if ($segments[0] === 'director' && ($segments[1] ?? '') === 'analytics') {
    $totSec = (int)$pdo->query("SELECT COUNT(*) FROM sections")->fetchColumn();
    $totTeach = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'teacher'")->fetchColumn();
    $totStud = (int)$pdo->query("SELECT COUNT(*) FROM seats WHERE student_name != '' AND student_name IS NOT NULL")->fetchColumn();
    $totVio = (int)$pdo->query("SELECT COUNT(*) FROM daily_violations")->fetchColumn();
    $totAbs = (int)$pdo->query("SELECT COUNT(*) FROM attendance_history WHERE status = 'absent'")->fetchColumn();

    $topVio = $pdo->query("
        SELECT dv.student_name, dv.student_number, dv.massar_number, sec.level as section_level, sec.class_number as section_class,
               COUNT(dv.id) as violations_count
        FROM daily_violations dv
        JOIN sections sec ON dv.section_id = sec.id
        GROUP BY dv.student_name, dv.student_number, dv.massar_number, sec.level, sec.class_number
        ORDER BY violations_count DESC
        LIMIT 10
    ")->fetchAll();

    $topAbs = $pdo->query("
        SELECT ah.student_name, ah.student_number, sec.level as section_level, sec.class_number as section_class,
               COUNT(ah.id) as absences_count
        FROM attendance_history ah
        JOIN sections sec ON ah.section_id = sec.id
        WHERE ah.status = 'absent'
        GROUP BY ah.student_name, ah.student_number, sec.level, sec.class_number
        ORDER BY absences_count DESC
        LIMIT 10
    ")->fetchAll();

    jsonResponse([
        'success' => true,
        'topViolations' => $topVio,
        'topAbsences' => $topAbs,
        'allStudents' => [],
        'allViolations' => [],
        'allAbsences' => [],
        'summary' => [
            'totalStudents' => $totStud,
            'totalTeachers' => $totTeach,
            'totalSections' => $totSec,
            'totalViolations' => $totVio,
            'totalAbsences' => $totAbs
        ]
    ]);
}

// -------------------------------------------------------------
// 9. طلبات إسناد الأقسام (Section Assignment Requests)
// -------------------------------------------------------------
if ($segments[0] === 'assignment-requests') {
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `section_assignments` (
          `id` VARCHAR(64) NOT NULL PRIMARY KEY,
          `teacher_id` VARCHAR(64) NOT NULL,
          `section_id` VARCHAR(64) NOT NULL,
          `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
          `request_note` TEXT DEFAULT NULL,
          `requested_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          `reviewed_at` DATETIME DEFAULT NULL,
          `reviewed_by` VARCHAR(64) DEFAULT NULL,
          `academic_year` VARCHAR(32) DEFAULT NULL,
          `subject` VARCHAR(64) DEFAULT 'الرياضيات'
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    } catch (Exception $e) {}

    if ($method === 'GET') {
        $stmt = $pdo->query("SELECT sa.*, u.full_name as teacher_name, u.email as teacher_email, sec.level, sec.class_number FROM section_assignments sa JOIN users u ON sa.teacher_id = u.id JOIN sections sec ON sa.section_id = sec.id ORDER BY sa.requested_at DESC");
        jsonResponse(['success' => true, 'requests' => $stmt->fetchAll()]);
    }

    if ($method === 'POST') {
        $input = getJsonInput();
        $tId = $input['teacherId'] ?? $userId;
        $sId = $input['sectionId'] ?? '';
        $note = $input['requestNote'] ?? '';

        $reqId = 'req_' . bin2hex(random_bytes(6));
        $stmt = $pdo->prepare("INSERT INTO section_assignments (id, teacher_id, section_id, status, request_note, requested_at) VALUES (?, ?, ?, 'pending', ?, NOW())");
        $stmt->execute([$reqId, $tId, $sId, $note]);
        jsonResponse(['success' => true, 'message' => 'تم تقديم طلب إسناد القسم بنجاح']);
    }

    if ($method === 'PUT' && isset($segments[2]) && $segments[2] === 'review') {
        $reqId = $segments[1];
        $input = getJsonInput();
        $decision = $input['decision'] ?? 'approved';

        $pdo->prepare("UPDATE section_assignments SET status = ?, reviewed_at = NOW(), reviewed_by = ? WHERE id = ?")->execute([$decision, $userId, $reqId]);

        if ($decision === 'approved') {
            $req = $pdo->query("SELECT * FROM section_assignments WHERE id = " . $pdo->quote($reqId))->fetch();
            if ($req) {
                $u = $pdo->query("SELECT full_name FROM users WHERE id = " . $pdo->quote($req['teacher_id']))->fetch();
                $teacherName = $u ? $u['full_name'] : '';
                $pdo->prepare("UPDATE sections SET assigned_teacher_id = ?, teacher = ? WHERE id = ?")->execute([$req['teacher_id'], $teacherName, $req['section_id']]);
            }
        }
        jsonResponse(['success' => true, 'message' => 'تم تحديث حالة الطلب بنجاح']);
    }
}

// -------------------------------------------------------------
// 10. استعمال الزمان للأستاذ (Teacher Timetable)
// -------------------------------------------------------------
if ($segments[0] === 'teacher' && ($segments[1] ?? '') === 'timetable') {
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `teacher_timetable` (
          `id` VARCHAR(64) NOT NULL PRIMARY KEY,
          `teacher_id` VARCHAR(64) NOT NULL,
          `day_of_week` VARCHAR(32) NOT NULL,
          `slot_id` VARCHAR(32) NOT NULL,
          `period_type` VARCHAR(32) NOT NULL,
          `start_time` VARCHAR(16) NOT NULL,
          `end_time` VARCHAR(16) NOT NULL,
          `section_id` VARCHAR(64) NOT NULL,
          `room` VARCHAR(64) DEFAULT '',
          `subject` VARCHAR(64) DEFAULT '',
          `notes` TEXT DEFAULT NULL,
          `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX `idx_tt_teacher` (`teacher_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    } catch (Exception $e) {}

    // حذف حصة محددة
    if (($segments[2] ?? '') === 'slot' && isset($segments[3]) && isset($segments[4]) && $method === 'DELETE') {
        $day = $segments[3];
        $slot = $segments[4];
        $tId = $_GET['teacherId'] ?? $userId;
        $pdo->prepare("DELETE FROM teacher_timetable WHERE teacher_id = ? AND day_of_week = ? AND slot_id = ?")->execute([$tId, $day, $slot]);
        jsonResponse(['success' => true]);
    }

    // جلب جدول الحصص
    if ($method === 'GET') {
        $tId = $_GET['teacherId'] ?? $userId;
        $stmt = $pdo->prepare("
            SELECT tt.*, sec.level, sec.class_number 
            FROM teacher_timetable tt 
            LEFT JOIN sections sec ON tt.section_id = sec.id 
            WHERE tt.teacher_id = ?
            ORDER BY tt.slot_id ASC
        ");
        $stmt->execute([$tId]);
        $rows = $stmt->fetchAll();
        $entries = array_map(function($r) {
            $secName = ($r['level'] && $r['class_number']) ? ($r['level'] . '/' . $r['class_number']) : '';
            return [
                'id' => $r['id'],
                'teacherId' => $r['teacher_id'],
                'dayOfWeek' => $r['day_of_week'],
                'slotId' => $r['slot_id'],
                'period' => $r['period_type'],
                'periodType' => $r['period_type'],
                'startTime' => $r['start_time'],
                'endTime' => $r['end_time'],
                'sectionId' => $r['section_id'],
                'sectionName' => $secName,
                'room' => $r['room'] ?? '',
                'subject' => $r['subject'] ?? '',
                'notes' => $r['notes'] ?? ''
            ];
        }, $rows);
        jsonResponse(['success' => true, 'entries' => $entries]);
    }

    // إضافة أو تحديث حصة
    if ($method === 'POST') {
        $input = getJsonInput();
        $id = 'tt_' . bin2hex(random_bytes(6));
        $tId = $input['teacherId'] ?? $userId;
        $day = $input['dayOfWeek'] ?? '';
        $slot = $input['slotId'] ?? '';
        $period = $input['periodType'] ?? 'morning';
        $start = $input['startTime'] ?? '';
        $end = $input['endTime'] ?? '';
        $sec = $input['sectionId'] ?? '';
        $room = $input['room'] ?? '';
        $subj = $input['subject'] ?? '';
        $notes = $input['notes'] ?? '';

        $pdo->prepare("DELETE FROM teacher_timetable WHERE teacher_id = ? AND day_of_week = ? AND slot_id = ?")->execute([$tId, $day, $slot]);
        $stmt = $pdo->prepare("INSERT INTO teacher_timetable (id, teacher_id, day_of_week, slot_id, period_type, start_time, end_time, section_id, room, subject, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$id, $tId, $day, $slot, $period, $start, $end, $sec, $room, $subj, $notes]);

        $secName = '';
        if ($sec && $sec !== 'empty') {
            $secStmt = $pdo->prepare("SELECT level, class_number FROM sections WHERE id = ?");
            $secStmt->execute([$sec]);
            $secRow = $secStmt->fetch();
            if ($secRow && !empty($secRow['level'])) {
                $secName = $secRow['level'] . '/' . $secRow['class_number'];
            }
        }

        jsonResponse([
            'success' => true,
            'entry' => [
                'id' => $id,
                'teacherId' => $tId,
                'dayOfWeek' => $day,
                'slotId' => $slot,
                'period' => $period,
                'periodType' => $period,
                'startTime' => $start,
                'endTime' => $end,
                'sectionId' => $sec,
                'sectionName' => $secName,
                'room' => $room,
                'subject' => $subj,
                'notes' => $notes
            ]
        ]);
    }
}

// -------------------------------------------------------------
// 11. بوابة واتساب الرسمية (WhatsApp Cloud API - Meta) وإدارة الإشعارات
// -------------------------------------------------------------
if ($segments[0] === 'admin') {
    $sub = $segments[1] ?? '';

    // إعدادات بوابة واتساب (sms-gateway/config)
    if ($sub === 'sms-gateway' && ($segments[2] ?? '') === 'config') {
        if ($method === 'GET') {
            $stmt = $pdo->query("SELECT key_name, value FROM app_settings WHERE key_name LIKE 'whatsapp_%' OR key_name LIKE 'sms_%' OR key_name = 'verification_channel'");
            $map = [];
            while ($r = $stmt->fetch()) {
                $map[$r['key_name']] = $r['value'];
            }
            jsonResponse([
                'success' => true,
                'config' => [
                    'provider' => 'whatsapp_cloud',
                    'whatsappCloudEnabled' => ($map['whatsapp_cloud_enabled'] ?? '1') !== '0',
                    'whatsappPhoneNumberId' => $map['whatsapp_phone_number_id'] ?? '',
                    'whatsappAccessToken' => $map['whatsapp_access_token'] ?? '',
                    'whatsappBusinessAccountId' => $map['whatsapp_waba_id'] ?? '',
                    'whatsappTemplateName' => $map['whatsapp_template_name'] ?? '',
                    'schoolPhone' => $map['school_phone'] ?? '',
                    'defaultChannel' => 'whatsapp_cloud'
                ]
            ]);
        }

        if ($method === 'POST') {
            $input = getJsonInput();
            $now = date('Y-m-d H:i:s');
            $upsert = $pdo->prepare("INSERT INTO app_settings (key_name, value, updated_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)");
            
            $upsert->execute(['sms_provider', 'whatsapp_cloud', $now]);
            $upsert->execute(['verification_channel', 'whatsapp_cloud', $now]);
            if (isset($input['whatsappCloudEnabled'])) $upsert->execute(['whatsapp_cloud_enabled', $input['whatsappCloudEnabled'] ? '1' : '0', $now]);
            if (isset($input['whatsappPhoneNumberId'])) $upsert->execute(['whatsapp_phone_number_id', trim($input['whatsappPhoneNumberId']), $now]);
            if (isset($input['whatsappAccessToken'])) $upsert->execute(['whatsapp_access_token', trim($input['whatsappAccessToken']), $now]);
            if (isset($input['whatsappBusinessAccountId'])) $upsert->execute(['whatsapp_waba_id', trim($input['whatsappBusinessAccountId']), $now]);
            if (isset($input['whatsappTemplateName'])) $upsert->execute(['whatsapp_template_name', trim($input['whatsappTemplateName']), $now]);
            if (isset($input['schoolPhone'])) $upsert->execute(['school_phone', trim($input['schoolPhone']), $now]);

            jsonResponse([
                'success' => true,
                'message' => 'تم حفظ إعدادات بوابة واتساب (WhatsApp Cloud API) بنجاح ✓'
            ]);
        }
    }

    // اختبار الاتصال بـ WhatsApp Cloud API
    if (($sub === 'sms-gateway' && ($segments[2] ?? '') === 'test') || ($sub === 'whatsapp-cloud' && ($segments[2] ?? '') === 'test')) {
        $input = getJsonInput();
        $testPhone = trim($input['testPhone'] ?? '');
        if (!$testPhone) {
            jsonResponse(['success' => false, 'error' => 'يرجى إدخال رقم هاتف لإرسال رسالة الاختبار إليه'], 400);
        }

        $phoneId = trim($input['phoneNumberId'] ?? '');
        $token = trim($input['accessToken'] ?? $input['token'] ?? '');
        $tpl = trim($input['templateName'] ?? '');

        if (!$phoneId || !$token) {
            $stmt = $pdo->query("SELECT key_name, value FROM app_settings WHERE key_name IN ('whatsapp_phone_number_id', 'whatsapp_access_token', 'whatsapp_template_name')");
            while ($r = $stmt->fetch()) {
                if ($r['key_name'] === 'whatsapp_phone_number_id' && !$phoneId) $phoneId = $r['value'];
                if ($r['key_name'] === 'whatsapp_access_token' && !$token) $token = $r['value'];
                if ($r['key_name'] === 'whatsapp_template_name' && !$tpl) $tpl = $r['value'];
            }
        }

        if (!$phoneId || !$token) {
            jsonResponse(['success' => false, 'error' => 'يرجى إدخال Phone Number ID و Access Token الخاصين بحساب Meta Developers'], 400);
        }

        $cleanTo = preg_replace('/[\s\-\.\(\)]/', '', $testPhone);
        if (strpos($cleanTo, '0') === 0) $cleanTo = '212' . substr($cleanTo, 1);
        if (strpos($cleanTo, '+212') === 0) $cleanTo = substr($cleanTo, 1);

        $testMsg = "المملكة المغربية 🇲🇦\nمنظومة الإدارة التربوية والمواظبة الرقمية (PHP & MySQL)\nهذه رسالة اختبار للتأكد من نجاح ربط خدمة WhatsApp Cloud API بالمؤسسة ✓\nالتاريخ: " . date('Y-m-d H:i');

        $url = "https://graph.facebook.com/v21.0/" . $phoneId . "/messages";
        $payload = [
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $cleanTo,
            'type' => 'text',
            'text' => ['preview_url' => false, 'body' => $testMsg]
        ];

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        $res = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $cErr = curl_error($ch);
        curl_close($ch);

        if ($cErr) {
            jsonResponse(['success' => false, 'message' => 'تعذر الاتصال بخوادم واتساب: ' . $cErr]);
        }

        $data = json_decode($res, true);
        if ($httpCode >= 200 && $httpCode < 300 && !empty($data['messages'])) {
            jsonResponse([
                'success' => true,
                'message' => 'تم إرسال رسالة الاختبار بنجاح عبر WhatsApp Cloud API إلى (' . $cleanTo . ') ✓',
                'messageId' => $data['messages'][0]['id'] ?? ''
            ]);
        }

        $fbErr = $data['error']['message'] ?? ('استجابت منصة Meta بكود ' . $httpCode);
        jsonResponse([
            'success' => false,
            'message' => 'ردت منصة Meta: ' . $fbErr,
            'error' => $data['error'] ?? null
        ]);
    }

    // سجلات إرسال واتساب
    if ($sub === 'sms-gateway' && ($segments[2] ?? '') === 'logs') {
        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS `whatsapp_dispatch_logs` (
              `id` VARCHAR(64) NOT NULL PRIMARY KEY,
              `to_phone` VARCHAR(32) NOT NULL,
              `intl_phone` VARCHAR(32) NOT NULL,
              `sender_name` VARCHAR(128) NOT NULL,
              `message_text` TEXT NOT NULL,
              `code` VARCHAR(64) DEFAULT '',
              `status` VARCHAR(32) NOT NULL DEFAULT 'delivered',
              `gateway` VARCHAR(64) NOT NULL DEFAULT 'WhatsApp Cloud API',
              `sent_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        } catch (Exception $e) {}

        $stmt = $pdo->query("SELECT id, to_phone as toPhone, intl_phone as intlPhone, sender_name as senderName, message_text as messageText, code, status, gateway, sent_at as sentAt FROM whatsapp_dispatch_logs ORDER BY sent_at DESC LIMIT 100");
        jsonResponse(['success' => true, 'logs' => $stmt->fetchAll()]);
    }

    // البحث عن معلومات ولي الأمر
    if ($sub === 'student-guardian-info') {
        $massar = trim($_GET['massarNumber'] ?? '');
        $stName = trim($_GET['studentName'] ?? '');
        $info = null;

        if ($massar) {
            try {
                $stmt = $pdo->prepare("SELECT student_name, guardian_phone, photo_url FROM student_accounts WHERE massar_number = ? LIMIT 1");
                $stmt->execute([$massar]);
                $r = $stmt->fetch();
                if ($r) {
                    $info = [
                        'studentName' => $r['student_name'],
                        'guardianPhone' => $r['guardian_phone'],
                        'photoUrl' => $r['photo_url']
                    ];
                }
            } catch (Exception $e) {}
        }
        if (!$info && ($massar || $stName)) {
            $stmt = $pdo->prepare("SELECT student_name, guardian_phone, photo_url FROM seats WHERE (massar_number = ? OR student_name = ?) AND guardian_phone != '' LIMIT 1");
            $stmt->execute([$massar, $stName]);
            $r = $stmt->fetch();
            if ($r) {
                $info = [
                    'studentName' => $r['student_name'],
                    'guardianPhone' => $r['guardian_phone'],
                    'photoUrl' => $r['photo_url'] ?? ''
                ];
            }
        }

        jsonResponse(['success' => true, 'info' => $info]);
    }

    // إرسال إشعار لولي أمر (WhatsApp Cloud API أو رابط مباشر)
    if ($sub === 'notify-guardian' && $method === 'POST') {
        $input = getJsonInput();
        $phone = trim($input['guardianPhone'] ?? $input['toPhone'] ?? '');
        $studentName = trim($input['studentName'] ?? '');
        $massarNumber = trim($input['massarNumber'] ?? '');
        $notificationType = $input['notificationType'] ?? 'absence';
        $customMessage = trim($input['customMessage'] ?? $input['messageText'] ?? '');

        if (!$phone && $massarNumber) {
            try {
                $st = $pdo->prepare("SELECT guardian_phone FROM student_accounts WHERE massar_number = ? LIMIT 1");
                $st->execute([$massarNumber]);
                $row = $st->fetch();
                if ($row) $phone = $row['guardian_phone'];
            } catch (Exception $e) {}
        }
        if (!$phone) {
            jsonResponse(['success' => false, 'error' => 'رقم هاتف ولي الأمر غير متوفر لهذا التلميذ.'], 400);
        }

        if (!empty($input['guardianPhone']) && $massarNumber) {
            try {
                $pdo->prepare("UPDATE student_accounts SET guardian_phone = ?, guardian_phone_verified = 1 WHERE massar_number = ?")->execute([$phone, $massarNumber]);
                $pdo->prepare("UPDATE seats SET guardian_phone = ? WHERE massar_number = ?")->execute([$phone, $massarNumber]);
            } catch (Exception $e) {}
        }

        $intlPhone = preg_replace('/[\s\-\.\(\)]/', '', $phone);
        if (strpos($intlPhone, '0') === 0) $intlPhone = '212' . substr($intlPhone, 1);
        if (strpos($intlPhone, '+212') === 0) $intlPhone = substr($intlPhone, 1);

        $instStmt = $pdo->query("SELECT value FROM app_settings WHERE key_name = 'institution' LIMIT 1");
        $instRow = $instStmt->fetch();
        $institutionName = $instRow ? $instRow['value'] : 'المدرسة الإلكترونية';

        $messageText = $customMessage;
        if (!$messageText) {
            $d = $input['details']['date'] ?? date('Y-m-d');
            $sName = $studentName ? "ابنكم/ابنتكم ({$studentName})" : 'ابنكم/ابنتكم';
            if ($notificationType === 'absence') {
                $messageText = "المملكة المغربية • {$institutionName}\nنحيطكم علماً بأن {$sName} قد سجل(ت) غياباً عن الدراسة بتاريخ {$d}.\nيرجى موافاة الإدارة بمبرر الغياب القانوني.";
            } else {
                $vReason = $input['details']['reason'] ?? 'مخالفة انضباطية داخل الحصة';
                $messageText = "المملكة المغربية • {$institutionName}\nنحيطكم علماً بأن {$sName} قد ارتكب(ت) مخالفة انضباطية: ({$vReason}) بتاريخ {$d}.\nيرجى التواصل مع إدارة المؤسسة.";
            }
        }

        $whatsappUrl = "https://api.whatsapp.com/send?phone=" . $intlPhone . "&text=" . urlencode($messageText);

        $phoneId = '';
        $token = '';
        $tpl = '';
        $stCfg = $pdo->query("SELECT key_name, value FROM app_settings WHERE key_name IN ('whatsapp_phone_number_id', 'whatsapp_access_token', 'whatsapp_template_name')");
        while ($r = $stCfg->fetch()) {
            if ($r['key_name'] === 'whatsapp_phone_number_id') $phoneId = $r['value'];
            if ($r['key_name'] === 'whatsapp_access_token') $token = $r['value'];
            if ($r['key_name'] === 'whatsapp_template_name') $tpl = $r['value'];
        }

        $cloudSuccess = false;
        $statusMsg = '';
        $gatewayUsed = 'WhatsApp Web / App Direct';

        if ($phoneId && $token) {
            $url = "https://graph.facebook.com/v21.0/" . $phoneId . "/messages";
            $payload = [
                'messaging_product' => 'whatsapp',
                'recipient_type' => 'individual',
                'to' => $intlPhone,
                'type' => 'text',
                'text' => ['preview_url' => false, 'body' => $messageText]
            ];

            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_POST, 1);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Authorization: Bearer ' . $token,
                'Content-Type: application/json'
            ]);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 10);
            $res = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            $data = json_decode($res, true);
            if ($httpCode >= 200 && $httpCode < 300 && !empty($data['messages'])) {
                $cloudSuccess = true;
                $gatewayUsed = 'WhatsApp Cloud API (Meta)';
                $statusMsg = 'تم الإرسال سحابياً بنجاح';
            } else {
                $statusMsg = $data['error']['message'] ?? 'فشل الإرسال عبر السحابة';
            }
        }

        try {
            $logId = 'notif_' . bin2hex(random_bytes(6));
            $pdo->prepare("INSERT INTO whatsapp_dispatch_logs (id, to_phone, intl_phone, sender_name, message_text, code, status, gateway, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())")
                ->execute([$logId, $phone, '+' . $intlPhone, $institutionName, $messageText, $notificationType, $cloudSuccess ? 'delivered' : 'pending', $gatewayUsed]);
        } catch (Exception $e) {}

        jsonResponse([
            'success' => true,
            'smsSuccess' => false,
            'whatsappCloudSuccess' => $cloudSuccess,
            'message' => $cloudSuccess 
                ? "تم إرسال إشعار {$notificationType} تلقائياً لولي أمر ({$studentName}) عبر WhatsApp Cloud API ✓"
                : "تم تجهيز الإشعار لولي أمر ({$studentName}) بنجاح. يمكنك إرساله بنقرة واحدة عبر واتساب.",
            'gatewayUsed' => $gatewayUsed,
            'whatsappUrl' => $whatsappUrl,
            'toPhone' => $phone,
            'intlPhone' => '+' . $intlPhone
        ]);
    }
}

// -------------------------------------------------------------
// 12. بوابة التلاميذ وأولياء الأمور (Student Portal & Profile)
// -------------------------------------------------------------
if ($segments[0] === 'student') {
    $action = $segments[1] ?? '';

    // طلب رمز التحقق لرقم هاتف ولي الأمر
    if ($action === 'profile' && ($segments[2] ?? '') === 'request-code' && $method === 'POST') {
        $input = getJsonInput();
        $massar = trim($input['massarNumber'] ?? '');
        $phone = trim($input['guardianPhone'] ?? '');

        if (!$massar || !$phone) {
            jsonResponse(['success' => false, 'error' => 'رقم مسار ورقم الهاتف مطلوبان'], 400);
        }

        $code = (string)random_int(100000, 999999);
        $cleanPhone = preg_replace('/[\s\-\.\(\)]/', '', $phone);
        $intlPhone = $cleanPhone;
        if (strpos($intlPhone, '0') === 0) $intlPhone = '212' . substr($intlPhone, 1);

        try {
            $pdo->prepare("UPDATE student_accounts SET guardian_phone = ?, verification_code = ?, updated_at = NOW() WHERE massar_number = ?")
                ->execute([$cleanPhone, $code, $massar]);
        } catch (Exception $e) {}

        $msgText = "المملكة المغربية • المدرسة الإلكترونية\nرمز التحقق (OTP) الخاص بتفعيل رقم هاتف ولي الأمر لرقم مسار ({$massar}) هو: {$code}\nصالح لمدة 10 دقائق.";
        $whatsappUrl = "https://api.whatsapp.com/send?phone=" . $intlPhone . "&text=" . urlencode($msgText);

        jsonResponse([
            'success' => true,
            'message' => "تم تجهيز كود التحقق ({$code}) لولي الأمر (+{$intlPhone}). يمكنك إرساله بنقرة واحدة عبر واتساب.",
            'code' => $code,
            'phone' => $cleanPhone,
            'intlPhone' => '+' . $intlPhone,
            'whatsappUrl' => $whatsappUrl
        ]);
    }

    // تفعيل رقم هاتف ولي الأمر عبر الرمز
    if ($action === 'profile' && ($segments[2] ?? '') === 'verify-code' && $method === 'POST') {
        $input = getJsonInput();
        $massar = trim($input['massarNumber'] ?? '');
        $code = trim($input['code'] ?? '');

        $stmt = $pdo->prepare("SELECT verification_code FROM student_accounts WHERE massar_number = ? LIMIT 1");
        $stmt->execute([$massar]);
        $acc = $stmt->fetch();

        if ($acc && $acc['verification_code'] === $code) {
            $pdo->prepare("UPDATE student_accounts SET guardian_phone_verified = 1, updated_at = NOW() WHERE massar_number = ?")->execute([$massar]);
            jsonResponse(['success' => true, 'message' => 'تم تأكيد وتفعيل رقم هاتف ولي الأمر بنجاح عبر خدمة واتساب (WhatsApp) ✓']);
        }
        jsonResponse(['success' => false, 'error' => 'رمز التحقق غير صحيح. يرجى التأكد من الكود المرسل عبر واتساب.'], 400);
    }

    // إكمال أو تحديث الملف
    if ($action === 'profile' && ($segments[2] ?? '') === 'complete' && $method === 'POST') {
        $input = getJsonInput();
        $massar = trim($input['massarNumber'] ?? '');
        $photo = trim($input['photoUrl'] ?? '');
        $phone = trim($input['guardianPhone'] ?? '');
        $verified = !empty($input['guardianPhoneVerified']) ? 1 : 0;

        $pdo->prepare("UPDATE student_accounts SET photo_url = ?, guardian_phone = ?, guardian_phone_verified = ?, updated_at = NOW() WHERE massar_number = ?")
            ->execute([$photo, $phone, $verified, $massar]);

        jsonResponse(['success' => true, 'message' => 'تم حفظ الصورة وتأكيد رقم ولي الأمر وإكمال الملف بنجاح ✓']);
    }
}

// -------------------------------------------------------------
// أنشطة الحياة المدرسية (School Activities Wall)
// -------------------------------------------------------------
if (isset($segments[0]) && $segments[0] === 'activities') {
    $actId = $segments[1] ?? '';
    $subAction = $segments[2] ?? '';

    // إنشاء جدول الأنشطة تلقائياً إن لم يكن موجوداً
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `school_activities` (
                `id` VARCHAR(64) NOT NULL PRIMARY KEY,
                `title` VARCHAR(255) NOT NULL,
                `description` TEXT NOT NULL,
                `category` VARCHAR(64) NOT NULL DEFAULT 'أنشطة عامة',
                `image_url` LONGTEXT DEFAULT NULL,
                `author_id` VARCHAR(64) DEFAULT '',
                `author_name` VARCHAR(128) DEFAULT '',
                `author_role` VARCHAR(32) DEFAULT 'teacher',
                `author_subject` VARCHAR(64) DEFAULT '',
                `status` ENUM('approved', 'pending', 'rejected') NOT NULL DEFAULT 'approved',
                `likes_count` INT NOT NULL DEFAULT 0,
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX `idx_act_status` (`status`),
                INDEX `idx_act_cat` (`category`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
    } catch (Exception $e) {}

    // جلب الأنشطة
    if ($method === 'GET' && empty($actId)) {
        try {
            $stmt = $pdo->query("SELECT * FROM school_activities ORDER BY created_at DESC");
            $rows = $stmt->fetchAll();
            $activities = array_map(function($r) {
                return [
                    'id' => $r['id'],
                    'title' => $r['title'],
                    'description' => $r['description'],
                    'category' => $r['category'],
                    'imageUrl' => $r['image_url'],
                    'authorId' => $r['author_id'],
                    'authorName' => $r['author_name'],
                    'authorRole' => $r['author_role'],
                    'authorSubject' => $r['author_subject'],
                    'status' => $r['status'],
                    'likesCount' => (int)($r['likes_count'] ?? 0),
                    'createdAt' => $r['created_at'],
                    'updatedAt' => $r['updated_at']
                ];
            }, $rows);
            jsonResponse(['success' => true, 'activities' => $activities]);
        } catch (Exception $e) {
            jsonResponse(['success' => true, 'activities' => []]);
        }
    }

    // نشر نشاط جديد
    if ($method === 'POST' && empty($actId)) {
        $input = getJsonInput();
        $newId = 'act_' . time() . '_' . substr(md5(uniqid()), 0, 6);
        $title = trim($input['title'] ?? '');
        $desc = trim($input['description'] ?? '');
        $cat = trim($input['category'] ?? 'أنشطة عامة');
        $img = trim($input['imageUrl'] ?? '');
        $aId = trim($input['authorId'] ?? $userId);
        $aName = trim($input['authorName'] ?? 'أستاذ(ة)');
        $aRole = trim($input['authorRole'] ?? $userRole);
        $aSubj = trim($input['authorSubject'] ?? '');
        $status = ($userRole === 'admin' || $userRole === 'director') ? 'approved' : 'pending';

        if (!$title || !$desc) {
            jsonResponse(['success' => false, 'error' => 'عنوان النشاط والوصف مطلوبان'], 400);
        }

        try {
            $stmt = $pdo->prepare("
                INSERT INTO school_activities (id, title, description, category, image_url, author_id, author_name, author_role, author_subject, status, likes_count, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())
            ");
            $stmt->execute([$newId, $title, $desc, $cat, $img, $aId, $aName, $aRole, $aSubj, $status]);
            jsonResponse([
                'success' => true,
                'activity' => [
                    'id' => $newId, 'title' => $title, 'description' => $desc, 'category' => $cat,
                    'imageUrl' => $img, 'authorId' => $aId, 'authorName' => $aName,
                    'authorRole' => $aRole, 'authorSubject' => $aSubj, 'status' => $status,
                    'likesCount' => 0, 'createdAt' => date('Y-m-d H:i:s'), 'updatedAt' => date('Y-m-d H:i:s')
                ],
                'message' => ($status === 'approved') ? 'تم نشر النشاط بنجاح في حائط المؤسسة ✓' : 'تم إرسال النشاط بنجاح وهو قيد مصادقة الإدارة التربوية ✓'
            ]);
        } catch (Exception $e) {
            jsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    // إعجاب بنشاط
    if ($method === 'POST' && !empty($actId) && $subAction === 'like') {
        try {
            $pdo->prepare("UPDATE school_activities SET likes_count = likes_count + 1 WHERE id = ?")->execute([$actId]);
            jsonResponse(['success' => true, 'message' => 'تم تسجيل الإعجاب بنجاح']);
        } catch (Exception $e) {
            jsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    // مصادقة أو تعديل نشاط
    if ($method === 'PUT' && !empty($actId)) {
        $input = getJsonInput();
        $status = $input['status'] ?? null;
        if ($status && in_array($status, ['approved', 'pending', 'rejected'])) {
            $pdo->prepare("UPDATE school_activities SET status = ?, updated_at = NOW() WHERE id = ?")->execute([$status, $actId]);
            jsonResponse(['success' => true, 'message' => 'تم تحديث حالة النشاط بنجاح']);
        }
        jsonResponse(['success' => false, 'error' => 'بيانات التحديث غير صالحة'], 400);
    }

    // حذف نشاط
    if ($method === 'DELETE' && !empty($actId)) {
        try {
            $pdo->prepare("DELETE FROM school_activities WHERE id = ?")->execute([$actId]);
            jsonResponse(['success' => true, 'message' => 'تم حذف النشاط بنجاح']);
        } catch (Exception $e) {
            jsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }
}

// -------------------------------------------------------------
// المسار الافتراضي (Safe 200 Response for unknown routes)
// -------------------------------------------------------------
jsonResponse(['success' => false, 'error' => 'مسار واجهة البرمجة غير موجود: ' . $path]);
