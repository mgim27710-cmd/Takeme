import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_naver_map/flutter_naver_map.dart';
import 'package:latlong2/latlong.dart' hide Path;

import '../driver/geo.dart' show GeoPoint, distanceM;
import 'marker_layout.dart';
import 'nav_map_controller.dart';

/// Map Style Editor 사용자 스타일 ID (secrets.json 의 NAVER_MAP_STYLE_ID). 비어 있으면 기본 스타일.
const String naverMapStyleId = String.fromEnvironment('NAVER_MAP_STYLE_ID');

/// 야간 모드 (지금은 항상 꺼짐. 나중에 설정으로 켤 수 있도록 상수로 분리)
const bool _naverNightMode = false;

/// 네이버 지도 기반 내비게이션 지도 (flutter_naver_map).
/// NavMapController 의 기존 메서드/동작은 그대로 유지하고 지도 렌더링만 네이버 지도로 처리한다.
class NaverNavMapView extends StatefulWidget {
  final NavMapController controller;

  const NaverNavMapView({super.key, required this.controller});

  @override
  State<NaverNavMapView> createState() => _NaverNavMapViewState();
}

class _PathSpec {
  final String id;
  final List<LatLng> points;
  final Color color;
  final double width;
  final Color outlineColor;
  final double outlineWidth;
  final bool dashed;
  final bool chevron;
  const _PathSpec({
    required this.id,
    required this.points,
    required this.color,
    required this.width,
    this.outlineColor = Colors.transparent,
    this.outlineWidth = 0,
    this.dashed = false,
    this.chevron = false,
  });
}

class _NaverNavMapViewState extends State<NaverNavMapView> with SingleTickerProviderStateMixin {
  NaverMapController? _map;
  late final Ticker _ticker;
  Duration? _lastTick;

  double _animatedLat = 37.5665;
  double _animatedLng = 126.9780;
  double _animatedHeading = 0.0;
  double _animatedZoom = NavMapConfig.defaultNavZoom;
  double _animatedYRatio = 0.5;

  LatLng _targetPos = const LatLng(37.5665, 126.9780);
  double _targetHeading = 0.0;
  double _lastValidHeading = 0.0;
  double _targetZoom = NavMapConfig.defaultNavZoom;
  double _targetYRatio = 0.5;

  bool _isFollowing = false;
  bool _isNavigating = false;
  bool _headingUp = true;
  bool _hasInitialLocation = false;
  bool _isInitialFitDone = false;
  bool _isMapReady = false;

  bool _isSnappedToRoute = false;

  // 경로 점(LatLng)과 누적거리 캐시: 경로가 바뀔 때만 새로 만든다 (매 프레임 만들면 화면이 끊긴다)
  List<LatLng>? _routeCache;
  List<double> _routeCum = const [];
  Object? _routeSrc;

  // 차량 위치를 '경로를 따라 간 거리(m)'로 계산한다: GPS 사이에도 항상 도로선 위에서 부드럽게 움직인다
  double _sShown = 0.0; // 화면에 그리는 위치
  double _sBase = 0.0; // 마지막 GPS 가 알려준 위치
  double _speedBaseMps = 0.0;
  DateTime _sBaseTime = DateTime.fromMillisecondsSinceEpoch(0);
  bool _sValid = false;
  int _drawSeg = 0; // 지금 차량이 있는 경로 구간 번호 (경로선을 어디서부터 그릴지)
  double? _lastPosLat;
  double? _lastPosLng;

  DateTime? _lastGpsTime;
  double _correctionOffsetX = 0.0;
  double _correctionOffsetY = 0.0;
  double _correctionRemainingSec = 0.0;

  // 오버레이 상태
  final Map<String, NAddableOverlay> _overlays = {};
  final Map<String, NOverlayImage> _imageCache = {};
  NMarker? _meMarker;
  bool _syncing = false;
  bool _syncPending = false;
  DateTime _lastSync = DateTime.fromMillisecondsSinceEpoch(0);
  bool _cameraBusy = false;

  NavMapControllerImpl get _impl => widget.controller as NavMapControllerImpl;

  @override
  void initState() {
    super.initState();
    _bindController();
    _ticker = createTicker(_onTick);
    _ticker.start();
  }

  void _bindController() {
    _impl.addListener(_onControllerUpdated);
    _impl.onCenterOn = (p, zoom) {
      _isFollowing = false;
      _targetYRatio = 0.5;
      _animatedYRatio = 0.5;
      _targetZoom = zoom.toDouble();
      _animatedZoom = zoom.toDouble();
      _animatedLat = p.lat;
      _animatedLng = p.lng;
      _moveCamera(LatLng(p.lat, p.lng), _animatedZoom, _headingUp ? null : 0.0, 0.5);
    };
    _impl.onFitAll = _fitAllBounds;
    _impl.onResetZoom = () {
      _isFollowing = false;
      _targetYRatio = 0.5;
      _headingUp = false;
      _moveCamera(null, null, 0.0, 0.5);
    };
    _onControllerUpdated();
  }

  @override
  void didUpdateWidget(covariant NaverNavMapView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      (oldWidget.controller as NavMapControllerImpl).removeListener(_onControllerUpdated);
      _bindController();
    }
  }

  @override
  void dispose() {
    _ticker.dispose();
    _impl.removeListener(_onControllerUpdated);
    _impl.onCenterOn = null;
    _impl.onFitAll = null;
    _impl.onResetZoom = null;
    super.dispose();
  }

  bool get _canUseMap => _isMapReady && mounted && _map != null;

  void _onControllerUpdated() {
    final curPos = _impl.currentPosition;
    final heading = _impl.currentHeading;
    final speed = _impl.currentSpeedKmh ?? 0.0;
    final follow = _impl.isFollowing;
    final navigating = _impl.isNavigating;
    final headingUp = _impl.headingUp;

    _isFollowing = follow;
    _isNavigating = navigating;
    _headingUp = headingUp;

    if (curPos != null) {
      final rawLatLng = LatLng(curPos.lat, curPos.lng);
      final primary = _getPrimaryRouteLatLngs();
      final (snapped, snapSeg, snapT, isSnapped) = navigating
          ? _snapToRouteDetail(rawLatLng, primary)
          : (rawLatLng, 0, 0.0, false);
      _targetPos = snapped;
      _isSnappedToRoute = isSnapped;

      // 새 GPS 위치가 실제로 들어왔을 때만 '경로 위 거리' 기준값을 갱신한다
      final posChanged = _lastPosLat != curPos.lat || _lastPosLng != curPos.lng;
      if (!(navigating && isSnapped)) {
        _sValid = false;
      } else if (primary != null && _routeCum.length == primary.length && primary.length >= 2 && (posChanged || !_sValid)) {
        final i = snapSeg.clamp(0, primary.length - 2);
        _sBase = _routeCum[i] + snapT * (_routeCum[i + 1] - _routeCum[i]);
        _speedBaseMps = speed / 3.6;
        _sBaseTime = DateTime.now();
        if (!_sValid || (_sBase - _sShown).abs() > 40.0) _sShown = _sBase; // 처음이거나 크게 어긋나면 바로 맞춤
        _sValid = true;
      }
      _lastPosLat = curPos.lat;
      _lastPosLng = curPos.lng;

      if (!_hasInitialLocation) {
        _hasInitialLocation = true;
        _animatedLat = snapped.latitude;
        _animatedLng = snapped.longitude;
        _correctionOffsetX = 0.0;
        _correctionOffsetY = 0.0;
        _correctionRemainingSec = 0.0;
      } else if (navigating) {
        _correctionOffsetY = snapped.latitude - _animatedLat;
        _correctionOffsetX = snapped.longitude - _animatedLng;
        _correctionRemainingSec = NavMapConfig.reconciliationSeconds;
      }
      _lastGpsTime = DateTime.now();

      if (heading != null && !heading.isNaN) {
        if (speed >= NavMapConfig.stationarySpeedThreshold) {
          _lastValidHeading = heading;
          _targetHeading = _shortestAngle(_animatedHeading, heading);
        } else {
          _targetHeading = _shortestAngle(_animatedHeading, _lastValidHeading);
        }
      }

      if (navigating && follow && headingUp) {
        if (speed < NavMapConfig.speedLowThreshold) {
          _targetZoom = NavMapConfig.zoomLowSpeed;
          _targetYRatio = NavMapConfig.arrowRatioLowSpeed;
        } else if (speed < NavMapConfig.speedHighThreshold) {
          _targetZoom = NavMapConfig.zoomMidSpeed;
          _targetYRatio = NavMapConfig.arrowRatioMidSpeed;
        } else {
          _targetZoom = NavMapConfig.zoomHighSpeed;
          _targetYRatio = NavMapConfig.arrowRatioHighSpeed;
        }
      } else {
        _targetYRatio = 0.5;
      }
    }

    if (_impl.shouldFitOnRoutes && !_isInitialFitDone && !_isNavigating && _canUseMap) {
      _fitAllBounds();
      _isInitialFitDone = true;
    }

    _requestSync();
  }

  void _onTick(Duration elapsed) {
    if (!_canUseMap) return;
    if (_lastTick == null) {
      _lastTick = elapsed;
      return;
    }
    final dt = (elapsed - _lastTick!).inMicroseconds / 1000000.0;
    _lastTick = elapsed;
    final clampedDt = dt.clamp(0.001, 0.1);

    if (_isNavigating) {
      // 차량 위치·방향 움직임은 지도를 손으로 움직이는 중에도 계속한다 (따라가기 여부와 상관없이).
      final speedMps = ((_impl.currentSpeedKmh ?? 0.0) / 3.6);
      final sinceGps = _lastGpsTime != null
          ? (DateTime.now().difference(_lastGpsTime!).inMilliseconds / 1000.0)
          : 0.0;
      final route = _getPrimaryRouteLatLngs();

      if (_isSnappedToRoute && _sValid && route != null && route.length >= 2 && _routeCum.length == route.length) {
        // GPS 사이에는 속도만큼 앞으로 간 위치를 목표로 삼고, 화면 위치는 그쪽으로 부드럽게 따라간다.
        // 항상 도로선(경로) 위의 점이라 커브에서 도로를 벗어나지 않고, 새 GPS 가 와도 위치가 튀지 않는다.
        final ahead = math.min(DateTime.now().difference(_sBaseTime).inMilliseconds / 1000.0, NavMapConfig.predictionMaxSeconds);
        final sTarget = (_sBase + _speedBaseMps * ahead).clamp(0.0, _routeCum.last);
        if (sTarget >= _sShown) {
          final dtReal = dt.clamp(0.001, 0.25);
          _sShown += (sTarget - _sShown) * (1.0 - math.exp(-dtReal / 0.35));
        }
        final (p, seg, roadBearing) = _pointAtS(route, _sShown);
        _animatedLat = p.latitude;
        _animatedLng = p.longitude;
        _drawSeg = seg;
        _correctionRemainingSec = 0.0;
        // 진행 방향도 도로선의 방향을 따라 연속으로 바뀌게 한다 (GPS 방향은 1초마다 계단식이라 지도가 1초마다 돈다)
        if (speedMps >= NavMapConfig.stationarySpeedThreshold) {
          _lastValidHeading = roadBearing;
        }
        _targetHeading = _shortestAngle(_animatedHeading, _lastValidHeading);
      } else {
        if (_isSnappedToRoute && sinceGps <= NavMapConfig.predictionMaxSeconds && speedMps > 0.5) {
          _advanceAlongRoute(speedMps * clampedDt, route);
        }

        if (_correctionRemainingSec > 0.001) {
          final stepFactor = (clampedDt / _correctionRemainingSec).clamp(0.0, 1.0);
          _animatedLat += _correctionOffsetY * stepFactor;
          _animatedLng += _correctionOffsetX * stepFactor;
          _correctionOffsetY -= _correctionOffsetY * stepFactor;
          _correctionOffsetX -= _correctionOffsetX * stepFactor;
          _correctionRemainingSec -= clampedDt;
        } else if (!_isSnappedToRoute) {
          final posFactor = (clampedDt / 0.3).clamp(0.0, 1.0);
          _animatedLat += (_targetPos.latitude - _animatedLat) * posFactor;
          _animatedLng += (_targetPos.longitude - _animatedLng) * posFactor;
        }
      }

      _animatedHeading += (_targetHeading - _animatedHeading) * (clampedDt / NavMapConfig.headingLerpDuration).clamp(0.0, 1.0);
      // 화면(카메라)은 따라가기가 켜져 있을 때만 차량을 따라 움직인다.
      // 사용자가 지도를 움직이는 중에는 화면을 그대로 두고, 현위치 버튼을 누르면 다시 따라간다.
      if (_isFollowing) {
        _animatedZoom += (_targetZoom - _animatedZoom) * (clampedDt / NavMapConfig.zoomLerpDuration).clamp(0.0, 1.0);
        _animatedYRatio += (_targetYRatio - _animatedYRatio) * (clampedDt / NavMapConfig.ratioLerpDuration).clamp(0.0, 1.0);
        _applyCameraUpdate();
      }
    } else if (_isFollowing) {
      final posFactor = (clampedDt / 0.3).clamp(0.0, 1.0);
      _animatedLat += (_targetPos.latitude - _animatedLat) * posFactor;
      _animatedLng += (_targetPos.longitude - _animatedLng) * posFactor;
      _animatedYRatio = 0.5;
      _moveCamera(LatLng(_animatedLat, _animatedLng), _animatedZoom, null, 0.5);
    }

    _updateMeMarker();
    // 경로선/마커는 부하를 줄이기 위해 약 4Hz 로만 갱신
    if (_isNavigating && DateTime.now().difference(_lastSync).inMilliseconds > 500) {
      _requestSync();
    }
  }

  void _applyCameraUpdate() {
    if (!_canUseMap) return;
    if (_headingUp) {
      _moveCamera(LatLng(_animatedLat, _animatedLng), _animatedZoom, _animatedHeading, _animatedYRatio);
    } else {
      _moveCamera(LatLng(_animatedLat, _animatedLng), _animatedZoom, 0.0, 0.5);
    }
  }

  // 마지막으로 지도에 실제 적용한 확대·회전·기준 높이
  double? _lastCamZoom;
  double? _lastCamBearing;
  double? _lastCamYRatio;

  static double _angleGap(double a, double b) => (((a - b + 540.0) % 360.0) - 180.0).abs();

  /// 카메라 이동 (애니메이션 없음, 이전 호출이 끝나기 전에는 건너뜀)
  /// 확대·회전·기준 높이가 아주 조금(0.02배율·1도·0.5%) 바뀐 건 이전 값을 그대로 쓴다.
  /// 위치는 매번 움직이지만, 확대·회전을 매 프레임 미세하게 바꾸면 지도 글자가 계속 깜빡거린다.
  Future<void> _moveCamera(LatLng? target, double? zoom, double? bearing, double yRatio) async {
    final map = _map;
    if (!_canUseMap || map == null || _cameraBusy) return;
    var z = zoom;
    var b = bearing;
    var r = yRatio;
    if (z != null && _lastCamZoom != null && (z - _lastCamZoom!).abs() < 0.02) z = _lastCamZoom;
    if (b != null && _lastCamBearing != null && _angleGap(b, _lastCamBearing!) < 1.0) b = _lastCamBearing;
    if (_lastCamYRatio != null && (r - _lastCamYRatio!).abs() < 0.005) r = _lastCamYRatio!;
    _cameraBusy = true;
    try {
      final update = NCameraUpdate.withParams(
        target: target == null ? null : NLatLng(target.latitude, target.longitude),
        zoom: z,
        bearing: b,
        tilt: 0,
      )
        ..setPivot(NPoint(0.5, r))
        ..setAnimation(animation: NCameraAnimation.none, duration: Duration.zero);
      await map.updateCamera(update);
      _lastCamZoom = z;
      _lastCamBearing = b;
      _lastCamYRatio = r;
    } catch (e) {
      debugPrint('[nav_map_naver] moveCamera error: $e');
    } finally {
      _cameraBusy = false;
    }
  }

  Future<void> _fitAllBounds() async {
    final map = _map;
    if (!_canUseMap || map == null) return;
    final pts = <NLatLng>[];
    void add(double lat, double lng) => pts.add(NLatLng(lat, lng));

    for (final p in _impl.primaryRoute ?? const []) {
      add(p.lat, p.lng);
    }
    for (final p in _impl.alternateRoute ?? const []) {
      add(p.lat, p.lng);
    }
    for (final s in _impl.stops) {
      final lat = s['lat'] as num?;
      final lng = s['lng'] as num?;
      if (lat != null && lng != null) add(lat.toDouble(), lng.toDouble());
    }
    if (_impl.academy != null) add(_impl.academy!.lat, _impl.academy!.lng);
    if (_impl.currentPosition != null) add(_impl.currentPosition!.lat, _impl.currentPosition!.lng);
    if (pts.isEmpty) return;

    try {
      await map.updateCamera(
        NCameraUpdate.withParams(bearing: 0, tilt: 0)
          ..setPivot(NPoint.relativeCenter)
          ..setAnimation(animation: NCameraAnimation.none, duration: Duration.zero),
      );
      final bounds = NLatLngBounds.from(pts);
      await map.updateCamera(
        NCameraUpdate.fitBounds(bounds, padding: const EdgeInsets.all(50))
          ..setAnimation(animation: NCameraAnimation.none, duration: Duration.zero),
      );
      final cam = await map.getCameraPosition();
      if (cam.zoom > 16.0) {
        await map.updateCamera(
          NCameraUpdate.withParams(zoom: 16.0)
            ..setAnimation(animation: NCameraAnimation.none, duration: Duration.zero),
        );
      }
    } catch (e) {
      debugPrint('[nav_map_naver] fitAllBounds error: $e');
    }
  }

  List<LatLng>? _getPrimaryRouteLatLngs() {
    final src = _impl.primaryRoute;
    if (src == null) {
      _routeCache = null;
      _routeSrc = null;
      _routeCum = const [];
      _sValid = false;
      return null;
    }
    if (!identical(src, _routeSrc) || _routeCache == null || _routeCache!.length != src.length) {
      // 경로가 새로 바뀐 때만 변환한다 (예전에는 매 프레임 수천 개를 새로 만들어 화면이 끊겼다)
      _routeSrc = src;
      final list = src.map((e) => LatLng(e.lat, e.lng)).toList();
      _routeCache = list;
      _routeCum = _cumulativeMeters(list);
      _sValid = false;
      _drawSeg = 0;
    }
    return _routeCache;
  }

  static List<double> _cumulativeMeters(List<LatLng> pts) {
    const rad = math.pi / 180.0;
    const latScale = 111132.954;
    final cum = List<double>.filled(pts.length, 0.0);
    for (var i = 1; i < pts.length; i++) {
      final lngScale = 111412.84 * math.cos(pts[i - 1].latitude * rad);
      final dx = (pts[i].longitude - pts[i - 1].longitude) * lngScale;
      final dy = (pts[i].latitude - pts[i - 1].latitude) * latScale;
      cum[i] = cum[i - 1] + math.sqrt(dx * dx + dy * dy);
    }
    return cum;
  }

  /// 경로를 따라 s 미터 간 위치, 그 위치의 구간 번호, 앞쪽 약 15m 도로 방향
  (LatLng, int, double) _pointAtS(List<LatLng> route, double s) {
    final cum = _routeCum;
    final last = route.length - 2;
    var lo = 0;
    var hi = last;
    while (lo < hi) {
      final mid = (lo + hi + 1) >> 1;
      if (cum[mid] <= s) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    final a = route[lo];
    final b = route[lo + 1];
    final segLen = cum[lo + 1] - cum[lo];
    final t = segLen < 1e-6 ? 0.0 : ((s - cum[lo]) / segLen).clamp(0.0, 1.0);
    final p = LatLng(a.latitude + (b.latitude - a.latitude) * t, a.longitude + (b.longitude - a.longitude) * t);
    // 앞쪽 15m 지점을 찾아 방향을 구한다 (꺾이는 곳에서 방향이 부드럽게 바뀌도록)
    var j = lo + 1;
    while (j < route.length - 1 && cum[j] < s + 15.0) {
      j++;
    }
    final ahead = route[j];
    final bearing = (ahead.latitude == p.latitude && ahead.longitude == p.longitude)
        ? _bearingBetween(a, b)
        : _bearingBetween(p, ahead);
    return (p, lo, bearing);
  }

  /// 경로선을 어디서부터 그릴지: 차량이 있는 구간 번호
  int _drawSegIndex(int routeLen) {
    final i = (_isSnappedToRoute && _sValid) ? _drawSeg : _impl.routeProgressIndex;
    return i.clamp(0, routeLen - 1);
  }

  List<LatLng>? _getAlternateRouteLatLngs() {
    if (_impl.alternateRoute == null) return null;
    return _impl.alternateRoute!.map((e) => LatLng(e.lat, e.lng)).toList();
  }

  static double _shortestAngle(double from, double to) {
    final diff = ((to - from + 540) % 360) - 180;
    return from + diff;
  }

  static double _angleDiff(double a, double b) {
    final d = ((a - b).abs()) % 360.0;
    return d > 180.0 ? 360.0 - d : d;
  }

  static double _bearingBetween(LatLng a, LatLng b) {
    const rad = math.pi / 180.0;
    final lat1 = a.latitude * rad;
    final lat2 = b.latitude * rad;
    final dLng = (b.longitude - a.longitude) * rad;
    final y = math.sin(dLng) * math.cos(lat2);
    final x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dLng);
    return (math.atan2(y, x) * 180.0 / math.pi + 360.0) % 360.0;
  }

  static double _distanceMeters(LatLng a, LatLng b) {
    const rad = math.pi / 180.0;
    const r = 6371000.0;
    final dLat = (b.latitude - a.latitude) * rad;
    final dLng = (b.longitude - a.longitude) * rad;
    final sinLat = math.sin(dLat / 2);
    final sinLng = math.sin(dLng / 2);
    final h = sinLat * sinLat + math.cos(a.latitude * rad) * math.cos(b.latitude * rad) * sinLng * sinLng;
    return 2 * r * math.asin(math.min(1.0, math.sqrt(h)));
  }

  static LatLng _offsetPointRight(LatLng pt, double bearingDeg, double offsetMeters) {
    const rad = math.pi / 180.0;
    const latScale = 111132.954;
    final lngScale = 111412.84 * math.cos(pt.latitude * rad);
    final rightAngle = (bearingDeg + 90.0) * rad;
    final dy = math.cos(rightAngle) * offsetMeters;
    final dx = math.sin(rightAngle) * offsetMeters;
    return LatLng(pt.latitude + dy / latScale, pt.longitude + dx / lngScale);
  }

  static double _pointToSegDist(LatLng p, LatLng a, LatLng b) {
    const rad = math.pi / 180.0;
    const latScale = 111132.954;
    final lngScale = 111412.84 * math.cos(p.latitude * rad);
    final px = p.longitude * lngScale;
    final py = p.latitude * latScale;
    final ax = a.longitude * lngScale;
    final ay = a.latitude * latScale;
    final bx = b.longitude * lngScale;
    final by = b.latitude * latScale;
    final dx = bx - ax;
    final dy = by - ay;
    final lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-6) return _distanceMeters(p, a);
    final t = (((px - ax) * dx + (py - ay) * dy) / lenSq).clamp(0.0, 1.0);
    final cx = ax + t * dx;
    final cy = ay + t * dy;
    return math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
  }

  List<LatLng> _getActiveRoutePoints() {
    final pri = _getPrimaryRouteLatLngs();
    if (pri == null || pri.isEmpty) return const [];
    if (_isNavigating) {
      final segIdx = _drawSegIndex(pri.length);
      // 차량이 경로(도로) 위에 있을 때만 현재 위치에서 경로를 이어 그린다.
      // 도로에서 벗어나 있으면 '차량 → 경로' 직선을 그리지 않고 도로 경로만 보여준다.
      final active = <LatLng>[];
      if (_isSnappedToRoute) {
        active.add(LatLng(_animatedLat, _animatedLng));
        if (segIdx + 1 < pri.length) active.addAll(pri.sublist(segIdx + 1));
      } else {
        active.addAll(pri.sublist(segIdx));
      }
      return active;
    }
    return pri;
  }

  /// 경로선 상에서 moveMeters 만큼 전진하여 _animatedLat, _animatedLng를 갱신
  void _advanceAlongRoute(double moveMeters, List<LatLng>? primary) {
    if (primary == null || primary.length < 2) return;
    final segIdx = _impl.routeProgressIndex.clamp(0, primary.length - 2);
    final a = primary[segIdx];
    final b = primary[segIdx + 1];

    const rad = math.pi / 180.0;
    const latScale = 111132.954;
    final lngScale = 111412.84 * math.cos(_animatedLat * rad);

    final dxMeters = (b.longitude - a.longitude) * lngScale;
    final dyMeters = (b.latitude - a.latitude) * latScale;
    final segLen = math.sqrt(dxMeters * dxMeters + dyMeters * dyMeters);

    if (segLen < 1e-3) return;

    final unitX = dxMeters / segLen;
    final unitY = dyMeters / segLen;

    final deltaLng = (unitX * moveMeters) / lngScale;
    final deltaLat = (unitY * moveMeters) / latScale;

    _animatedLat += deltaLat;
    _animatedLng += deltaLng;
  }

  /// 경로선 30m 이내 스냅 상세 계산 (투영점, 세그먼트 인덱스, 비율, 스냅 여부 산출)
  /// 1단계 개선: 현재 진행 위치(_impl.routeProgressIndex) 기준 앞쪽 300m 이내의 구간만 후보로 하며,
  /// 속도 3m/s(약 11km/h) 이상 주행 시 진행 방향과 60도 초과 차이나는 반대 방향/이탈 구간은 스냅하지 않는다.
  (LatLng point, int segIndex, double t, bool isSnapped) _snapToRouteDetail(
    LatLng rawPos,
    List<LatLng>? primaryRoute,
  ) {
    if (primaryRoute == null || primaryRoute.length < 2) {
      return (rawPos, 0, 0.0, false);
    }

    const rad = math.pi / 180.0;
    const latScale = 111132.954;
    final lngScale = 111412.84 * math.cos(rawPos.latitude * rad);

    final px = rawPos.longitude * lngScale;
    final py = rawPos.latitude * latScale;

    const maxDist = NavMapConfig.snapRouteDistanceMeters;
    double bestDistSq = maxDist * maxDist;
    LatLng? bestPoint;
    int bestSeg = 0;
    double bestT = 0.0;

    final startIdx = _impl.routeProgressIndex.clamp(0, primaryRoute.length - 2);
    final speedMps = (_impl.currentSpeedKmh ?? 0.0) / 3.6;
    final carHeading = _impl.currentHeading;

    double cumDist = 0.0;
    for (int i = startIdx; i < primaryRoute.length - 1; i++) {
      final a = primaryRoute[i];
      final b = primaryRoute[i + 1];

      final ax = a.longitude * lngScale;
      final ay = a.latitude * latScale;
      final bx = b.longitude * lngScale;
      final by = b.latitude * latScale;

      final dx = bx - ax;
      final dy = by - ay;
      final segLenSq = dx * dx + dy * dy;
      final segLen = math.sqrt(segLenSq);
      if (segLenSq < 1e-6) continue;

      if (i > startIdx) {
        cumDist += segLen;
        if (cumDist > 300.0 && (i - startIdx) >= 2) {
          break; // 앞쪽 300m 이내만 탐색
        }
      }

      // 속도 3m/s 이상이고 방향값이 있으면 60도 초과 차이나는 반대 구간/역방향 제외
      if (speedMps >= 3.0 && carHeading != null && !carHeading.isNaN) {
        final segBearing = (math.atan2(dx, dy) * 180.0 / math.pi + 360.0) % 360.0;
        final angleDiff = ((carHeading - segBearing).abs()) % 360.0;
        final normalizedDiff = angleDiff > 180.0 ? 360.0 - angleDiff : angleDiff;
        if (normalizedDiff > 60.0) {
          continue;
        }
      }

      final t = ((px - ax) * dx + (py - ay) * dy) / segLenSq;
      final clampedT = t.clamp(0.0, 1.0);

      final cx = ax + clampedT * dx;
      final cy = ay + clampedT * dy;

      final distSq = (px - cx) * (px - cx) + (py - cy) * (py - cy);
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestSeg = i;
        bestT = clampedT;
        bestPoint = LatLng(
          a.latitude + clampedT * (b.latitude - a.latitude),
          a.longitude + clampedT * (b.longitude - a.longitude),
        );
      }
    }

    if (bestPoint != null) {
      return (bestPoint, bestSeg, bestT, true);
    }
    return (rawPos, startIdx, 0.0, false);
  }

  // ───────────────────────── 경로선 구성 ─────────────────────────

  List<_PathSpec> _buildPathSpecs() {
    final specs = <_PathSpec>[];

    final alt = _getAlternateRouteLatLngs();
    if (alt != null && alt.length > 1) {
      specs.add(_PathSpec(
        id: 'alt',
        points: alt,
        color: const Color(0xFF64748B).withValues(alpha: 0.7),
        width: 5,
        dashed: true,
      ));
    }

    final pri = _getPrimaryRouteLatLngs();
    if (pri == null || pri.length < 2) return specs;

    final activePoints = _getActiveRoutePoints();
    final int currentSegIdx = _isNavigating ? _drawSegIndex(pri.length) : 0;

    // 같은 도로를 반대 방향으로 다시 지나는 구간(유턴/복귀) 검출
    final isOverlap = List<bool>.filled(math.max(0, activePoints.length - 1), false);
    if (!_isNavigating && activePoints.length >= 4) {
      for (int j = 2; j < activePoints.length - 1; j++) {
        final bj = _bearingBetween(activePoints[j], activePoints[j + 1]);
        final midJ = LatLng(
          (activePoints[j].latitude + activePoints[j + 1].latitude) / 2,
          (activePoints[j].longitude + activePoints[j + 1].longitude) / 2,
        );
        for (int i = 0; i < j - 1; i++) {
          final bi = _bearingBetween(activePoints[i], activePoints[i + 1]);
          if (_angleDiff(bi, bj) >= 135.0 && _pointToSegDist(midJ, activePoints[i], activePoints[i + 1]) <= 18.0) {
            isOverlap[j] = true;
            break;
          }
        }
      }
    }

    final returnRuns = <List<LatLng>>[];
    List<LatLng>? curRun;
    for (int k = 0; k < activePoints.length - 1; k++) {
      if (isOverlap[k]) {
        final bk = _bearingBetween(activePoints[k], activePoints[k + 1]);
        final p1 = _offsetPointRight(activePoints[k], bk, 3.5);
        final p2 = _offsetPointRight(activePoints[k + 1], bk, 3.5);
        if (curRun == null) {
          curRun = [p1, p2];
        } else {
          curRun.add(p2);
        }
      } else if (curRun != null) {
        returnRuns.add(curRun);
        curRun = null;
      }
    }
    if (curRun != null) returnRuns.add(curRun);

    for (int r = 0; r < returnRuns.length; r++) {
      if (returnRuns[r].length > 1) {
        specs.add(_PathSpec(
          id: 'ret_$r',
          points: returnRuns[r],
          color: const Color(0xFF86EFAC).withValues(alpha: 0.85),
          width: 6,
        ));
      }
    }

    // 경로선 테두리(진한 윤곽)는 각 경로선의 outline 으로 유지한다
    const outlineColor = Color(0xFF14532D);
    const lineWidth = 9.0;
    const outlineWidth = 2.0;

    // 가고 있는 구간(차 → 다음 정류장)만 진하게 + 방향 화살표로 맨 위에 그리고,
    // 그 뒤에 갈 길은 옅은 초록으로 아래에 그린다. (같은 길을 갔다 돌아올 때 지금 가는 방향이 위에 보인다)
    int? legEnd;
    if (_isNavigating) {
      final next = _nextStopPoint();
      if (next != null) {
        legEnd = nearestPathIndexFrom(
          [for (final p in pri) GeoPoint(p.latitude, p.longitude)],
          currentSegIdx,
          next,
        );
      }
    }
    final laterSpecs = <_PathSpec>[];
    final currentSpecs = <_PathSpec>[];
    void addLater(String id, List<LatLng> pts) {
      if (pts.length > 1) {
        laterSpecs.add(_PathSpec(
          id: id,
          points: pts,
          color: const Color(0xFF86EFAC),
          width: 7,
          outlineColor: const Color(0xFFBBF7D0),
          outlineWidth: 1,
        ));
      }
    }

    final traffic = _impl.trafficSegments;
    if (traffic != null && traffic.isNotEmpty) {
      for (int t = 0; t < traffic.length; t++) {
        final seg = traffic[t];
        if (_isNavigating && seg.to < currentSegIdx) continue;
        final isActiveSeg = _isNavigating && seg.from <= currentSegIdx && currentSegIdx <= seg.to;
        final a = isActiveSeg ? currentSegIdx : seg.from.clamp(0, pri.length - 1);
        final b = seg.to.clamp(0, pri.length - 1);
        if (b < a) continue;

        // 점 번호 x~y 의 경로 점. fromCar 이면 첫 점을 차 위치로 (도로 위에 있을 때만, 아니면 도로 경로 점)
        List<LatLng> pointsFor(int x, int y, {bool fromCar = false}) {
          if (fromCar) {
            final first = _isSnappedToRoute ? LatLng(_animatedLat, _animatedLng) : pri[x.clamp(0, pri.length - 1)];
            return [first, if (x + 1 <= y) ...pri.sublist(x + 1, y + 1)];
          }
          return y >= x ? pri.sublist(x, y + 1) : const <LatLng>[];
        }

        final split = legEnd == null ? RangeSplit((a, b), null) : splitRangeAt(a, b, legEnd);
        final cur = split.current;
        if (cur != null) {
          final pts = pointsFor(cur.$1, cur.$2, fromCar: isActiveSeg && cur.$1 == currentSegIdx);
          if (pts.length > 1) {
            currentSpecs.add(_PathSpec(
              id: 'traffic_$t',
              points: pts,
              color: _trafficColor(seg.state),
              width: lineWidth,
              outlineColor: outlineColor,
              outlineWidth: outlineWidth,
              chevron: true,
            ));
          }
        }
        final lat = split.later;
        if (lat != null) {
          addLater('later_$t', pointsFor(lat.$1, lat.$2, fromCar: isActiveSeg && lat.$1 == currentSegIdx));
        }
      }
    } else if (activePoints.length > 1) {
      final lastIdx = activePoints.length - 1;
      final k = legEnd == null ? null : (legEnd - currentSegIdx).clamp(0, lastIdx);
      final split = k == null ? RangeSplit((0, lastIdx), null) : splitRangeAt(0, lastIdx, k);
      final cur = split.current;
      if (cur != null && cur.$2 > cur.$1) {
        currentSpecs.add(_PathSpec(
          id: 'main',
          points: activePoints.sublist(cur.$1, cur.$2 + 1),
          color: const Color(0xFF16A34A),
          width: lineWidth,
          outlineColor: outlineColor,
          outlineWidth: outlineWidth,
          chevron: true,
        ));
      }
      final lat = split.later;
      if (lat != null) addLater('later_main', activePoints.sublist(lat.$1, lat.$2 + 1));
    }
    specs.addAll(laterSpecs);
    specs.addAll(currentSpecs);
    return specs;
  }

  /// 아직 안 지난 첫 정류장의 좌표 (없으면 null = 마지막 구간)
  GeoPoint? _nextStopPoint() {
    for (int i = 0; i < _impl.stops.length; i++) {
      final s = _impl.stops[i];
      if (_impl.passedStopIndices.contains(i) || s['passed'] == true) continue;
      final lat = s['lat'] as num?;
      final lng = s['lng'] as num?;
      if (lat == null || lng == null) continue;
      return GeoPoint(lat.toDouble(), lng.toDouble());
    }
    return null;
  }

  Color _trafficColor(int state) {
    if (state == 1 || state == 6) return const Color(0xFFEF4444);
    if (state == 2 || state == 3) return const Color(0xFFF59E0B);
    return const Color(0xFF16A34A);
  }

  // ───────────────────────── 오버레이 동기화 ─────────────────────────

  Future<NOverlayImage> _image(String key, Widget widget, Size size) async {
    final cached = _imageCache[key];
    if (cached != null) return cached;
    final img = await NOverlayImage.fromWidget(
      widget: Directionality(textDirection: TextDirection.ltr, child: widget),
      size: size,
      context: context,
    );
    _imageCache[key] = img;
    return img;
  }

  void _requestSync() {
    if (!_canUseMap) return;
    if (_syncing) {
      _syncPending = true;
      return;
    }
    _syncOverlays();
  }

  final Map<String, String> _overlayKeys = {};

  Future<void> _syncOverlays() async {
    final map = _map;
    if (!_canUseMap || map == null) return;
    _syncing = true;
    _lastSync = DateTime.now();
    try {
      final chevron = await _image(
        'chevron',
        const _RouteChevronWidget(bearingDeg: 0),
        const Size(16, 16),
      );
      if (!_canUseMap) return;

      final wanted = <String>{};
      int order = 0;

      // 경로선
      for (final spec in _buildPathSpecs()) {
        wanted.add(spec.id);
        final coords = spec.points.map((p) => NLatLng(p.latitude, p.longitude)).toList();
        final key = '${spec.points.length}|${spec.points.first.latitude}|${spec.points.first.longitude}|'
            '${spec.points.last.latitude}|${spec.points.last.longitude}|${spec.color.toARGB32()}';
        final existing = _overlays[spec.id];
        if (existing == null) {
          final NAddableOverlay ov;
          if (spec.dashed) {
            ov = NPolylineOverlay(
              id: spec.id,
              coords: coords,
              color: spec.color,
              width: spec.width,
              lineCap: NLineCap.round,
              lineJoin: NLineJoin.round,
              pattern: const [8, 10],
            );
          } else {
            ov = NPathOverlay(
              id: spec.id,
              coords: coords,
              color: spec.color,
              width: spec.width,
              outlineColor: spec.outlineColor,
              outlineWidth: spec.outlineWidth,
              patternImage: spec.chevron ? chevron : null,
              patternInterval: 60,
            );
          }
          ov.setGlobalZIndex(-50000 + order);
          _overlays[spec.id] = ov;
          _overlayKeys[spec.id] = key;
          await map.addOverlay(ov);
        } else if (_overlayKeys[spec.id] != key || _isNavigating) {
          if (existing is NPathOverlay) {
            existing.setCoords(coords);
            existing.setColor(spec.color);
          } else if (existing is NPolylineOverlay) {
            existing.setCoords(coords);
            existing.setColor(spec.color);
          }
          _overlayKeys[spec.id] = key;
        }
        order++;
      }

      // 유치원 가까이(40m)의 정류장은 번호가 이름표에 가려지므로 따로 찍지 않고 이름표 옆 번호표로 묶는다
      final nearAcademy = <int>{};
      final academyPt = _impl.academy;
      if (academyPt != null) {
        nearAcademy.addAll(stopsNearPoint(
          [
            for (final s in _impl.stops)
              (s['lat'] is num && s['lng'] is num)
                  ? GeoPoint((s['lat'] as num).toDouble(), (s['lng'] as num).toDouble())
                  : null,
          ],
          academyPt,
        ));
      }

      // 정류장 마커
      for (int i = 0; i < _impl.stops.length; i++) {
        final s = _impl.stops[i];
        final lat = s['lat'] as num?;
        final lng = s['lng'] as num?;
        if (lat == null || lng == null) continue;
        final isPassed = _impl.passedStopIndices.contains(i) || s['passed'] == true;
        final isTest = s['test'] == true;
        if (nearAcademy.contains(i)) continue;
        final id = 'stop_$i';
        wanted.add(id);
        final imgKey = 'stop_${i}_${isPassed}_$isTest';
        final icon = await _image(
          imgKey,
          _StopMarkerWidget(index: i, isPassed: isPassed, isTest: isTest),
          const Size(28, 28),
        );
        if (!_canUseMap) return;
        final existing = _overlays[id];
        if (existing == null) {
          final m = NMarker(
            id: id,
            position: NLatLng(lat.toDouble(), lng.toDouble()),
            icon: icon,
            anchor: NPoint.relativeCenter,
          );
          m.setGlobalZIndex(200000);
          _overlays[id] = m;
          _overlayKeys[id] = imgKey;
          await map.addOverlay(m);
        } else if (_overlayKeys[id] != imgKey && existing is NMarker) {
          existing.setIcon(icon);
          _overlayKeys[id] = imgKey;
        }
      }

      // 유치원 마커: 이름표는 점 위쪽에 두고(핀 모양) 정류장 번호가 가려지지 않게 한다. 근처 정류장은 이름표 옆 번호표로 묶는다
      final academy = _impl.academy;
      if (academy != null) {
        wanted.add('academy');
        final badges = <(int, bool)>[
          for (final i in (nearAcademy.toList()..sort()))
            (i, _impl.passedStopIndices.contains(i) || _impl.stops[i]['passed'] == true),
        ];
        final badgeKey = badges.map((b) => '${b.$1}${b.$2 ? "p" : ""}').join(',');
        final width = 64.0 + 24.0 * badges.length;
        final icon = await _image('academy_$badgeKey', _AcademyMarkerWidget(badges: badges), Size(width, 32));
        if (!_canUseMap) return;
        final pos = NLatLng(academy.lat, academy.lng);
        final anchor = NPoint(32 / width, 1.55); // 이름표 아랫면이 점보다 17px 위에 오게 (정류장 번호 원의 반지름 14px)
        final existing = _overlays['academy'];
        if (existing == null) {
          final m = NMarker(id: 'academy', position: pos, icon: icon, anchor: anchor);
          m.setGlobalZIndex(200001);
          _overlays['academy'] = m;
          _overlayKeys['academy'] = badgeKey;
          await map.addOverlay(m);
        } else if (existing is NMarker) {
          existing.setPosition(pos);
          if (_overlayKeys['academy'] != badgeKey) {
            existing.setIcon(icon);
            existing.setAnchor(anchor);
            _overlayKeys['academy'] = badgeKey;
          }
        }
      }

      // 유턴 지점 마커 (지나온 것은 주행 중 숨김)
      final uturns = _impl.uturnPoints;
      if (uturns != null && uturns.isNotEmpty) {
        final pri = _getPrimaryRouteLatLngs();
        final curProgress = _isNavigating ? _impl.routeProgressIndex : 0;
        final icon = await _image('uturn', const _UturnMarkerWidget(), const Size(32, 32));
        if (!_canUseMap) return;
        // 번호가 보이는 정류장(유치원 근처로 묶인 것 제외)과 유치원 위치 — 유턴 표시가 이 위를 덮지 않게 비껴 놓는다
        final blockers = <GeoPoint>[
          for (int i = 0; i < _impl.stops.length; i++)
            if (!nearAcademy.contains(i) && _impl.stops[i]['lat'] is num && _impl.stops[i]['lng'] is num)
              GeoPoint((_impl.stops[i]['lat'] as num).toDouble(), (_impl.stops[i]['lng'] as num).toDouble()),
          if (_impl.academy != null) _impl.academy!,
        ];
        for (int k = 0; k < uturns.length; k++) {
          final u = uturns[k];
          final uLatLng = LatLng(u.lat, u.lng);
          if (_isNavigating && pri != null && pri.isNotEmpty) {
            int nearestIdx = 0;
            double minDist = double.infinity;
            for (int j = 0; j < pri.length; j++) {
              final d = _distanceMeters(uLatLng, pri[j]);
              if (d < minDist) {
                minDist = d;
                nearestIdx = j;
              }
            }
            if (nearestIdx < curProgress - 1) continue;
          }
          final id = 'uturn_$k';
          wanted.add(id);
          if (_overlays[id] == null) {
            // 정류장·유치원과 겹치면 오른쪽 위로 비껴 놓는다 (아이콘 기준점만 옮기므로 줌과 상관없이 화면에서 같은 간격)
            final shifted = isNearAny(GeoPoint(u.lat, u.lng), blockers);
            final m = NMarker(
              id: id,
              position: NLatLng(u.lat, u.lng),
              icon: icon,
              anchor: shifted ? const NPoint(-0.6, 1.1) : NPoint.relativeCenter,
            );
            m.setGlobalZIndex(199999); // 정류장 번호(200000)보다 아래: 겹쳐도 번호가 위에 보인다
            _overlays[id] = m;
            await map.addOverlay(m);
          }
        }
      }

      // 내 위치 차량 마커
      if (_hasInitialLocation && _meMarker == null) {
        final icon = await _image('car', const _CarMarkerWidget(screenAngleDeg: 0), const Size(72, 72));
        if (!_canUseMap) return;
        final m = NMarker(
          id: 'me',
          position: NLatLng(_animatedLat, _animatedLng),
          icon: icon,
          anchor: NPoint.relativeCenter,
          angle: _headingUp ? 0.0 : _animatedHeading,
        );
        m.setGlobalZIndex(300000);
        _meMarker = m;
        await map.addOverlay(m);
      }

      // 더 이상 필요 없는 오버레이 제거
      final stale = _overlays.keys.where((id) => !wanted.contains(id)).toList();
      for (final id in stale) {
        final ov = _overlays.remove(id);
        _overlayKeys.remove(id);
        if (ov != null) {
          await map.deleteOverlay(ov.info);
        }
      }
    } catch (e) {
      debugPrint('[nav_map_naver] syncOverlays error: $e');
    } finally {
      _syncing = false;
      if (_syncPending) {
        _syncPending = false;
        _requestSync();
      }
    }
  }

  void _updateMeMarker() {
    final m = _meMarker;
    if (m == null || !_hasInitialLocation) return;
    // 진행 방향 위 모드에서는 항상 12시(0도) 고정, 북쪽 위 모드에서는 실제 진행 방향을 가리킴
    m.setPosition(NLatLng(_animatedLat, _animatedLng));
    m.setAngle(_headingUp ? 0.0 : _animatedHeading);
  }

  // ───────────────────────── 빌드 ─────────────────────────

  // 지도 처음 위치는 한 번만 정해서 고정한다.
  // 차량 위치(_animatedLat/Lng)를 그대로 넣으면 GPS 가 움직일 때마다 지도 설정 묶음이 달라져서,
  // 지도가 설정을 전부 다시 적용하며 지도 글씨가 계속 깜빡인다.
  NCameraPosition? _initialCamera;

  @override
  Widget build(BuildContext context) {
    _initialCamera ??= NCameraPosition(
      target: NLatLng(_animatedLat, _animatedLng),
      zoom: NavMapConfig.defaultOverviewZoom,
    );
    return NaverMap(
      options: NaverMapViewOptions(
        initialCameraPosition: _initialCamera!,
        mapType: NMapType.basic, // 일반 지도 (밝은 테마)
        nightModeEnable: _naverNightMode,
        liteModeEnable: false,
        indoorEnable: false, // 실내 지도 끔
        buildingHeight: 0, // 건물 3D 끔
        symbolScale: 1.15, // 지도 글자 크기를 기본보다 조금 크게
        tiltGesturesEnable: false,
        maxTilt: 0,
        rotationGesturesEnable: true,
        compassEnable: false,
        scaleBarEnable: false,
        locationButtonEnable: false,
        indoorLevelPickerEnable: false,
        logoAlign: NLogoAlign.leftBottom,
        logoMargin: const EdgeInsets.only(left: 12, bottom: 12),
        minZoom: 6,
        maxZoom: 19,
        customStyleId: naverMapStyleId.isEmpty ? null : naverMapStyleId,
      ),
      onMapReady: (controller) {
        _map = controller;
        _isMapReady = true;
        if (_impl.shouldFitOnRoutes && !_isInitialFitDone && !_isNavigating) {
          _fitAllBounds();
          _isInitialFitDone = true;
        } else if (_isFollowing) {
          _applyCameraUpdate();
        }
        _requestSync();
      },
      onCameraChange: (reason, animated) {
        if (reason == NCameraUpdateReason.gesture) {
          // 사용자가 직접 화면을 조작(드래그/핀치/회전)하면 따라가기 해제
          _isFollowing = false;
          _targetYRatio = 0.5;
          _impl.onUserDrag?.call();
        }
      },
      onCustomStyleLoadFailed: (e) => debugPrint('[nav_map_naver] custom style load failed: $e'),
    );
  }
}

/// 내 위치 차량 화살표 마커 (흰 원 + 드롭 섀도우 + 파란 내비 화살표)
class _CarMarkerWidget extends StatelessWidget {
  final double screenAngleDeg;

  const _CarMarkerWidget({required this.screenAngleDeg});

  @override
  Widget build(BuildContext context) {
    // 그림자가 이미지 가장자리에서 잘리면 모서리가 네모나게 검게 보인다.
    // 그래서 72x72 투명 여백 안에 48 지름 원을 두고, 그림자는 여백 안에 들어오게 작게 한다.
    return SizedBox(
      width: 72,
      height: 72,
      child: Center(
        child: Container(
          width: 48,
          height: 48,
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.white,
            boxShadow: [
              BoxShadow(
                color: Color(0x40000000),
                blurRadius: 6,
                offset: Offset(0, 2),
              ),
            ],
          ),
          child: Center(
            child: Transform.rotate(
              angle: screenAngleDeg * math.pi / 180.0,
              child: CustomPaint(
                size: const Size(28, 28),
                painter: _NavArrowPainter(),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _NavArrowPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    final path = Path()
      ..moveTo(w * 0.5, h * 0.08)
      ..lineTo(w * 0.88, h * 0.92)
      ..lineTo(w * 0.5, h * 0.72)
      ..lineTo(w * 0.12, h * 0.92)
      ..close();

    final fillPaint = Paint()
      ..color = const Color(0xFF3B82F6)
      ..style = PaintingStyle.fill;

    final strokePaint = Paint()
      ..color = const Color(0xFF1D4ED8)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..strokeJoin = StrokeJoin.round;

    canvas.drawPath(path, fillPaint);
    canvas.drawPath(path, strokePaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// 정류장 마커 (원형, 번호 표시, 지난 정류장 회색, 테스트 정류장 주황 T)
class _StopMarkerWidget extends StatelessWidget {
  final int index;
  final bool isPassed;
  final bool isTest;

  const _StopMarkerWidget({
    required this.index,
    this.isPassed = false,
    this.isTest = false,
  });

  @override
  Widget build(BuildContext context) {
    Color bg = const Color(0xFF2563EB);
    if (isPassed) {
      bg = const Color(0xFF94A3B8);
    } else if (isTest) {
      bg = const Color(0xFFEA580C);
    }

    return Container(
      width: 28,
      height: 28,
      decoration: BoxDecoration(
        color: bg,
        shape: BoxShape.circle,
        border: Border.all(
          color: Colors.white,
          width: 2,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x59000000),
            blurRadius: 6,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Center(
        child: Text(
          '${isTest ? "T" : ""}${index + 1}',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 12,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }
}

/// 유치원 마커 (이름표 + 근처 정류장 번호표)
class _AcademyMarkerWidget extends StatelessWidget {
  /// 유치원 근처라 이름표 옆에 묶어 보여 줄 정류장: (정류장 번호 0부터, 지나쳤는지)
  final List<(int, bool)> badges;

  const _AcademyMarkerWidget({this.badges = const []});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 64.0 + 24.0 * badges.length,
      height: 32,
      child: Row(
        children: [
          Container(
            width: 64,
            height: 32,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: const Color(0xFF10B981),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.white, width: 2),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x8010B981),
                  blurRadius: 6,
                  offset: Offset(0, 2),
                ),
              ],
            ),
            child: const Text(
              '유치원',
              style: TextStyle(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          for (final b in badges)
            Padding(
              padding: const EdgeInsets.only(left: 2),
              child: Container(
                width: 22,
                height: 22,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: b.$2 ? const Color(0xFF94A3B8) : const Color(0xFF2563EB),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 2),
                ),
                child: Text(
                  '${b.$1 + 1}',
                  style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// 경로선 위 진행 방향 화살표 무늬 (꺾쇠 모양)
class _RouteChevronWidget extends StatelessWidget {
  final double bearingDeg;

  const _RouteChevronWidget({required this.bearingDeg});

  @override
  Widget build(BuildContext context) {
    return Transform.rotate(
      angle: bearingDeg * math.pi / 180.0,
      child: const Center(
        child: Icon(
          Icons.keyboard_arrow_up_rounded,
          size: 16,
          color: Colors.white,
          shadows: [
            Shadow(
              color: Color(0x66000000),
              blurRadius: 2,
              offset: Offset(0, 1),
            ),
          ],
        ),
      ),
    );
  }
}

/// 유턴 지점 마커 위젯 (파란 원형 표지판 + 흰색 유턴 아이콘)
class _UturnMarkerWidget extends StatelessWidget {
  const _UturnMarkerWidget();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        color: const Color(0xFF2563EB),
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 2),
        boxShadow: const [
          BoxShadow(
            color: Color(0x52000000),
            blurRadius: 6,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: const Center(
        child: Icon(
          Icons.u_turn_left_rounded,
          color: Colors.white,
          size: 20,
        ),
      ),
    );
  }
}
