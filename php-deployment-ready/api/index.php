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
                                $durLabel = $hours . ' ساعة';

                                $updAtt = $pdo->prepare("UPDATE attendance_history SET removed_by = ?, removed_at = NOW(), remover_name = ?, remover_subject = ?, duration_hours = ?, duration_label = ? WHERE id = ?");
                                $updAtt->execute([$userId, $removerName, $removerSub, $hours, $durLabel, $attRow['id']]);
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

        jsonResponse([
            'success' => true,
            'absences' => $absences,
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
            $durLabel = $hours . ' ساعة';

            $upd = $pdo->prepare("UPDATE attendance_history SET removed_by = ?, removed_at = NOW(), remover_name = ?, remover_subject = ?, duration_hours = ?, duration_label = ? WHERE id = ?");
            $upd->execute([$userId, $actorName, $actorSub, $hours, $durLabel, $id]);

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
// المسار الافتراضي (Safe 200 Response for unknown routes)
// -------------------------------------------------------------
jsonResponse(['success' => false, 'error' => 'مسار واجهة البرمجة غير موجود: ' . $path]);
