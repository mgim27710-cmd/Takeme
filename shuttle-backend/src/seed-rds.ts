import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { Academy } from './entities/academy.entity';
import { Vehicle } from './entities/vehicle.entity';
import { Student } from './entities/student.entity';
import { StudentSchedule } from './entities/student-schedule.entity';
import { PickupPoint } from './entities/pickup-point.entity';
import * as bcrypt from 'bcrypt';

const VEHICLE_POLYGONS: Record<string, any[]> = {
  '1호차': [[37.56876, 126.84081], [37.56570, 126.84763], [37.56375, 126.85928], [37.56173, 126.86158], [37.55880, 126.84109], [37.57222, 126.83841], [37.56285, 126.85082], [37.55933, 126.84034], [37.56453, 126.84712], [37.56221, 126.85852], [37.56876, 126.84081]],
  '2호차': [[37.56009, 126.83830], [37.56298, 126.83920], [37.56632, 126.84017], [37.55811, 126.83977], [37.55826, 126.84432], [37.55768, 126.83893], [37.54472, 126.86159], [37.54766, 126.86271], [37.55846, 126.85481], [37.56152, 126.85506], [37.54983, 126.86343]],
  '3호차': [[37.55303, 126.84851], [37.55096, 126.84953], [37.55390, 126.85163], [37.54782, 126.83343], [37.54145, 126.83662], [37.54426, 126.84219]],
  '4호차': [[37.55347, 126.82644], [37.54716, 126.83679], [37.54826, 126.84098], [37.54976, 126.82476]],
  '5호차': [[37.57474, 126.82019], [37.55707, 126.81220], [37.56147, 126.81105], [37.56131, 126.81588], [37.55639, 126.81544]],
  '6호차': [[37.56699, 126.81705], [37.56939, 126.81150], [37.57744, 126.81243], [37.56355, 126.81049], [37.56711, 126.81256], [37.57101, 126.81079], [37.56555, 126.81330], [37.57533, 126.81113]],
  '7호차': [[37.56455, 126.82383], [37.56768, 126.82597], [37.56930, 126.82559]],
  '8호차': [[37.55805, 126.82408], [37.55741, 126.82702], [37.55855, 126.82715], [37.56039, 126.82750], [37.55900, 126.82392], [37.55997, 126.83380], [37.55847, 126.82570], [37.55946, 126.82443], [37.55909, 126.82799], [37.55882, 126.83100]],
};

async function bootstrap() {
  console.log('Connecting to database and starting seed...');
  const app = await NestFactory.createApplicationContext(AppModule);

  const userRepo: Repository<User> = app.get(getRepositoryToken(User));
  const academyRepo: Repository<Academy> = app.get(getRepositoryToken(Academy));
  const vehicleRepo: Repository<Vehicle> = app.get(getRepositoryToken(Vehicle));
  const studentRepo: Repository<Student> = app.get(getRepositoryToken(Student));
  const scheduleRepo: Repository<StudentSchedule> = app.get(getRepositoryToken(StudentSchedule));
  const pickupRepo: Repository<PickupPoint> = app.get(getRepositoryToken(PickupPoint));

  const passwordHash = await bcrypt.hash('1234', 10);

  const getOrCreateUser = async (email: string, name: string, role: UserRole) => {
    let user = await userRepo.findOne({ where: { email } });
    if (!user) {
      user = userRepo.create({
        email,
        name,
        role,
        passwordHash,
        isOtpEnabled: false,
      });
      user = await userRepo.save(user);
    }
    return user;
  };

  // 1. Create or update Admin User
  const adminUser = await getOrCreateUser('shko0502@daum.net', '고상현', UserRole.ACADEMY_ADMIN);
  console.log('Admin user initialized:', adminUser.email);

  // 2. Initialize Academy
  let academy = await academyRepo.findOne({ where: {} });
  if (!academy) {
    academy = academyRepo.create({
      name: '마곡 에듀 학원',
      vehicleCount: 8,
      roadAddress: '마곡중앙로 33',
      latitude: '37.5580501033167',
      longitude: '126.824080226482',
      authCode: 'EOAUH2',
      owner: adminUser,
    });
  } else {
    academy.name = '마곡 에듀 학원';
    academy.vehicleCount = 8;
    academy.roadAddress = '마곡중앙로 33';
    academy.latitude = '37.5580501033167';
    academy.longitude = '126.824080226482';
    academy.authCode = 'EOAUH2';
    academy.owner = adminUser;
  }
  academy = await academyRepo.save(academy);
  console.log('Academy initialized:', academy.name, 'AuthCode:', academy.authCode);

  // 3. Initialize Vehicles & Staff
  const staffConfigs = [
    { busNum: '1호차', plate: '77가 1024', color: '#14b8a6', driverName: '김철수', driverPhone: '010-3124-5678', driverEmail: 'driver1@daum.net', teacherName: '이지은', teacherPhone: '010-8765-4321', teacherEmail: 'teacher1@daum.net', status: 'APPROVED' },
    { busNum: '2호차', plate: '77가 2048', color: '#f97316', driverName: '박영호', driverPhone: '010-2345-6789', driverEmail: 'driver2@daum.net', teacherName: '최수진', teacherPhone: '010-7654-3210', teacherEmail: 'teacher2@daum.net', status: 'APPROVED' },
    { busNum: '3호차', plate: '77가 3072', color: '#6366f1', driverName: '정도현', driverPhone: '010-3456-7890', driverEmail: 'driver3@daum.net', teacherName: '한미래', teacherPhone: '010-6543-2109', teacherEmail: 'teacher3@daum.net', status: 'APPROVED' },
    { busNum: '4호차', plate: '77가 4096', color: '#84cc16', driverName: '강태석', driverPhone: '010-4567-8901', driverEmail: 'driver4@daum.net', teacherName: '윤서연', teacherPhone: '010-5432-1098', teacherEmail: 'teacher4@daum.net', status: 'APPROVED' },
    { busNum: '5호차', plate: '77가 5120', color: '#3b82f6', driverName: '조민기', driverPhone: '010-5678-9012', driverEmail: 'driver5@daum.net', teacherName: '백하늘', teacherPhone: '010-4321-0987', teacherEmail: 'teacher5@daum.net', status: 'APPROVED' },
    { busNum: '6호차', plate: '77가 6144', color: '#ef4444', driverName: '오성훈', driverPhone: '010-6789-0123', driverEmail: 'driver6@daum.net', teacherName: '송예원', teacherPhone: '010-3210-9876', teacherEmail: 'teacher6@daum.net', status: 'PENDING' },
    { busNum: '7호차', plate: '77가 7168', color: '#10b981', driverName: '서준혁', driverPhone: '010-7890-1234', driverEmail: 'driver7@daum.net', teacherName: '안소희', teacherPhone: '010-2109-8765', teacherEmail: 'teacher7@daum.net', status: 'APPROVED' },
    { busNum: '8호차', plate: '77가 8192', color: '#f59e0b', driverName: '황재우', driverPhone: '010-8901-2345', driverEmail: 'driver8@daum.net', teacherName: '문가영', teacherPhone: '010-1098-7654', teacherEmail: 'teacher8@daum.net', status: 'APPROVED' },
  ];

  const vehicleMap: Record<string, Vehicle> = {};

  for (const cfg of staffConfigs) {
    const dUser = await getOrCreateUser(cfg.driverEmail, cfg.driverName, UserRole.DRIVER);
    const tUser = await getOrCreateUser(cfg.teacherEmail, cfg.teacherName, UserRole.TEACHER);

    let v = await vehicleRepo.findOne({ where: { busNumber: cfg.busNum } });
    if (!v) {
      v = vehicleRepo.create({
        busNumber: cfg.busNum,
        academy,
      });
    }
    v.plateNumber = cfg.plate;
    v.driverName = cfg.driverName;
    v.driverPhone = cfg.driverPhone;
    v.teacherName = cfg.teacherName;
    v.teacherPhone = cfg.teacherPhone;
    v.capacity = 25;
    v.colorHex = cfg.color;
    v.driverUser = dUser;
    v.teacherUser = tUser;
    v.driverApprovalStatus = cfg.status;
    v.teacherApprovalStatus = cfg.status;
    v.polygonCoordinates = VEHICLE_POLYGONS[cfg.busNum] || [];
    v.academy = academy;

    v = await vehicleRepo.save(v);
    vehicleMap[cfg.busNum] = v;
  }
  console.log('8 Vehicles & Staff initialized.');

  // 4. Initialize Students & Schedules
  await scheduleRepo.createQueryBuilder().delete().execute();
  await studentRepo.createQueryBuilder().delete().execute();

  const studentsList = [
    { name: '김민준', busNum: '1호차', address: '서울 강서구 마곡서로 101', pickup: '마곡엠밸리 7단지 701동 앞', lat: 37.5645, lng: 126.8285, parentEmail: 'parent_minjun@daum.net', studentEmail: 'student_minjun@daum.net', parentPhone: '010-9111-1001', status: 'APPROVED' },
    { name: '이서아', busNum: '3호차', address: '서울 강서구 남부순환로 123', pickup: '수명산파크 3단지 정문', lat: 37.5515, lng: 126.8335, parentEmail: 'parent_seoa@daum.net', studentEmail: 'student_seoa@daum.net', parentPhone: '010-9111-1002', status: 'APPROVED' },
    { name: '박도윤', busNum: '3호차', address: '서울 강서구 강서로 260', pickup: '우장산역 1번 출구', lat: 37.5480, lng: 126.8360, parentEmail: 'parent_doyun@daum.net', studentEmail: 'student_doyun@daum.net', parentPhone: '010-9111-1003', status: 'APPROVED' },
    { name: '최지우', busNum: '2호차', address: '서울 강서구 강서로 56길', pickup: '발산역 3번 출구 NC백화점 앞', lat: 37.5585, lng: 126.8395, parentEmail: 'parent_jiwoo@daum.net', studentEmail: 'student_jiwoo@daum.net', parentPhone: '010-9111-1004', status: 'APPROVED' },
    { name: '정하은', busNum: '7호차', address: '서울 강서구 마곡중앙5로 9', pickup: '마곡나루역 2번 출구', lat: 37.5670, lng: 126.8280, parentEmail: 'parent_haeun@daum.net', studentEmail: 'student_haeun@daum.net', parentPhone: '010-9111-1005', status: 'APPROVED' },
    { name: '강시우', busNum: '8호차', address: '서울 강서구 마곡동 740', pickup: '공진초등학교 정문', lat: 37.5615, lng: 126.8310, parentEmail: 'parent_siwoo@daum.net', studentEmail: 'student_siwoo@daum.net', parentPhone: '010-9111-1006', status: 'APPROVED' },
    { name: '윤예준', busNum: '5호차', address: '서울 강서구 마곡중앙로 55', pickup: '마곡 힐스테이트 정문', lat: 37.5630, lng: 126.8210, parentEmail: 'parent_yejun@daum.net', studentEmail: 'student_yejun@daum.net', parentPhone: '010-9111-1007', status: 'PENDING' },
    { name: '임수아', busNum: '6호차', address: '서울 강서구 방화동 250', pickup: '방화동 신동아아파트 입구', lat: 37.5720, lng: 126.8150, parentEmail: 'parent_sua@daum.net', studentEmail: 'student_sua@daum.net', parentPhone: '010-9111-1008', status: 'PENDING' },
    { name: '한유준', busNum: '4호차', address: '서울 강서구 수명로 68', pickup: '마곡수명산파크 5단지 상가 앞', lat: 37.5505, lng: 126.8290, parentEmail: 'parent_yujun@daum.net', studentEmail: 'student_yujun@daum.net', parentPhone: '010-9111-1009', status: 'APPROVED' },
    { name: '오채원', busNum: '1호차', address: '서울 강서구 공항대로 45길', pickup: '등촌3동 주공아파트 정류장', lat: 37.5605, lng: 126.8450, parentEmail: 'parent_chaewon@daum.net', studentEmail: 'student_chaewon@daum.net', parentPhone: '010-9111-1010', status: 'APPROVED' },
    { name: '송민성', busNum: '2호차', address: '서울 강서구 양천로 431', pickup: '가양역 7번 출구 홈플러스 앞', lat: 37.5620, lng: 126.8540, parentEmail: 'parent_minseong@daum.net', studentEmail: 'student_minseong@daum.net', parentPhone: '010-9111-1011', status: 'APPROVED' },
    { name: '배서윤', busNum: '6호차', address: '서울 강서구 금낭화로 135', pickup: '송화초등학교 후문', lat: 37.5680, lng: 126.8180, parentEmail: 'parent_seoyun@daum.net', studentEmail: 'student_seoyun@daum.net', parentPhone: '010-9111-1012', status: 'APPROVED' },
  ];

  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI'];

  for (const s of studentsList) {
    const pUser = await getOrCreateUser(s.parentEmail, `${s.name} 학부모`, UserRole.PARENT);
    const sUser = await getOrCreateUser(s.studentEmail, s.name, UserRole.STUDENT);
    const assignedV = vehicleMap[s.busNum];

    const student = studentRepo.create({
      name: s.name,
      adminDisplayName: s.name,
      address: s.address,
      boardingLocation: s.pickup,
      latitude: s.lat,
      longitude: s.lng,
      academy,
      assignedVehicle: assignedV,
      studentUser: sUser,
      parentUser: pUser,
      runNumber: 1,
      approvalStatus: s.status,
      boardStatus: 'WAITING',
      raw: {
        '원생명': s.name,
        '주소': s.address,
        '탑승지': s.pickup,
        '학부모연락처': s.parentPhone,
        '등원차량': s.busNum,
        '하원차량': s.busNum
      }
    });

    const savedStudent = await studentRepo.save(student);

    for (const d of days) {
      await scheduleRepo.save(scheduleRepo.create({
        student: savedStudent,
        type: 'BOARDING',
        dayOfWeek: d,
        address: s.pickup,
        latitude: s.lat,
        longitude: s.lng,
        isCustomLocation: false,
        assignedVehicle: assignedV
      }));
      await scheduleRepo.save(scheduleRepo.create({
        student: savedStudent,
        type: 'ALIGHTING',
        dayOfWeek: d,
        address: s.pickup,
        latitude: s.lat,
        longitude: s.lng,
        isCustomLocation: false,
        assignedVehicle: assignedV
      }));
    }
  }
  console.log('12 Students & Schedules initialized.');

  // 5. Pickup Points
  await pickupRepo.createQueryBuilder().delete().execute();
  const pickupPoints = [
    { name: '마곡엠밸리 7단지 앞', lat: 37.5645, lng: 126.8285 },
    { name: '수명산파크 3단지 정문', lat: 37.5515, lng: 126.8335 },
    { name: '우장산역 1번 출구', lat: 37.5480, lng: 126.8360 },
    { name: '발산역 NC백화점 앞', lat: 37.5585, lng: 126.8395 },
    { name: '마곡나루역 2번 출구', lat: 37.5670, lng: 126.8280 },
    { name: '공진초등학교 정문', lat: 37.5615, lng: 126.8310 },
    { name: '마곡 힐스테이트 앞', lat: 37.5630, lng: 126.8210 },
    { name: '가양역 7번 출구', lat: 37.5620, lng: 126.8540 }
  ];

  for (const p of pickupPoints) {
    await pickupRepo.save(pickupRepo.create({
      name: p.name,
      latitude: p.lat,
      longitude: p.lng,
      academy,
    }));
  }
  console.log('Pickup points initialized.');

  console.log('ALL RDS DATA SUCCESSFULLY INITIALIZED!');
  await app.close();
}

bootstrap().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
