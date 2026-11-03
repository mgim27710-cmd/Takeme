import 'package:flutter/foundation.dart';
import '../driver/geo.dart';
import 'nav_map_view_mobile.dart' if (dart.library.html) 'nav_map_view_web.dart' as platform_impl;

/// 교통 상태 구간 (경로 좌표 인덱스 from~to)
class TrafficSegment {
  final int from;
  final int to;
  final int state; // 카카오 traffic_state: 0 정보없음, 1 정체, 2 지체, 3 서행, 4 원활
  const TrafficSegment(this.from, this.to, this.state);
  Map<String, dynamic> toJson() => {'from': from, 'to': to, 'state': state};
}

abstract class NavMapController {
  factory NavMapController() => platform_impl.createNavMapController();

  VoidCallback? onUserDrag;

  void setRoutes({
    List<GeoPoint>? primary,
    List<TrafficSegment>? traffic,
    List<GeoPoint>? alternate,
    required List<Map<String, dynamic>> stops,
    GeoPoint? academy,
    bool fit = true,
  });

  /// 내 위치 화살표 이동 (heading: 진행 방향, follow: 지도가 따라감, navigating: 주행 중 여부)
  void moveMe(GeoPoint p, {double? heading, bool follow = false, bool navigating = false});
  void centerOn(GeoPoint p, {int zoom = 16});
  void markStopPassed(int index);
  void fitAll();
  void setHeadingUp(bool enabled);
  void resetZoom();

  // Legacy/compatibility methods
  void setMyLocation(GeoPoint p);
  void moveBus(GeoPoint p, {bool follow = true});
  void hideBus();
  void setInteractive(bool interactive);
}
