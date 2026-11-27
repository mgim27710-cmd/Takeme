import 'package:flutter_test/flutter_test.dart';
import 'package:shuttle_app_driver/driver/geo.dart';
import 'package:shuttle_app_driver/widgets/marker_layout.dart';

void main() {
  const academy = GeoPoint(37.8095, 127.0705);
  // 위도 0.0001도 ≈ 11m
  const nearA = GeoPoint(37.8097, 127.0705); // 약 22m
  const nearB = GeoPoint(37.8098, 127.0706); // 약 36m
  const far = GeoPoint(37.8123, 127.0712); // 약 320m

  group('stopsNearPoint (유치원 근처 정류장 묶기)', () {
    test('유치원 40m 안의 정류장 번호만 돌려준다', () {
      expect(stopsNearPoint([far, nearA, nearB], academy), [1, 2]);
    });
    test('좌표가 없는 정류장(null)은 건너뛴다', () {
      expect(stopsNearPoint([null, nearA], academy), [1]);
    });
    test('가까운 정류장이 없으면 비어 있다', () {
      expect(stopsNearPoint([far], academy), isEmpty);
    });
  });

  group('isNearAny (유턴 표시를 비껴 놓을지)', () {
    test('정류장 30m 안의 유턴은 비껴 놓는다', () {
      expect(isNearAny(const GeoPoint(37.8123, 127.0713), [far]), isTrue);
    });
    test('멀면 그대로 둔다', () {
      expect(isNearAny(const GeoPoint(37.8200, 127.0800), [far, academy]), isFalse);
    });
    test('비교할 곳이 없으면 그대로 둔다', () {
      expect(isNearAny(far, const []), isFalse);
    });
  });

  group('nearestPathIndexFrom (지금 구간의 끝 찾기)', () {
    // 갔다가 같은 길로 돌아오는 경로: 0→1→2→3(정류장)→2→1→0
    const p0 = GeoPoint(37.8000, 127.0000);
    const p1 = GeoPoint(37.8010, 127.0000);
    const p2 = GeoPoint(37.8020, 127.0000);
    const p3 = GeoPoint(37.8030, 127.0000);
    final path = [p0, p1, p2, p3, p2, p1, p0];

    test('다음 정류장(맨 끝점)에 가장 가까운 점의 번호', () {
      expect(nearestPathIndexFrom(path, 0, p3), 3);
    });
    test('같은 길을 지나는 정류장은 앞쪽(먼저 만나는 쪽)을 고른다', () {
      expect(nearestPathIndexFrom(path, 0, p1), 1);
    });
    test('이미 지난 점(fromIdx 앞)은 보지 않는다', () {
      expect(nearestPathIndexFrom(path, 4, p1), 5);
    });
    test('빈 경로는 0', () {
      expect(nearestPathIndexFrom(const [], 0, p1), 0);
    });
  });

  group('splitRangeAt (지금 가는 구간과 나머지 나누기)', () {
    test('구간 전체가 지금 구간 안이면 나머지는 없다', () {
      final s = splitRangeAt(0, 3, 5);
      expect(s.current, (0, 3));
      expect(s.later, isNull);
    });
    test('중간에서 나뉘면 경계 점을 같이 써서 선이 끊기지 않는다', () {
      final s = splitRangeAt(0, 6, 3);
      expect(s.current, (0, 3));
      expect(s.later, (3, 6));
    });
    test('구간 전체가 지금 구간 뒤면 전부 나머지', () {
      final s = splitRangeAt(4, 6, 3);
      expect(s.current, isNull);
      expect(s.later, (4, 6));
    });
    test('지금 구간의 끝이 시작점이면 지금 구간은 한 점, 나머지가 전부', () {
      final s = splitRangeAt(2, 6, 2);
      expect(s.current, (2, 2));
      expect(s.later, (2, 6));
    });
  });
}
