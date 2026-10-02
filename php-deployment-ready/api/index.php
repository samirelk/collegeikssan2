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

    // قائمة المستخدمين للمدير
    if ($action === 'users' && $method === 'GET') {
        $stmt = $pdo->query("SELECT id, username, email, full_name as fullName, role, status, subject, academic_year as academicYear, created_at as createdAt FROM users ORDER BY created_at DESC");
        jsonResponse(['success' => true, 'users' => $stmt->fetchAll()]);
    }

    // تعديل حالة مستخدم (قبول / رفض / حذف)
    if ($action === 'users' && isset($segments[1]) && isset($segments[2]) && $segments[2] === 'status' && $method === 'PUT') {
        $targetId = $segments[1];
        $input = getJsonInput();
        $newStatus = $input['status'] ?? 'active';

        $stmt = $pdo->prepare("UPDATE users SET status = ? WHERE id = ?");
        $stmt->execute([$newStatus, $targetId]);
        jsonResponse(['success' => true, 'message' => 'تم تحديث حالة المستخدم بنجاح']);
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

// -------------------------------------------------------------
// المسار الافتراضي (404 Not Found)
// -------------------------------------------------------------
jsonResponse(['success' => false, 'error' => 'مسار واجهة البرمجة غير موجود: ' . $path], 404);
