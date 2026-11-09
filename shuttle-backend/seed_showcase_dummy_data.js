const { Client } = require('pg');
require('dotenv').config({ path: '/home/ec2-user/Takeme/shuttle-backend/.env' });

const client = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

// Helper for Korean names
const FAMILY_NAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '전', '홍', '고', '문', '손', '양', '배', '백', '허', '유', '남', '심'];
const BOY_FIRST_NAMES = ['민준', '도윤', '시우', '하준', '은우', '서준', '예준', '유준', '지호', '도현', '지후', '태윤', '준혁', '민성', '선우', '이준', '우진', '준서', '정우', '건우', '시현', '찬우', '서진', '진우', '현우'];
const GIRL_FIRST_NAMES = ['서아', '하은', '지아', '서윤', '서현', '지우', '하린', '수아', '지유', '채원', '예린', '소율', '채은', '다은', '소윤', '아린', '나은', '윤아', '민서', '유나', '소은', '시아', '다인', '지원', '하율'];

const ALLERGIES_LIST = [
  '없음',
  '없음',
  '없음',
  '없음',
  '땅콩 알레르기 (심함, 에피네프린 지참)',
  '계란/달걀 알레르기',
  '우유 및 유제품 알레르기',
  '복숭아 알레르기',
  '갑각류/새우 알레르기',
  '대두/콩 알레르기',
];

const TEACHERS = [
  '이지은 선생님',
  '최수진 선생님',
  '김지원 선생님',
  '한미래 선생님',
  '윤서연 선생님',
  '송예원 선생님'
];

const CLASSES = [
  { name: '새싹반', targetAge: '3세', teacher: '이지은 선생님' },
  { name: '햇살반', targetAge: '4세', teacher: '최수진 선생님' },
  { name: '바다반', targetAge: '5세', teacher: '김지원 선생님' },
  { name: '은하수반', targetAge: '6세', teacher: '한미래 선생님' },
  { name: '우주반', targetAge: '7세', teacher: '윤서연 선생님' },
  { name: '무지개반', targetAge: '혼합반', teacher: '송예원 선생님' },
];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generatePhone(idx) {
  const p1 = 2000 + (idx % 8000);
  const p2 = 1000 + ((idx * 3) % 9000);
  return `010-${p1}-${p2}`;
}

// Generate realistic students data for an academy
function buildStudentsForAcademy(academyId, vehicleMap, baseLat, baseLng, locationType) {
  const students = [];
  let studentIdx = 1;

  // Distribution plan:
  // 1호차: 25명 (만석 빗금 시연용! 23명 중심부, 2명 외곽)
  // 2호차: 14명 (여유 11석)
  // 3호차: 10명
  // 4호차: 8명
  // 5호차: 6명
  // 6호차: 6명
  // 7호차: 6명
  // 8호차: 6명
  // 미배정: 6명
  // 자차/미탑승: 3명
  const vehicleDistribution = [
    { busNum: '1호차', count: 25 },
    { busNum: '2호차', count: 14 },
    { busNum: '3호차', count: 10 },
    { busNum: '4호차', count: 8 },
    { busNum: '5호차', count: 6 },
    { busNum: '6호차', count: 6 },
    { busNum: '7호차', count: 6 },
    { busNum: '8호차', count: 6 },
    { busNum: '미배정', count: 6 },
    { busNum: '자차', count: 3 }
  ];

  // Age distributions: 3세 (2023), 4세 (2022), 5세 (2021), 6세 (2020), 7세 (2019)
  const agePool = [
    { age: '3세', birthYear: 2023, targetClass: '새싹반' },
    { age: '4세', birthYear: 2022, targetClass: '햇살반' },
    { age: '5세', birthYear: 2021, targetClass: '바다반' },
    { age: '6세', birthYear: 2020, targetClass: '은하수반' },
    { age: '7세', birthYear: 2019, targetClass: '우주반' },
  ];

  vehicleDistribution.forEach(dist => {
    const vId = vehicleMap[dist.busNum] || null;
    const isUnassigned = dist.busNum === '미배정';
    const isSelfPickup = dist.busNum === '자차';

    for (let i = 0; i < dist.count; i++) {
      const isBoy = Math.random() > 0.5;
      const fName = getRandomItem(FAMILY_NAMES);
      const lName = isBoy ? getRandomItem(BOY_FIRST_NAMES) : getRandomItem(GIRL_FIRST_NAMES);
      const studentName = fName + lName;

      const ageInfo = agePool[studentIdx % agePool.length];
      const month = String(1 + (studentIdx % 12)).padStart(2, '0');
      const day = String(1 + (studentIdx * 7 % 28)).padStart(2, '0');
      const birthDate = `${ageInfo.birthYear}-${month}-${day}`;

      // Leave about 10 students unassigned from class for testing Class Manager
      let className = null;
      let teacherName = '';
      if (studentIdx > 10) {
        if (studentIdx % 7 === 0) {
          className = '무지개반';
          teacherName = '송예원 선생님';
        } else {
          className = ageInfo.targetClass;
          const classObj = CLASSES.find(c => c.name === className);
          teacherName = classObj ? classObj.teacher : '이지은 선생님';
        }
      }

      // Coordinates generation based on bus zone
      // 1호차 gets coordinates tightly clustered, but item 23 & 24 are furthest outwards
      let latOffset = 0;
      let lngOffset = 0;
      if (dist.busNum === '1호차') {
        if (i === 23) {
          latOffset = 0.022; // Outlier 1
          lngOffset = 0.028;
        } else if (i === 24) {
          latOffset = 0.025; // Outlier 2
          lngOffset = 0.031;
        } else {
          latOffset = 0.003 + (i * 0.0006);
          lngOffset = 0.004 + (i * 0.0007);
        }
      } else if (dist.busNum === '2호차') {
        latOffset = -0.008 + (i * 0.0008);
        lngOffset = 0.008 + (i * 0.0007);
      } else if (dist.busNum === '3호차') {
        latOffset = -0.015 + (i * 0.0009);
        lngOffset = -0.006 + (i * 0.0008);
      } else if (dist.busNum === '4호차') {
        latOffset = -0.005 + (i * 0.0007);
        lngOffset = -0.018 + (i * 0.0009);
      } else if (dist.busNum === '5호차') {
        latOffset = 0.008 + (i * 0.0008);
        lngOffset = -0.020 + (i * 0.0008);
      } else if (dist.busNum === '6호차') {
        latOffset = 0.018 + (i * 0.0007);
        lngOffset = -0.015 + (i * 0.0009);
      } else if (dist.busNum === '7호차') {
        latOffset = 0.016 + (i * 0.0008);
        lngOffset = 0.005 + (i * 0.0007);
      } else if (dist.busNum === '8호차') {
        latOffset = 0.002 + (i * 0.0006);
        lngOffset = 0.001 + (i * 0.0006);
      } else {
        // Unassigned / Self-pickup
        latOffset = (Math.random() - 0.5) * 0.02;
        lngOffset = (Math.random() - 0.5) * 0.02;
      }

      const lat = Number((baseLat + latOffset).toFixed(6));
      const lng = Number((baseLng + lngOffset).toFixed(6));

      const phone = generatePhone(studentIdx);
      const parentName = fName + (isBoy ? '영호' : '미경') + ' 보호자';
      const allergy = ALLERGIES_LIST[studentIdx % ALLERGIES_LIST.length];

      const locationName = locationType === 'yangju'
        ? `양주시 회천남로 ${100 + studentIdx}`
        : `서울시 강서구 마곡서로 ${100 + studentIdx}`;

      const boardingSpot = locationType === 'yangju'
        ? `양주 옥정 e편한세상 ${studentIdx}단지 앞`
        : `마곡 엠밸리 ${studentIdx % 15 + 1}단지 정문`;

      const dropoffSpot = locationType === 'yangju'
        ? `양주 옥정 센트럴파크 ${studentIdx}동 건널목`
        : `마곡 힐스테이트 ${studentIdx % 10 + 1}동 정문 앞`;

      const raw = {
        '원생명': studentName,
        '학생이름/영문이름': studentName,
        '생년월일': birthDate,
        '생일': birthDate,
        '연령': ageInfo.age,
        '나이': ageInfo.age,
        '성별': isBoy ? '남' : '여',
        '반명': className || '',
        '반': className || '',
        '담임명': teacherName,
        '선생님': teacherName,
        '학부모연락처': phone,
        '부모연락처': phone,
        '연락처': phone,
        '보호자 성함': parentName,
        '도로명주소': locationName,
        '주소': locationName,
        '등원지': boardingSpot,
        '탑승지': boardingSpot,
        '승차지': boardingSpot,
        '하원지': dropoffSpot,
        '하차지': dropoffSpot,
        '알레르기': allergy,
        '알러지': allergy,
        '등원차량': isUnassigned || isSelfPickup ? '' : dist.busNum,
        '하원차량': isUnassigned || isSelfPickup ? '' : dist.busNum,
        '차량': isUnassigned || isSelfPickup ? '' : dist.busNum,
        '호차': isUnassigned || isSelfPickup ? '' : dist.busNum,
        '차량미탑승': isSelfPickup,
        '미탑승': isSelfPickup,
      };

      students.push({
        name: studentName,
        adminDisplayName: studentName,
        gender: isBoy ? '남' : '여',
        birthDate: birthDate,
        className: className,
        phone: phone,
        address: locationName,
        boardingLocation: boardingSpot,
        dropoffLocation: dropoffSpot,
        allergies: allergy,
        latitude: lat,
        longitude: lng,
        academyId: academyId,
        assignedVehicleId: isUnassigned || isSelfPickup ? null : vId,
        assignedDepartureVehicleId: isUnassigned || isSelfPickup ? null : vId,
        isNotRiding: isSelfPickup,
        boardStatus: isSelfPickup ? 'SELF_PICKUP' : (studentIdx % 8 === 0 ? 'BOARDED' : 'WAITING'),
        approvalStatus: 'APPROVED',
        raw: JSON.stringify(raw),
        runNumber: 1
      });

      studentIdx++;
    }
  });

  return students;
}

async function main() {
  await client.connect();
  console.log('Connected to RDS PostgreSQL. Seeding showcase dummy data...');

  // 1. Fetch Academy 12 and Academy 1
  const acad12 = await client.query('SELECT * FROM academies WHERE id = 12');
  const acad1 = await client.query('SELECT * FROM academies WHERE id = 1');
  const acad11 = await client.query('SELECT * FROM academies WHERE id = 11');

  const academiesToSeed = [
    { id: 12, lat: 37.828, lng: 127.065, type: 'yangju' },
    { id: 1, lat: 37.558, lng: 126.832, type: 'magok' },
    { id: 11, lat: 37.828, lng: 127.065, type: 'yangju' }
  ];

  for (const acadInfo of academiesToSeed) {
    const aId = acadInfo.id;
    console.log(`\n================ Processing Academy ID: ${aId} ================`);

    // Get vehicles map for this academy
    const vRes = await client.query('SELECT id, "busNumber" FROM vehicles WHERE "academyId" = $1', [aId]);
    const vMap = {};
    vRes.rows.forEach(r => { vMap[r.busNumber] = r.id; });
    console.log(`Vehicle map for academy ${aId}:`, vMap);

    // Clean old dummy data for this academy (EXCLUDING users table!)
    console.log(`Cleaning old dummy data for academy ${aId}...`);
    await client.query('DELETE FROM student_schedules WHERE "studentId" IN (SELECT id FROM students WHERE "academyId" = $1)', [aId]);
    await client.query('DELETE FROM schedule_overrides WHERE "studentId" IN (SELECT id FROM students WHERE "academyId" = $1)', [aId]);
    await client.query('DELETE FROM approval_requests WHERE "academyId" = $1', [aId]);
    await client.query('DELETE FROM notifications WHERE "academyId" = $1', [aId]);
    await client.query('DELETE FROM academy_holidays WHERE "academyId" = $1', [aId]);
    await client.query('DELETE FROM students WHERE "academyId" = $1', [aId]);

    // Build students
    const dummyStudents = buildStudentsForAcademy(aId, vMap, acadInfo.lat, acadInfo.lng, acadInfo.type);
    console.log(`Generated ${dummyStudents.length} students for academy ${aId}. Inserting...`);

    const insertedStudentRows = [];
    for (const s of dummyStudents) {
      const insRes = await client.query(`
        INSERT INTO students (
          name, "adminDisplayName", gender, "birthDate", "className", phone,
          address, "boardingLocation", "dropoffLocation", allergies,
          latitude, longitude, "academyId", "assignedVehicleId", "assignedDepartureVehicleId",
          "isNotRiding", "boardStatus", "approvalStatus", raw, "runNumber"
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10,
          $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20
        ) RETURNING id, name, "assignedVehicleId", "isNotRiding"
      `, [
        s.name, s.adminDisplayName, s.gender, s.birthDate, s.className, s.phone,
        s.address, s.boardingLocation, s.dropoffLocation, s.allergies,
        s.latitude, s.longitude, s.academyId, s.assignedVehicleId, s.assignedDepartureVehicleId,
        s.isNotRiding, s.boardStatus, s.approvalStatus, s.raw, s.runNumber
      ]);
      insertedStudentRows.push(insRes.rows[0]);
    }
    console.log(`Inserted ${insertedStudentRows.length} students into DB.`);

    // Insert Schedules (MON-FRI) for riding students
    console.log(`Inserting schedules for riding students...`);
    const days = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
    let schedCount = 0;
    for (const st of insertedStudentRows) {
      if (st.assignedVehicleId && !st.isNotRiding) {
        for (const d of days) {
          await client.query(`
            INSERT INTO student_schedules ("studentId", type, "dayOfWeek", address, "assignedVehicleId")
            VALUES ($1, 'BOARDING', $2, '등원 탑승지', $3), ($1, 'ALIGHTING', $2, '하원 하차지', $3)
          `, [st.id, d, st.assignedVehicleId]);
          schedCount += 2;
        }
      }
    }
    console.log(`Inserted ${schedCount} schedule records.`);

    // Insert Overrides (당일 1회 탑승, 탑승지 변경, 결석)
    console.log(`Inserting schedule overrides for today (2026-11-10)...`);
    const today = '2026-11-10';
    const bus1Id = vMap['1호차'];
    const bus2Id = vMap['2호차'];

    // Override 1: 당일 1회 탑승 (Self pickup -> Boarding 1호차)
    const selfPickupStudent = insertedStudentRows.find(s => s.isNotRiding);
    if (selfPickupStudent && bus1Id) {
      await client.query(`
        INSERT INTO schedule_overrides (
          "studentId", "startDate", "endDate", "overrideType", direction,
          reason, "newVehicleId", "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $2, 'ONE_TIME_BOARDING', 'ALL',
          '학부모 출장으로 인한 당일 1회 셔틀 신청 (1호차)', $3, NOW(), NOW()
        )
      `, [selfPickupStudent.id, today, bus1Id]);
      console.log(`Created ONE_TIME_BOARDING override for student ${selfPickupStudent.name}`);
    }

    // Override 2: 당일 하차지 변경
    const busStudent = insertedStudentRows.find(s => s.assignedVehicleId && !s.isNotRiding);
    if (busStudent) {
      const newLat = acadInfo.lat + 0.005;
      const newLng = acadInfo.lng + 0.006;
      await client.query(`
        INSERT INTO schedule_overrides (
          "studentId", "startDate", "endDate", "overrideType", direction,
          "newAddress", latitude, longitude, reason, "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $2, 'CHANGE_LOCATION', 'AFTERNOON',
          '학원 인근 NC백화점 앞 정류장', $3, $4, '문화센터 방문으로 인한 하차지 변경', NOW(), NOW()
        )
      `, [busStudent.id, today, newLat, newLng]);
      console.log(`Created CHANGE_LOCATION override for student ${busStudent.name}`);
    }

    // Override 3: 당일 결석
    const absentStudent = insertedStudentRows.filter(s => s.assignedVehicleId && !s.isNotRiding)[2];
    if (absentStudent) {
      await client.query(`
        INSERT INTO schedule_overrides (
          "studentId", "startDate", "endDate", "overrideType", direction,
          reason, "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $2, 'ABSENCE', 'ALL',
          '소아과 병원 진료로 인한 결석', NOW(), NOW()
        )
      `, [absentStudent.id, today]);
      console.log(`Created ABSENCE override for student ${absentStudent.name}`);
    }

    // Insert Calendar Holidays & Events (`academy_holidays`)
    console.log(`Inserting calendar holidays & events...`);
    const holidaysData = [
      { type: 'EVENT', title: '원내 소방 안전 대피 훈련', start: '2026-11-04', end: '2026-11-04', targetClass: null, reason: '안전 교육 및 소방서 합동 모의 훈련' },
      { type: 'EVENT', title: '바다반 11월 생일 축하 파티', start: '2026-11-10', end: '2026-11-10', targetClass: '바다반', reason: '11월 생일 원아 축하 다과회' },
      { type: 'EVENT', title: '가을 숲체험 및 소풍', start: '2026-11-13', end: '2026-11-13', targetClass: null, reason: '자연 생태 탐방 및 야외 도시락' },
      { type: 'ACADEMY_HOLIDAY', title: '원내 교사 역량강화 연수', start: '2026-11-16', end: '2026-11-16', targetClass: null, reason: '유치원 전체 휴원 (교원 전문 연수)' },
      { type: 'EVENT', title: '학부모 참관 수업 및 상담', start: '2026-11-20', end: '2026-11-20', targetClass: null, reason: '공개 수업 및 2학기 학부모 상담' },
      { type: 'ACADEMY_HOLIDAY', title: '개원 기념일 휴원', start: '2026-11-25', end: '2026-11-25', targetClass: null, reason: '유치원 개원 기념일 정기 휴원' },
      { type: 'EVENT', title: '새싹반 오감 자극 물감 놀이', start: '2026-11-27', end: '2026-11-27', targetClass: '새싹반', reason: '새싹반 특별 창의 미술 프로그램' }
    ];

    for (const h of holidaysData) {
      await client.query(`
        INSERT INTO academy_holidays (
          type, title, "startDate", "endDate", "targetClass", reason, "academyId", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      `, [h.type, h.title, h.start, h.end, h.targetClass, h.reason, aId]);
    }
    console.log(`Inserted ${holidaysData.length} calendar events/holidays.`);

    // Insert Approval Requests
    console.log(`Inserting approval requests...`);
    const req1 = await client.query(`
      INSERT INTO approval_requests (
        type, "requesterRole", "studentId", "targetDate", direction, reason, status, "academyId", "createdAt", "updatedAt"
      ) VALUES (
        'ABSENCE', 'PARENT', $1, '2026-11-10', 'ALL', '소아과 병원 진료로 인한 결석 신청', 'APPROVED', $2, NOW(), NOW()
      ) RETURNING id
    `, [absentStudent ? absentStudent.id : insertedStudentRows[0].id, aId]);

    const req2 = await client.query(`
      INSERT INTO approval_requests (
        type, "requesterRole", "studentId", "targetDate", direction, reason, status, "targetVehicleId", "academyId", "createdAt", "updatedAt"
      ) VALUES (
        'ONE_TIME_BOARDING', 'PARENT', $1, '2026-11-10', 'ALL', '학부모 출장으로 인한 당일 1회 셔틀 신청 (1호차)', 'PENDING', $2, $3, NOW(), NOW()
      ) RETURNING id
    `, [selfPickupStudent ? selfPickupStudent.id : insertedStudentRows[1].id, bus1Id, aId]);

    const req3 = await client.query(`
      INSERT INTO approval_requests (
        type, "requesterRole", "studentId", "targetDate", direction, "newAddress", reason, status, "academyId", "createdAt", "updatedAt"
      ) VALUES (
        'CHANGE_LOCATION', 'PARENT', $1, '2026-11-10', 'AFTERNOON', 'NC백화점 앞 정류장', '문화센터 수업으로 인한 하차지 변경', 'APPROVED', $2, NOW(), NOW()
      ) RETURNING id
    `, [busStudent ? busStudent.id : insertedStudentRows[2].id, aId]);

    const req4 = await client.query(`
      INSERT INTO approval_requests (
        type, "requesterRole", "studentId", "targetDate", direction, reason, status, "academyId", "createdAt", "updatedAt"
      ) VALUES (
        'PICKUP', 'PARENT', $1, '2026-11-10', 'AFTERNOON', '가족 모임으로 조기 하원 및 보호자 직접 픽업', 'PENDING', $2, NOW(), NOW()
      ) RETURNING id
    `, [insertedStudentRows[3].id, aId]);

    // Insert Notifications
    console.log(`Inserting notifications...`);
    const notificationsData = [
      { type: 'ABSENCE', msg: `[결석 신청] ${absentStudent ? absentStudent.name : '원아'} 병원 진료로 인한 결석 신청 (승인 완료)`, reqId: req1.rows[0].id },
      { type: 'SHUTTLE_REQUEST', msg: `[셔틀 신청] ${selfPickupStudent ? selfPickupStudent.name : '원아'} 11월 10일 1호차 1회 탑승 신청 (원장 결재 대기)`, reqId: req2.rows[0].id },
      { type: 'CHANGE_LOCATION', msg: `[위치 변경] ${busStudent ? busStudent.name : '원아'} 하원 위치 변경 요청 (NC백화점 앞 승인 완료)`, reqId: req3.rows[0].id },
      { type: 'PAYMENT_DECISION', msg: `[결제 완료] ${insertedStudentRows[0].name} 학부모 11월 통학 셔틀 이용료 결제 승인 완료 (150,000원)`, reqId: null },
      { type: 'PICKUP', msg: `[직접 픽업] ${insertedStudentRows[3].name} 원아 오늘 하원 보호자 직접 픽업 접수 (결재 대기)`, reqId: req4.rows[0].id }
    ];

    for (const n of notificationsData) {
      await client.query(`
        INSERT INTO notifications (
          type, message, "recipientRole", "isRead", "academyId", "approvalRequestId", "createdAt", "updatedAt"
        ) VALUES ($1, $2, 'ACADEMY_ADMIN', false, $3, $4, NOW(), NOW())
      `, [n.type, n.msg, aId, n.reqId]);
    }
    console.log(`Inserted ${notificationsData.length} notifications.`);
  }

  // Summary check
  console.log('\n================ Verification Summary ================');
  const countRes = await client.query(`
    SELECT a.id, a.name, count(s.id) as student_count
    FROM academies a
    JOIN students s ON s."academyId" = a.id
    WHERE a.id IN (1, 11, 12)
    GROUP BY a.id, a.name
    ORDER BY a.id
  `);
  console.log('Students count per academy:', countRes.rows);

  const v12Res = await client.query(`
    SELECT v."busNumber", count(s.id) as student_count
    FROM vehicles v
    LEFT JOIN students s ON s."assignedVehicleId" = v.id
    WHERE v."academyId" = 12
    GROUP BY v."busNumber"
    ORDER BY v."busNumber"
  `);
  console.log('Academy 12 vehicle student counts:\n', v12Res.rows);

  await client.end();
  console.log('\nSeeding completed successfully!');
}

main().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
