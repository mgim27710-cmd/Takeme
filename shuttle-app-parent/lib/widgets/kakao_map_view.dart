import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../models/route_model.dart';
import 'naver_route_map.dart';
import 'kakao_map_view_stub.dart' if (dart.library.html) 'kakao_map_view_web.dart';

class KakaoMapView extends StatefulWidget {
  final List<RouteStop> stops;
  final List<Map<String, dynamic>> routePoints;
  /// 기사 앱이 올린 실제 도로 경로 [{lat,lng}...] (없으면 routePoints 로 대신 그림)
  final List<dynamic>? actualRoadPath;
  /// 도로 경로에서 차량이 지나온 위치(인덱스)
  final int progressIndex;
  final double? busLat;
  final double? busLng;
  final double? academyLat;
  final double? academyLng;
  final String? academyName;
  final String? myChildName;
  final String? myChildAddress;
  final double? myChildLat;
  final double? myChildLng;
  final bool isFullScreen;
  final bool isGohome;
  final bool isInteractive;
  final VoidCallback? onToggleFullscreen;

  const KakaoMapView({
    super.key,
    required this.stops,
    required this.routePoints,
    this.actualRoadPath,
    this.progressIndex = 0,
    this.busLat,
    this.busLng,
    this.academyLat,
    this.academyLng,
    this.academyName,
    this.myChildName,
    this.myChildAddress,
    this.myChildLat,
    this.myChildLng,
    this.isFullScreen = false,
    this.isGohome = false,
    this.isInteractive = true,
    this.onToggleFullscreen,
  });

  @override
  State<KakaoMapView> createState() => _KakaoMapViewState();
}

class _KakaoMapViewState extends State<KakaoMapView> {
  WebViewController? _controller;
  final GlobalKey _webMapKey = GlobalKey();
  bool _isMapLoaded = false;

  @override
  void initState() {
    super.initState();
    if (!kIsWeb) {
      _controller = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setNavigationDelegate(
          NavigationDelegate(
            onPageFinished: (_) {
              setState(() {
                _isMapLoaded = true;
              });
              _updateMapData();
            },
          ),
        )
        ..loadHtmlString(_generateHtml());
    }
  }

  @override
  void didUpdateWidget(covariant KakaoMapView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.busLat != widget.busLat || oldWidget.busLng != widget.busLng) {
      _updateBusLocation();
    }
    if (oldWidget.stops.length != widget.stops.length ||
        oldWidget.academyLat != widget.academyLat ||
        oldWidget.academyLng != widget.academyLng ||
        oldWidget.isGohome != widget.isGohome) {
      _updateMapData();
    } else if (oldWidget.actualRoadPath != widget.actualRoadPath ||
        oldWidget.progressIndex != widget.progressIndex) {
      _runJs('if (window.updateRoutePath) { window.updateRoutePath(${_roadPathJson()}, ${widget.progressIndex}); }');
    }
  }

  String _roadPathJson() => jsonEncode((widget.actualRoadPath ?? [])
      .whereType<Map>()
      .map((p) => [p['lat'] ?? p['latitude'], p['lng'] ?? p['longitude']])
      .where((p) => p[0] != null && p[1] != null)
      .toList());

  void _runJs(String js) {
    if (kIsWeb) {
      final state = _webMapKey.currentState;
      if (state != null) {
        try {
          (state as dynamic).runJs(js);
        } catch (e) {
          debugPrint('[_runJs Web] error: ' + e.toString());
        }
      }
    } else {
      _controller?.runJavaScript(js);
    }
  }

  void _updateBusLocation() {
    if (widget.busLat != null && widget.busLng != null) {
      final js = 'if (window.updateBus) { window.updateBus(' + widget.busLat.toString() + ', ' + widget.busLng.toString() + '); }';
      _runJs(js);
    }
  }

  void _updateMapData() {
    final stopsJson = jsonEncode(widget.stops.map((s) => {
      'name': s.name,
      'isMyChild': s.isMyChild,
      'lat': s.latitude,
      'lng': s.longitude,
      'address': s.address ?? '',
    }).toList());

    final pointsJson = jsonEncode(widget.routePoints.map((p) => [
      p['latitude'] ?? p['lat'],
      p['longitude'] ?? p['lng'],
    ]).where((p) => p[0] != null && p[1] != null).toList());

    final js = '''
      if (window.initData) {
        window.initData(
          $stopsJson, 
          $pointsJson, 
          ${widget.academyLat ?? 'null'}, 
          ${widget.academyLng ?? 'null'}, 
          "${widget.academyName ?? ''}", 
          ${widget.busLat ?? 'null'}, 
          ${widget.busLng ?? 'null'},
          ${widget.isGohome},
          ${widget.myChildLat ?? 'null'},
          ${widget.myChildLng ?? 'null'},
          ${_roadPathJson()},
          ${widget.progressIndex}
        );
      }
    ''';
    _controller?.runJavaScript(js);
  }


  // ───── 네이버 지도 (인증되면 사용, 아니면 아래 기존 지도) ─────
  final GlobalKey<NaverRouteMapState> _naverKey = GlobalKey<NaverRouteMapState>();
  bool get _useNaver => !kIsWeb && naverMapAvailable.value;

  static List<List<double>> _latLngList(List<dynamic>? list) {
    final out = <List<double>>[];
    for (final p in list ?? const []) {
      if (p is Map) {
        // 서버가 좌표를 숫자 또는 글자("37.78")로 보낼 수 있다
        final la = double.tryParse((p['lat'] ?? p['latitude'])?.toString() ?? '');
        final ln = double.tryParse((p['lng'] ?? p['longitude'])?.toString() ?? '');
        if (la != null && ln != null) out.add([la, ln]);
      }
    }
    return out;
  }

  Widget _naverMap() {
    // 학부모에게는 내 아이 정류장만 보여준다
    final mine = widget.stops.where((s) => s.isMyChild).toList();
    final label = widget.isGohome ? '내리는 곳' : '타는 곳';
    final stops = <NaverStopPoint>[
      if (mine.isNotEmpty)
        NaverStopPoint(lat: mine.first.latitude, lng: mine.first.longitude, label: label, isMine: true)
      else if (widget.myChildLat != null && widget.myChildLng != null)
        NaverStopPoint(lat: widget.myChildLat!, lng: widget.myChildLng!, label: label, isMine: true),
    ];
    return NaverRouteMap(
      key: _naverKey,
      stops: stops,
      fallbackPoints: _latLngList(widget.routePoints),
      roadPath: _latLngList(widget.actualRoadPath),
      progressIndex: widget.progressIndex,
      busLat: widget.busLat,
      busLng: widget.busLng,
      academyLat: widget.academyLat,
      academyLng: widget.academyLng,
      academyName: widget.academyName,
    );
  }

  /// [버스 위치] 버튼: 버스가 운행 중이면 지금 버스 위치로 이동, 아니면 안내
  void _goToBus() {
    if (widget.busLat == null || widget.busLng == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('지금 운행 중인 버스가 없어요. 운행이 시작되면 버스 위치를 볼 수 있어요.')),
      );
      return;
    }
    if (_useNaver) {
      _naverKey.currentState?.focusBus();
    } else {
      _runJs('if (window.focusBus) { window.focusBus(); }');
    }
  }

  void _zoomIn() {
    if (_useNaver) {
      _naverKey.currentState?.zoomIn();
      return;
    }
    _runJs('if (window.zoomIn) { window.zoomIn(); }');
  }

  void _zoomOut() {
    if (_useNaver) {
      _naverKey.currentState?.zoomOut();
      return;
    }
    _runJs('if (window.zoomOut) { window.zoomOut(); }');
  }

  void _fitAll() {
    if (_useNaver) {
      _naverKey.currentState?.fitAll();
      return;
    }
    _runJs('if (window.fitAll) { window.fitAll(); }');
  }

  void _focusMyChild() {
    if (_useNaver) {
      _naverKey.currentState?.focusMyChild();
      return;
    }
    _runJs('if (window.focusMyChild) { window.focusMyChild(); }');
  }

  void _openFullscreen() {
    if (widget.isFullScreen) return; // 이미 전체화면 상태면 중복 진입 방지
    if (widget.onToggleFullscreen != null) {
      widget.onToggleFullscreen!();
      return;
    }
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => KakaoMapFullscreenPage(
          isGohome: widget.isGohome,
          stops: widget.stops,
          routePoints: widget.routePoints,
          actualRoadPath: widget.actualRoadPath,
          progressIndex: widget.progressIndex,
          busLat: widget.busLat,
          busLng: widget.busLng,
          academyLat: widget.academyLat,
          academyLng: widget.academyLng,
          academyName: widget.academyName,
          myChildName: widget.myChildName,
          myChildAddress: widget.myChildAddress,
        ),
      ),
    );
  }

  String _generateHtml({bool autoInit = false}) {
    final centerLat = widget.academyLat ?? widget.busLat ?? (widget.stops.isNotEmpty ? widget.stops.first.latitude : 37.5580);
    final centerLng = widget.academyLng ?? widget.busLng ?? (widget.stops.isNotEmpty ? widget.stops.first.longitude : 126.8240);

    String autoInitScript = '';
    if (autoInit) {
      final stopsJson = jsonEncode(widget.stops.map((s) => {
        'name': s.name,
        'isMyChild': s.isMyChild,
        'lat': s.latitude,
        'lng': s.longitude,
        'address': s.address ?? '',
      }).toList());

      final pointsJson = jsonEncode(widget.routePoints.map((p) => [
        p['latitude'] ?? p['lat'],
        p['longitude'] ?? p['lng'],
      ]).where((p) => p[0] != null && p[1] != null).toList());

      final acName = widget.academyName != null ? jsonEncode(widget.academyName) : "''";
      final acLat = widget.academyLat != null ? '${widget.academyLat}' : 'null';
      final acLng = widget.academyLng != null ? '${widget.academyLng}' : 'null';
      final bLat = widget.busLat != null ? '${widget.busLat}' : 'null';
      final bLng = widget.busLng != null ? '${widget.busLng}' : 'null';

      autoInitScript = '''
        setTimeout(function() {
          if (window.initData) {
            window.initData($stopsJson, $pointsJson, $acLat, $acLng, $acName, $bLat, $bLng, ${widget.isGohome}, ${widget.myChildLat ?? 'null'}, ${widget.myChildLng ?? 'null'}, ${_roadPathJson()}, ${widget.progressIndex});
          }
        }, 300);
      ''';
    }

    return '''
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; background: #f8fafc; }
        
        .bus-marker {
          background-color: #ef4444;
          color: white;
          border-radius: 50%;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 11px;
          border: 3px solid white;
          box-shadow: 0 4px 10px rgba(239,68,68,0.5);
        }

        /* 타는 곳 점 마커 */
        .pickup-point-dot {
          width: 26px;
          height: 26px;
          background-color: #2563eb;
          border: 4px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.4), 0 3px 8px rgba(0,0,0,0.3);
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .pickup-point-dot::after {
          content: '';
          width: 8px;
          height: 8px;
          background-color: #ffffff;
          border-radius: 50%;
        }

        /* 도착지 점 마커 */
        .dest-point-dot {
          width: 26px;
          height: 26px;
          background-color: #10b981;
          border: 4px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 0 0 3px rgba(16,185,129,0.4), 0 3px 8px rgba(0,0,0,0.3);
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .dest-point-dot::after {
          content: '';
          width: 8px;
          height: 8px;
          background-color: #ffffff;
          border-radius: 50%;
        }

        .point-label {
          position: absolute;
          top: -24px;
          left: 50%;
          transform: translateX(-50%);
          color: white;
          font-size: 11px;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: 10px;
          white-space: nowrap;
          box-shadow: 0 2px 5px rgba(0,0,0,0.25);
          border: 1px solid white;
        }
        .pickup-label {
          background-color: #2563eb;
        }
        .dest-label {
          background-color: #10b981;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', {
          zoomControl: false,
          attributionControl: false,
          tap: true,
          touchZoom: true,
          scrollWheelZoom: true,
          doubleClickZoom: true
        }).setView([$centerLat, $centerLng], 14);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
        }).addTo(map);

        var busMarker = null;
        var myChildLatLng = null;
        var allBounds = null;

        window.zoomIn = function() { map.zoomIn(); };
        window.zoomOut = function() { map.zoomOut(); };
        window.fitAll = function() {
          if (allBounds && allBounds.isValid()) {
            map.fitBounds(allBounds, { padding: [40, 40] });
          }
        };
        window.focusMyChild = function() {
          if (myChildLatLng) {
            map.setView(myChildLatLng, 16);
          }
        };
        window.focusBus = function() {
          if (busMarker) {
            map.setView(busMarker.getLatLng(), 16);
          }
        };

        var meMarker = null;
        window.showMe = function(lat, lng) {
          if (!lat || !lng) return;
          if (meMarker) {
            meMarker.setLatLng([lat, lng]);
          } else {
            meMarker = L.circleMarker([lat, lng], {
              radius: 7, color: '#ffffff', weight: 3, fillColor: '#ef4444', fillOpacity: 1
            }).addTo(map);
          }
          map.setView([lat, lng], 16);
        };

        window.updateBus = function(lat, lng) {
          if (!lat || !lng) return;
          if (busMarker) {
            busMarker.setLatLng([lat, lng]);
          } else {
            var icon = L.divIcon({
              className: '',
              html: '<div class="bus-marker">BUS</div>',
              iconSize: [36, 36],
              iconAnchor: [18, 18]
            });
            busMarker = L.marker([lat, lng], { icon: icon }).bindPopup('<b>🚌 통학버스 현재 위치</b>').addTo(map);
          }
        };

        // 경로선과 마커를 담는 층. initData 가 다시 불려도 겹쳐 그려지지 않도록 매번 비운다.
        var dataLayer = L.layerGroup().addTo(map);
        var routeLayer = L.layerGroup().addTo(map);

        function toLatLngs(list) {
          var out = [];
          (list || []).forEach(function(p) {
            if (p && p.length >= 2 && p[0] && p[1]) out.push([p[0], p[1]]);
          });
          return out;
        }

        // 기사 앱처럼 전체 경로를 그린다: 지나온 구간은 회색, 남은 구간은 파란색
        function drawRoute(roadPath, progIdx, fallbackPoints) {
          routeLayer.clearLayers();
          var road = toLatLngs(roadPath);
          if (road.length > 1) {
            var idx = Math.max(0, Math.min(progIdx || 0, road.length - 1));
            if (idx > 0) {
              L.polyline(road.slice(0, idx + 1), { color: '#94a3b8', weight: 6, opacity: 0.9, lineJoin: 'round', lineCap: 'round' }).addTo(routeLayer);
            }
            var remain = road.slice(idx);
            if (remain.length > 1) {
              L.polyline(remain, { color: '#1d4ed8', weight: 9, opacity: 0.85, lineJoin: 'round', lineCap: 'round' }).addTo(routeLayer);
              L.polyline(remain, { color: '#3b82f6', weight: 5, opacity: 1.0, lineJoin: 'round', lineCap: 'round' }).addTo(routeLayer);
            }
            return road;
          }
          // 기사 앱이 아직 도로 경로를 올리지 않았으면 정류장끼리 이은 점선으로 대신 보여준다
          var pts = toLatLngs(fallbackPoints);
          if (pts.length > 1) {
            L.polyline(pts, { color: '#3b82f6', weight: 4, opacity: 0.8, dashArray: '8 8' }).addTo(routeLayer);
          }
          return pts;
        }

        var lastFallbackPoints = [];
        window.updateRoutePath = function(roadPath, progIdx) {
          drawRoute(roadPath, progIdx, lastFallbackPoints);
        };

        window.initData = function(stops, points, acLat, acLng, acName, bLat, bLng, isGohome, childLatArg, childLngArg, roadPath, progIdx) {
          dataLayer.clearLayers();
          var pts = [];
          var hasAcademy = acLat && acLng;
          var acTitle = acName || '유치원';

          // 내 아이 정류장 (학부모에게는 내 아이 정류장만 온다)
          var myStop = null;
          (stops || []).forEach(function(s) {
            if (!myStop && s.lat && s.lng && s.isMyChild) myStop = s;
          });
          var childLat = childLatArg || (myStop ? myStop.lat : null);
          var childLng = childLngArg || (myStop ? myStop.lng : null);
          var childPlace = myStop ? (myStop.address || myStop.name) : '우리 아이 정류장';

          function pointMarker(lat, lng, cls, label, popup, z) {
            var icon = L.divIcon({
              className: '',
              html: '<div class="' + cls + '-point-dot"><span class="point-label ' + cls + '-label">' + label + '</span></div>',
              iconSize: [26, 26],
              iconAnchor: [13, 13]
            });
            return L.marker([lat, lng], { icon: icon, zIndexOffset: z }).bindPopup(popup).addTo(dataLayer);
          }

          if (childLat && childLng) {
            myChildLatLng = [childLat, childLng];
            var label = isGohome ? '내리는 곳' : '타는 곳';
            var m = pointMarker(childLat, childLng, isGohome ? 'dest' : 'pickup', label,
              '<b>📍 우리 아이 ' + label + '</b><br/>' + childPlace, 1200);
            m.openPopup();
            pts.push([childLat, childLng]);
          }
          if (hasAcademy) {
            pointMarker(acLat, acLng, isGohome ? 'pickup' : 'dest', isGohome ? '출발' : '도착',
              '<b>🏫 ' + acTitle + '</b>', 800);
            pts.push([acLat, acLng]);
          }

          lastFallbackPoints = points || [];
          drawRoute(roadPath, progIdx, lastFallbackPoints).forEach(function(p) { pts.push(p); });

          if (bLat && bLng) {
            window.updateBus(bLat, bLng);
            pts.push([bLat, bLng]);
          }

          if (pts.length > 0) {
            allBounds = L.latLngBounds(pts);
            map.fitBounds(allBounds, { padding: [50, 50], maxZoom: 16 });
          }
        };

        window.addEventListener('message', function(e) {
          if (e.data && e.data.action === 'eval' && e.data.js) {
            try { eval(e.data.js); } catch(err) { console.error(err); }
          }
        });

        $autoInitScript
      </script>
    </body>
    </html>
    ''';
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // Map Container
        ClipRRect(
          borderRadius: BorderRadius.circular(widget.isFullScreen ? 0 : 20),
          child: kIsWeb
              ? KakaoMapViewWeb(
                  key: _webMapKey,
                  htmlContent: _generateHtml(autoInit: true),
                  isInteractive: widget.isInteractive,
                )
              : ValueListenableBuilder<bool>(
                  valueListenable: naverMapAvailable,
                  builder: (context, naverOk, _) => naverOk
                      ? _naverMap()
                      : (_controller == null
                          ? _buildWebPlaceholder()
                          : WebViewWidget(controller: _controller!)),
                ),
        ),

        // Controls Overlay (전체화면에서는 화면 가장자리·카메라 구멍을 피한다)
        Positioned(
          top: 12 + (widget.isFullScreen ? MediaQuery.viewPaddingOf(context).top : 0),
          right: 12 + (widget.isFullScreen ? MediaQuery.viewPaddingOf(context).right : 0),
          child: Column(
            children: [
              // Fullscreen Toggle
              _buildControlBtn(
                icon: widget.isFullScreen ? Icons.fullscreen_exit : Icons.fullscreen,
                tooltip: widget.isFullScreen ? '화면 축소' : '전체화면으로 보기',
                color: const Color(0xFF2563EB),
                iconColor: Colors.white,
                onTap: widget.isFullScreen
                    ? () => Navigator.pop(context)
                    : _openFullscreen,
              ),
              const SizedBox(height: 8),

              // Zoom In
              _buildControlBtn(
                icon: Icons.add,
                tooltip: '지도 확대',
                onTap: _zoomIn,
              ),
              const SizedBox(height: 4),

              // Zoom Out
              _buildControlBtn(
                icon: Icons.remove,
                tooltip: '지도 축소',
                onTap: _zoomOut,
              ),
              const SizedBox(height: 8),

              // Focus My Child
              _buildControlBtn(
                icon: Icons.star_rounded,
                tooltip: '우리 아이 탑승지로 이동',
                iconColor: const Color(0xFF7C3AED),
                onTap: _focusMyChild,
              ),
              const SizedBox(height: 4),

              // Fit All
              _buildControlBtn(
                icon: Icons.crop_free,
                tooltip: '전체 노선 한눈에 보기',
                onTap: _fitAll,
              ),
              const SizedBox(height: 8),

              // 버스 위치 (운행 중일 때 지금 버스가 있는 곳으로)
              _buildControlBtn(
                icon: Icons.directions_bus_filled,
                tooltip: '버스 위치 보기',
                iconColor: const Color(0xFFF59E0B),
                onTap: _goToBus,
              ),
            ],
          ),
        ),

        // Academy Label Badge
        if (widget.academyName != null && !widget.isFullScreen)
          Positioned(
            top: 12,
            left: 12,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.92),
                borderRadius: BorderRadius.circular(10),
                boxShadow: [
                  BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 4, offset: const Offset(0, 1))
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.school, size: 14, color: Color(0xFF2563EB)),
                  const SizedBox(width: 4),
                  Text(
                    widget.academyName!,
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildControlBtn({
    required IconData icon,
    required String tooltip,
    required VoidCallback onTap,
    Color color = Colors.white,
    Color iconColor = const Color(0xFF1E293B),
  }) {
    return Material(
      color: color,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: Colors.black.withValues(alpha: 0.08)),
      ),
      elevation: 2,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Tooltip(
          message: tooltip,
          child: Container(
            width: 38,
            height: 38,
            alignment: Alignment.center,
            child: Icon(icon, size: 20, color: iconColor),
          ),
        ),
      ),
    );
  }

  Widget _buildWebPlaceholder() {
    return Container(
      color: const Color(0xFFF1F5F9),
      padding: const EdgeInsets.all(24),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.map_rounded, size: 54, color: Color(0xFF2563EB)),
            const SizedBox(height: 12),
            Text(
              widget.academyName ?? '실시간 셔틀 노선 지도',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF1E293B)),
            ),
            const SizedBox(height: 6),
            Text(
              '배정 경유지 ${widget.stops.length}개소 · 실시간 버스 위치 수신 중',
              style: const TextStyle(fontSize: 13, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 16),
            widget.isFullScreen
                ? ElevatedButton.icon(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.fullscreen_exit, size: 18),
                    label: const Text('화면 축소하기 (돌아가기)'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF475569),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                    ),
                  )
                : ElevatedButton.icon(
                    onPressed: _openFullscreen,
                    icon: const Icon(Icons.fullscreen, size: 18),
                    label: const Text('전체화면으로 크게 보기'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                    ),
                  ),
          ],
        ),
      ),
    );
  }
}

/// 전체화면 지도 (차량선생님 앱과 같은 구성)
/// - 안드로이드 하단 버튼 줄·상태 표시줄을 숨겨 지도를 가리지 않게 한다 (가장자리를 쓸어 올리면 잠깐 나타남)
/// - 뒤로 가기는 위의 ← 버튼
/// - 아래 '우리 아이 탑승/하차 장소' 카드는 X 로 오늘 하루 닫을 수 있다
class KakaoMapFullscreenPage extends StatefulWidget {
  final bool isGohome;
  final List<RouteStop> stops;
  final List<Map<String, dynamic>> routePoints;
  final List<dynamic>? actualRoadPath;
  final int progressIndex;
  final double? busLat;
  final double? busLng;
  final double? academyLat;
  final double? academyLng;
  final String? academyName;
  final String? myChildName;
  final String? myChildAddress;

  const KakaoMapFullscreenPage({
    super.key,
    this.isGohome = false,
    required this.stops,
    required this.routePoints,
    this.actualRoadPath,
    this.progressIndex = 0,
    this.busLat,
    this.busLng,
    this.academyLat,
    this.academyLng,
    this.academyName,
    this.myChildName,
    this.myChildAddress,
  });

  @override
  State<KakaoMapFullscreenPage> createState() => _KakaoMapFullscreenPageState();
}

class _KakaoMapFullscreenPageState extends State<KakaoMapFullscreenPage> {
  bool _isCardDismissed = false;

  @override
  void initState() {
    super.initState();
    _checkCardDismissed();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  }

  @override
  void dispose() {
    // 지도에서 나가면 시스템 표시줄을 원래대로
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.manual, overlays: SystemUiOverlay.values);
    super.dispose();
  }

  Future<void> _checkCardDismissed() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final dismissedDate = prefs.getString('hide_child_stop_card_date');
      final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
      if (dismissedDate == today && mounted) {
        setState(() => _isCardDismissed = true);
      }
    } catch (_) {}
  }

  Future<void> _dismissCardForToday() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
      await prefs.setString('hide_child_stop_card_date', today);
    } catch (_) {}
    if (mounted) setState(() => _isCardDismissed = true);
  }

  @override
  Widget build(BuildContext context) {
    final myStop = widget.stops.cast<RouteStop?>().firstWhere((s) => s?.isMyChild == true, orElse: () => null);
    final viewPadding = MediaQuery.viewPaddingOf(context);
    final placeLabel = widget.isGohome ? '우리 아이 하차 장소' : '우리 아이 탑승 장소';

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.academyName ?? '유치원 통학차량 실시간 지도',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
            ),
            if (widget.myChildName != null)
              Text(
                '${widget.myChildName} 원아 ${widget.isGohome ? '하원' : '등원'} 노선',
                style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
              ),
          ],
        ),
        backgroundColor: Colors.white,
        elevation: 1,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20, color: Color(0xFF0F172A)),
          tooltip: '뒤로',
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.fullscreen_exit, size: 24, color: Color(0xFF2563EB)),
            tooltip: '축소하기',
            onPressed: () => Navigator.pop(context),
          ),
        ],
      ),
      body: Stack(
        children: [
          Positioned.fill(
            child: KakaoMapView(
              stops: widget.stops,
              routePoints: widget.routePoints,
              actualRoadPath: widget.actualRoadPath,
              progressIndex: widget.progressIndex,
              busLat: widget.busLat,
              busLng: widget.busLng,
              academyLat: widget.academyLat,
              academyLng: widget.academyLng,
              academyName: widget.academyName,
              myChildName: widget.myChildName,
              myChildAddress: widget.myChildAddress,
              isFullScreen: true,
              isGohome: widget.isGohome,
            ),
          ),

          // 아래 카드: 우리 아이 탑승/하차 장소 (X 로 오늘 하루 닫기)
          if (!_isCardDismissed)
            Positioned(
              left: 16 + viewPadding.left,
              right: 16 + viewPadding.right,
              bottom: 24 + viewPadding.bottom,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.12),
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                  ],
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF5F3FF),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFDDD6FE)),
                      ),
                      child: const Icon(Icons.stars_rounded, color: Color(0xFF7C3AED), size: 26),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            placeLabel,
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF7C3AED)),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            myStop?.address ?? widget.myChildAddress ?? (myStop?.name ?? '정류장 정보 없음'),
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    // X: 오늘 하루 닫기
                    Tooltip(
                      message: '오늘 하루 닫기',
                      child: InkWell(
                        onTap: _dismissCardForToday,
                        borderRadius: BorderRadius.circular(20),
                        child: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: const BoxDecoration(color: Color(0xFFF1F5F9), shape: BoxShape.circle),
                          child: const Icon(Icons.close, size: 16, color: Color(0xFF64748B)),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
