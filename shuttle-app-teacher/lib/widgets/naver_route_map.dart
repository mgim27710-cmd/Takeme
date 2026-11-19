import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_naver_map/flutter_naver_map.dart';

/// 실행할 때 --dart-define=NAVER_MAP_CLIENT_ID=... 로 넣는 네이버 지도 클라이언트 ID
const String naverMapClientId = String.fromEnvironment('NAVER_MAP_CLIENT_ID');

/// 네이버 지도 SDK 인증이 성공했는지. 실패하면 기존 지도(OpenStreetMap)로 보여준다.
final ValueNotifier<bool> naverMapAvailable = ValueNotifier<bool>(false);
final ValueNotifier<String> naverMapFallbackReason = ValueNotifier<String>('');

/// 앱 시작 때 한 번 (main.dart). 클라이언트 ID 가 없거나 인증에 실패하면 기존 지도를 쓴다.
/// 인증은 네이버 클라우드 콘솔에 이 앱의 패키지 이름이 등록되어 있어야 성공한다.
Future<void> initNaverMap() async {
  if (naverMapClientId.isEmpty || kIsWeb) {
    naverMapFallbackReason.value = 'NAVER_MAP_CLIENT_ID 없음';
    return;
  }
  try {
    await FlutterNaverMap().init(
      clientId: naverMapClientId,
      onAuthFailed: (e) {
        debugPrint('[naver_map] 인증 실패, 기존 지도로 전환: $e');
        naverMapFallbackReason.value = '네이버 인증 실패 (콘솔에 패키지 이름 등록 확인): $e';
        naverMapAvailable.value = false;
      },
    );
    naverMapAvailable.value = true;
  } catch (e) {
    debugPrint('[naver_map] 초기화 실패, 기존 지도로 전환: $e');
    naverMapFallbackReason.value = '네이버 SDK 초기화 실패: $e';
  }
}

/// 지도에 찍을 정류장
class NaverStopPoint {
  final double lat;
  final double lng;
  final String label; // 말풍선 글자 (예: "1", "타는 곳")
  final bool isMine; // 우리 아이 정류장 (보라색 별)
  final String? popup; // 눌렀을 때 아래 안내
  const NaverStopPoint({required this.lat, required this.lng, required this.label, this.isMine = false, this.popup});
}

/// 학부모·차량선생님 앱 공용 네이버 지도
/// - 경로: 기사 앱 도로 경로(지나온 구간 회색, 남은 구간 파랑), 없으면 정류장끼리 점선
/// - 정류장, 유치원, 버스 위치 표시
class NaverRouteMap extends StatefulWidget {
  final List<NaverStopPoint> stops;
  final List<List<double>> fallbackPoints;
  final List<List<double>> roadPath;
  final int progressIndex;
  final double? busLat;
  final double? busLng;
  final double? academyLat;
  final double? academyLng;
  final String? academyName;
  final ValueChanged<int>? onStopTap;

  const NaverRouteMap({
    super.key,
    required this.stops,
    this.fallbackPoints = const [],
    this.roadPath = const [],
    this.progressIndex = 0,
    this.busLat,
    this.busLng,
    this.academyLat,
    this.academyLng,
    this.academyName,
    this.onStopTap,
  });

  @override
  State<NaverRouteMap> createState() => NaverRouteMapState();
}

class NaverRouteMapState extends State<NaverRouteMap> {
  NaverMapController? _map;
  NMarker? _busMarker;
  bool _syncing = false;
  bool _pending = false;
  bool _fitted = false;
  final Map<String, NOverlayImage> _images = {};

  // ───── 지도 버튼에서 부르는 동작 ─────
  void zoomIn() => _map?.updateCamera(NCameraUpdate.zoomIn());
  void zoomOut() => _map?.updateCamera(NCameraUpdate.zoomOut());

  void fitAll() {
    final pts = _allPoints();
    if (_map == null || pts.isEmpty) return;
    if (pts.length == 1) {
      _map!.updateCamera(NCameraUpdate.withParams(target: pts.first, zoom: 15));
      return;
    }
    _map!.updateCamera(NCameraUpdate.fitBounds(NLatLngBounds.from(pts), padding: const EdgeInsets.all(48)));
  }

  void focusMyChild() {
    final mine = widget.stops.where((s) => s.isMine).toList();
    if (_map == null || mine.isEmpty) return;
    _map!.updateCamera(NCameraUpdate.withParams(target: NLatLng(mine.first.lat, mine.first.lng), zoom: 16));
  }

  List<NLatLng> _allPoints() {
    final pts = <NLatLng>[];
    for (final s in widget.stops) {
      pts.add(NLatLng(s.lat, s.lng));
    }
    if (widget.academyLat != null && widget.academyLng != null) {
      pts.add(NLatLng(widget.academyLat!, widget.academyLng!));
    }
    final path = widget.roadPath.length > 1 ? widget.roadPath : widget.fallbackPoints;
    for (final p in path) {
      pts.add(NLatLng(p[0], p[1]));
    }
    if (widget.busLat != null && widget.busLng != null) {
      pts.add(NLatLng(widget.busLat!, widget.busLng!));
    }
    return pts;
  }

  @override
  void didUpdateWidget(covariant NaverRouteMap old) {
    super.didUpdateWidget(old);
    final onlyBusMoved = old.stops.length == widget.stops.length &&
        identical(old.roadPath, widget.roadPath) &&
        old.progressIndex == widget.progressIndex &&
        old.fallbackPoints.length == widget.fallbackPoints.length &&
        old.academyLat == widget.academyLat;
    if (onlyBusMoved && _busMarker != null && widget.busLat != null && widget.busLng != null) {
      _busMarker!.setPosition(NLatLng(widget.busLat!, widget.busLng!));
      return;
    }
    _requestSync();
  }

  Future<NOverlayImage> _image(String key, Widget child, Size size) async {
    final cached = _images[key];
    if (cached != null) return cached;
    final img = await NOverlayImage.fromWidget(
      widget: Directionality(textDirection: TextDirection.ltr, child: child),
      size: size,
      context: context,
    );
    _images[key] = img;
    return img;
  }

  void _requestSync() {
    if (_map == null) return;
    if (_syncing) {
      _pending = true;
      return;
    }
    _sync();
  }

  /// 정류장·경로·유치원·버스를 지도에 다시 그린다 (오버레이 수가 적어서 매번 새로 그린다)
  Future<void> _sync() async {
    final map = _map;
    if (map == null || !mounted) return;
    _syncing = true;
    try {
      final overlays = <NAddableOverlay>{};

      // 경로선
      final road = widget.roadPath.map((p) => NLatLng(p[0], p[1])).toList();
      if (road.length > 1) {
        final idx = widget.progressIndex.clamp(0, road.length - 1);
        if (idx > 0) {
          overlays.add(NPathOverlay(
            id: 'passed',
            coords: road.sublist(0, idx + 1),
            color: const Color(0xFF94A3B8),
            width: 6,
            outlineWidth: 0,
          ));
        }
        final remain = road.sublist(idx);
        if (remain.length > 1) {
          overlays.add(NPathOverlay(
            id: 'remain',
            coords: remain,
            color: const Color(0xFF3B82F6),
            width: 7,
            outlineColor: const Color(0xFF1D4ED8),
            outlineWidth: 2,
          ));
        }
      } else if (widget.fallbackPoints.length > 1) {
        overlays.add(NPolylineOverlay(
          id: 'fallback',
          coords: widget.fallbackPoints.map((p) => NLatLng(p[0], p[1])).toList(),
          color: const Color(0xFF3B82F6),
          width: 4,
          pattern: const [8, 8],
          lineCap: NLineCap.round,
          lineJoin: NLineJoin.round,
        ));
      }

      // 정류장
      for (var i = 0; i < widget.stops.length; i++) {
        final s = widget.stops[i];
        final icon = await _image(
          's_${s.isMine}_${s.label}',
          _StopBadge(label: s.label, mine: s.isMine),
          s.isMine ? const Size(84, 34) : const Size(30, 30),
        );
        if (!mounted) return;
        final m = NMarker(id: 'stop_$i', position: NLatLng(s.lat, s.lng), icon: icon, anchor: NPoint.relativeCenter);
        m.setGlobalZIndex(s.isMine ? 200010 : 200000);
        if (s.popup != null) {
          m.setCaption(NOverlayCaption(text: s.popup!, textSize: 13, color: const Color(0xFF1E293B)));
          m.setIsHideCollidedCaptions(true);
        }
        if (widget.onStopTap != null) {
          final index = i;
          m.setOnTapListener((_) => widget.onStopTap!(index));
        }
        overlays.add(m);
      }

      // 유치원
      if (widget.academyLat != null && widget.academyLng != null) {
        final name = (widget.academyName?.isNotEmpty ?? false) ? widget.academyName! : '유치원';
        final icon = await _image('academy_$name', _AcademyBadge(name: name), const Size(150, 34));
        if (!mounted) return;
        final m = NMarker(
          id: 'academy',
          position: NLatLng(widget.academyLat!, widget.academyLng!),
          icon: icon,
          anchor: NPoint.relativeCenter,
        );
        m.setGlobalZIndex(200005);
        overlays.add(m);
      }

      // 버스
      _busMarker = null;
      if (widget.busLat != null && widget.busLng != null) {
        final icon = await _image('bus', const _BusBadge(), const Size(40, 40));
        if (!mounted) return;
        final m = NMarker(id: 'bus', position: NLatLng(widget.busLat!, widget.busLng!), icon: icon, anchor: NPoint.relativeCenter);
        m.setGlobalZIndex(300000);
        _busMarker = m;
        overlays.add(m);
      }

      await map.clearOverlays();
      if (overlays.isNotEmpty) await map.addOverlayAll(overlays);
      if (!_fitted && _allPoints().isNotEmpty) {
        _fitted = true;
        fitAll();
      }
    } catch (e) {
      debugPrint('[naver_route_map] sync error: $e');
    } finally {
      _syncing = false;
      if (_pending) {
        _pending = false;
        _requestSync();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final start = widget.academyLat != null && widget.academyLng != null
        ? NLatLng(widget.academyLat!, widget.academyLng!)
        : (widget.stops.isNotEmpty ? NLatLng(widget.stops.first.lat, widget.stops.first.lng) : const NLatLng(37.7854, 127.0459));
    return NaverMap(
      options: NaverMapViewOptions(
        initialCameraPosition: NCameraPosition(target: start, zoom: 13),
        mapType: NMapType.basic,
        indoorEnable: false,
        buildingHeight: 0,
        symbolScale: 1.1,
        tiltGesturesEnable: false,
        maxTilt: 0,
        compassEnable: false,
        scaleBarEnable: false,
        locationButtonEnable: false,
        logoAlign: NLogoAlign.leftBottom,
        logoMargin: const EdgeInsets.only(left: 10, bottom: 10),
        minZoom: 6,
        maxZoom: 19,
      ),
      onMapReady: (controller) {
        _map = controller;
        _requestSync();
      },
    );
  }
}

class _StopBadge extends StatelessWidget {
  final String label;
  final bool mine;
  const _StopBadge({required this.label, required this.mine});

  @override
  Widget build(BuildContext context) {
    if (mine) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: const Color(0xFF7C3AED),
          borderRadius: BorderRadius.circular(17),
          border: Border.all(color: Colors.white, width: 2),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.star_rounded, color: Colors.white, size: 16),
            const SizedBox(width: 2),
            Flexible(
              child: Text(label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w900)),
            ),
          ],
        ),
      );
    }
    return Container(
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: const Color(0xFF2563EB),
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 2),
      ),
      child: Text(label, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w900)),
    );
  }
}

class _AcademyBadge extends StatelessWidget {
  final String name;
  const _AcademyBadge({required this.name});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: const Color(0xFF10B981),
          borderRadius: BorderRadius.circular(17),
          border: Border.all(color: Colors.white, width: 2),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.school, color: Colors.white, size: 15),
            const SizedBox(width: 3),
            Flexible(
              child: Text(name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w900)),
            ),
          ],
        ),
      ),
    );
  }
}

class _BusBadge extends StatelessWidget {
  const _BusBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFF59E0B),
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 3),
      ),
      child: const Icon(Icons.directions_bus_filled, color: Colors.white, size: 22),
    );
  }
}
