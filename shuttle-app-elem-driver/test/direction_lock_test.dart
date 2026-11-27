import 'package:flutter_test/flutter_test.dart';
import 'package:shuttle_app_driver/driver/direction_lock.dart';

void main() {
  final t0 = DateTime(2026, 11, 25, 9, 0, 0);

  group('angleDiffDeg', () {
    test('0도와 350도는 10도 차이', () => expect(angleDiffDeg(0, 350), closeTo(10, 0.001)));
    test('90도와 270도는 180도 차이', () => expect(angleDiffDeg(90, 270), closeTo(180, 0.001)));
    test('같은 방향은 0', () => expect(angleDiffDeg(45, 45), 0));
  });

  group('DirectionLock (15초)', () {
    test('잠금 전에는 아무것도 막지 않는다', () {
      final lock = DirectionLock();
      expect(lock.blocksFlip(now: t0, newStartBearing: 180, vehicleHeading: 0), isFalse);
    });

    test('방향을 정한 뒤 15초 안에 반대 방향 경로가 오면 막는다', () {
      final lock = DirectionLock()..lock(0, t0); // 북쪽으로 안내
      final now = t0.add(const Duration(seconds: 8)); // 다음 재탐색(8초 뒤)
      expect(lock.blocksFlip(now: now, newStartBearing: 180, vehicleHeading: 5), isTrue);
    });

    test('15초가 지나면 반대 방향 경로도 받아들인다', () {
      final lock = DirectionLock()..lock(0, t0);
      final now = t0.add(const Duration(seconds: 15));
      expect(lock.blocksFlip(now: now, newStartBearing: 180, vehicleHeading: 5), isFalse);
    });

    test('같은 방향이거나 약간 다른 방향 경로는 막지 않는다', () {
      final lock = DirectionLock()..lock(0, t0);
      final now = t0.add(const Duration(seconds: 5));
      expect(lock.blocksFlip(now: now, newStartBearing: 10, vehicleHeading: 0), isFalse);
      expect(lock.blocksFlip(now: now, newStartBearing: 90, vehicleHeading: 0), isFalse); // 직각 방향 = 일반 회전
    });

    test('차가 실제로 반대로 달리고 있으면(진짜 유턴) 잠금 중에도 따라간다', () {
      final lock = DirectionLock()..lock(0, t0);
      final now = t0.add(const Duration(seconds: 5));
      expect(lock.blocksFlip(now: now, newStartBearing: 180, vehicleHeading: 175), isFalse);
    });

    test('새 경로 방향을 알 수 없으면 막지 않는다', () {
      final lock = DirectionLock()..lock(0, t0);
      expect(lock.blocksFlip(now: t0, newStartBearing: null, vehicleHeading: 0), isFalse);
    });

    test('방향을 모르면 잠그지 않는다', () {
      final lock = DirectionLock()..lock(null, t0);
      expect(lock.isActive(t0), isFalse);
    });

    test('clear 하면 풀린다', () {
      final lock = DirectionLock()..lock(0, t0);
      lock.clear();
      expect(lock.blocksFlip(now: t0, newStartBearing: 180, vehicleHeading: 0), isFalse);
    });

    test('잠금 시간 기본값은 15초', () {
      expect(DirectionLock().seconds, 15);
    });
  });
}
