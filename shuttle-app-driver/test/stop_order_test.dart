import 'package:flutter_test/flutter_test.dart';
import 'package:shuttle_app_driver/driver/geo.dart';
import 'package:shuttle_app_driver/driver/stop_order.dart';

/// 실제로 크게 돌아갔던 경우의 좌표 (고장산 동쪽: 유치원·강지안, 서쪽: 임하은)
const academy = GeoPoint(37.8095, 127.0705);
const gangjian = GeoPoint(37.8123, 127.0712); // 유치원에서 약 320m (동쪽)
const imhaeun = GeoPoint(37.8137, 127.0575); // 유치원에서 서쪽 약 1.2km
const carWest = GeoPoint(37.8137, 127.0540); // 차가 서쪽(임하은 근처)에 있을 때

void main() {
  group('bestOrder', () {
    test('차가 서쪽에 있으면 서쪽 정류장(임하은)을 먼저 들른다', () {
      // 서버 순서: 강지안(0), 임하은(1)
      final order = bestOrder([gangjian, imhaeun], start: carWest, end: academy);
      expect(order, [1, 0]);
    });

    test('차가 유치원에 있으면 순서를 바꾸지 않는다 (같은 거리면 지금 순서 유지)', () {
      final order = bestOrder([gangjian, imhaeun], start: academy, end: academy);
      expect(order, [0, 1]);
    });

    test('이미 가장 짧은 순서면 그대로 둔다', () {
      final order = bestOrder([imhaeun, gangjian], start: carWest, end: academy);
      expect(order, [0, 1]);
    });

    test('정류장이 0개 또는 1개면 그대로', () {
      expect(bestOrder([], start: academy, end: academy), isEmpty);
      expect(bestOrder([gangjian], start: carWest, end: academy), [0]);
    });

    test('일직선 위의 정류장은 출발 위치에서 가까운 쪽부터 간다', () {
      const a = GeoPoint(37.5000, 127.0);
      const b = GeoPoint(37.5100, 127.0);
      const c = GeoPoint(37.5200, 127.0);
      const end = GeoPoint(37.5300, 127.0);
      final order = bestOrder([c, a, b], start: const GeoPoint(37.4900, 127.0), end: end);
      expect(order, [1, 2, 0]); // a → b → c
    });

    test('순서를 바꾼 결과의 거리 합이 원래보다 짧다', () {
      final pts = [gangjian, imhaeun];
      final order = bestOrder(pts, start: carWest, end: academy);
      final before = pathLength(pts, start: carWest, end: academy);
      final after = pathLength([for (final i in order) pts[i]], start: carWest, end: academy);
      expect(after, lessThan(before));
    });
  });

  group('cheapestInsertIndex', () {
    test('차 바로 옆에 새 정류장이 생기면 맨 앞에 끼워 넣는다', () {
      final seq = [imhaeun, gangjian];
      const near = GeoPoint(37.8137, 127.0545); // 차(서쪽) 바로 옆
      expect(cheapestInsertIndex(seq, near, start: carWest, end: academy), 0);
    });

    test('유치원 바로 옆에 새 정류장이 생기면 맨 뒤쪽(유치원 앞)에 끼워 넣는다', () {
      final seq = [imhaeun, gangjian];
      const nearAcademy = GeoPoint(37.8098, 127.0707);
      expect(cheapestInsertIndex(seq, nearAcademy, start: carWest, end: academy), 2);
    });

    test('남은 정류장이 없으면 0번 자리', () {
      expect(cheapestInsertIndex([], gangjian, start: carWest, end: academy), 0);
    });
  });
}
