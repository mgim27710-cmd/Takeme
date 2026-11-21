import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../models/route_model.dart';
import 'naver_route_map.dart';
import 'package:geolocator/geolocator.dart';

class KakaoMapView extends StatefulWidget {
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
  final bool isFullScreen;
  final VoidCallback? onToggleFullscreen;
  final void Function(int index, String name)? onStopTap;

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
    this.isFullScreen = false,
    this.onToggleFullscreen,
    this.onStopTap,
  });

  @override
  State<KakaoMapView> createState() => _KakaoMapViewState();
}

class _KakaoMapViewState extends State<KakaoMapView> {
  WebViewController? _controller;
  bool _isMapLoaded = false;

  @override
  void initState() {
    super.initState();
    if (!kIsWeb) {
      _controller = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..addJavaScriptChannel(
          'StopClickHandler',
          onMessageReceived: (JavaScriptMessage msg) {
            try {
              final data = jsonDecode(msg.message);
              final idx = data['index'] as int?;
              final name = data['name'] as String? ?? '';
              if (idx != null && widget.onStopTap != null) {
                widget.onStopTap!(idx, name);
              }
            } catch (_) {}
          },
        )
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
    if (_isMapLoaded && _controller != null) {
      if (oldWidget.busLat != widget.busLat || oldWidget.busLng != widget.busLng) {
        _updateBusLocation();
      }
      if (oldWidget.stops.length != widget.stops.length ||
          oldWidget.academyLat != widget.academyLat ||
          oldWidget.academyLng != widget.academyLng) {
        _updateMapData();
      }
      if (oldWidget.actualRoadPath != widget.actualRoadPath ||
          oldWidget.progressIndex != widget.progressIndex) {
        _updateRoutePath();
      }
    }
  }

  void _updateBusLocation() {
    if (widget.busLat != null && widget.busLng != null) {
      final js = 'if (window.updateBus) { window.updateBus(${widget.busLat}, ${widget.busLng}); }';
      _controller?.runJavaScript(js);
    }
  }

  void _updateRoutePath() {
    final roadPath = widget.actualRoadPath;
    if (roadPath != null && roadPath.isNotEmpty) {
      final roadJson = jsonEncode(roadPath.map((p) => [
        p['lat'] ?? p['latitude'],
        p['lng'] ?? p['longitude'],
      ]).where((p) => p[0] != null && p[1] != null).toList());
      final js = 'if (window.updateRoutePath) { window.updateRoutePath($roadJson, ${widget.progressIndex}); }';
      _controller?.runJavaScript(js);
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

    final roadPathJson = jsonEncode((widget.actualRoadPath ?? []).map((p) => [
      p['lat'] ?? p['latitude'],
      p['lng'] ?? p['longitude'],
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
          $roadPathJson,
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
    final hasAcademy = widget.academyLat != null && widget.academyLng != null;
    final stops = <NaverStopPoint>[
      for (var i = 0; i < widget.stops.length; i++)
        NaverStopPoint(
          lat: widget.stops[i].latitude,
          lng: widget.stops[i].longitude,
          label: widget.stops[i].isMyChild
              ? '우리 아이'
              : (!hasAcademy && i == widget.stops.length - 1 ? '🏁 도착' : '${i + 1}'),
          isMine: widget.stops[i].isMyChild,
        ),
    ];
    return NaverRouteMap(
      key: _naverKey,
      stops: stops,
      // 차량선생님 지도에는 정류장끼리 이은 점선을 그리지 않는다 (실제 도로 경로만)
      fallbackPoints: const [],
      roadPath: _latLngList(widget.actualRoadPath),
      progressIndex: widget.progressIndex,
      busLat: widget.busLat,
      busLng: widget.busLng,
      academyLat: widget.academyLat,
      academyLng: widget.academyLng,
      academyName: widget.academyName,
      onStopTap: widget.onStopTap == null ? null : (i) => widget.onStopTap!(i, widget.stops[i].name),
    );
  }

  bool _locating = false;

  /// [내 위치] 버튼: 위치 권한을 확인하고 현재 위치를 작은 빨간 점으로 표시
  Future<void> _goToMyLocation() async {
    if (_locating) return;
    void tell(String msg) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    }

    _locating = true;
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        tell('휴대폰 위치(GPS)가 꺼져 있습니다. 설정에서 위치를 켜 주세요.');
        return;
      }
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
      if (perm == LocationPermission.denied) {
        tell('위치 권한을 허용해야 내 위치를 볼 수 있어요.');
        return;
      }
      if (perm == LocationPermission.deniedForever) {
        tell('위치 권한이 꺼져 있습니다. 휴대폰 설정 > 앱 > 위치에서 허용해 주세요.');
        await Geolocator.openAppSettings();
        return;
      }
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 10)),
      );
      if (!mounted) return;
      if (_useNaver) {
        await _naverKey.currentState?.showMyLocation(pos.latitude, pos.longitude);
      } else {
        _controller?.runJavaScript('if (window.showMe) { window.showMe(${pos.latitude}, ${pos.longitude}); }');
      }
    } catch (e) {
      tell('현재 위치를 가져오지 못했습니다. 잠시 후 다시 눌러 주세요.');
    } finally {
      _locating = false;
    }
  }

  void _zoomIn() {
    if (_useNaver) {
      _naverKey.currentState?.zoomIn();
      return;
    }
    _controller?.runJavaScript('if (window.zoomIn) { window.zoomIn(); }');
  }

  void _zoomOut() {
    if (_useNaver) {
      _naverKey.currentState?.zoomOut();
      return;
    }
    _controller?.runJavaScript('if (window.zoomOut) { window.zoomOut(); }');
  }

  void _fitAll() {
    if (_useNaver) {
      _naverKey.currentState?.fitAll();
      return;
    }
    _controller?.runJavaScript('if (window.fitAll) { window.fitAll(); }');
  }

  void _focusMyChild() {
    if (_useNaver) {
      _naverKey.currentState?.focusMyChild();
      return;
    }
    _controller?.runJavaScript('if (window.focusMyChild) { window.focusMyChild(); }');
  }

  void _openFullscreen() {
    if (widget.onToggleFullscreen != null) {
      widget.onToggleFullscreen!();
      return;
    }
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => KakaoMapFullscreenPage(
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

  String _generateHtml() {
    final centerLat = widget.academyLat ?? widget.busLat ?? (widget.stops.isNotEmpty ? widget.stops.first.latitude : 37.5580);
    final centerLng = widget.academyLng ?? widget.busLng ?? (widget.stops.isNotEmpty ? widget.stops.first.longitude : 126.8240);

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
        
        .stop-marker {
          background-color: #2563eb;
          color: white;
          border-radius: 50%;
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 11px;
          border: 2px solid white;
          box-shadow: 0 2px 5px rgba(0,0,0,0.25);
        }
        
        .my-child-marker {
          background: linear-gradient(135deg, #7c3aed, #4f46e5);
          color: #fef08a;
          border-radius: 50%;
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 16px;
          border: 3px solid #fef08a;
          box-shadow: 0 0 0 4px rgba(124, 58, 237, 0.4), 0 4px 10px rgba(0,0,0,0.3);
          position: relative;
        }
        
        .my-child-badge {
          position: absolute;
          top: -18px;
          left: 50%;
          transform: translateX(-50%);
          background: #7c3aed;
          color: white;
          font-size: 10px;
          font-weight: 800;
          padding: 1px 6px;
          border-radius: 8px;
          white-space: nowrap;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          border: 1px solid #fef08a;
        }
        
        .academy-marker {
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: white;
          border-radius: 20px;
          padding: 6px 12px;
          font-weight: 900;
          font-size: 12px;
          border: 2px solid white;
          box-shadow: 0 4px 12px rgba(220,38,38,0.45);
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        
        .last-stop-marker {
          background: linear-gradient(135deg, #ef4444, #b91c1c);
          color: white;
          border-radius: 16px;
          padding: 4px 10px;
          font-weight: 800;
          font-size: 11px;
          border: 2px solid white;
          box-shadow: 0 3px 8px rgba(239,68,68,0.4);
          white-space: nowrap;
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
        var polyline = null;
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

        // 기사 앱처럼 전체 경로를 그린다: 지나온 구간은 회색, 남은 구간은 파란색
        var routeLayer = L.layerGroup().addTo(map);
        function drawRoute(roadPath, progIdx, fallbackPoints) {
          routeLayer.clearLayers();
          polyline = null;
          if (roadPath && roadPath.length > 1) {
            var idx = Math.max(0, Math.min(progIdx || 0, roadPath.length - 1));
            if (idx > 0) {
              L.polyline(roadPath.slice(0, idx + 1), { color: '#94a3b8', weight: 6, opacity: 0.9 }).addTo(routeLayer);
            }
            var remain = roadPath.slice(idx);
            if (remain.length > 1) {
              L.polyline(remain, { color: '#1d4ed8', weight: 9, opacity: 0.85 }).addTo(routeLayer);
              polyline = L.polyline(remain, { color: '#3b82f6', weight: 5, opacity: 1.0 }).addTo(routeLayer);
            }
            return roadPath;
          }
          // 도로 경로가 아직 없으면 선을 그리지 않는다 (정류장끼리 이은 점선은 쓰지 않음)
          return [];
        }
        var lastFallbackPoints = [];

        window.updateRoutePath = function(roadPath, progIdx) {
          drawRoute(roadPath, progIdx, lastFallbackPoints);
        };

        window.initData = function(stops, points, acLat, acLng, acName, bLat, bLng, roadPath, progIdx) {
          var pts = [];
          var hasAcademy = (acLat && acLng);
          if (hasAcademy) {
            var acIcon = L.divIcon({
              className: '',
              html: '<div class="academy-marker">🏁 <b>[도착]</b> ' + (acName || '유치원') + '</div>',
              iconSize: [130, 30],
              iconAnchor: [65, 15]
            });
            L.marker([acLat, acLng], { icon: acIcon, zIndexOffset: 2000 })
              .bindPopup('<b>🏁 최종 도착지 (유치원)</b><br/>' + (acName || '유치원'))
              .addTo(map);
            pts.push([acLat, acLng]);
          }

          if (stops && stops.length) {
            stops.forEach(function(s, idx) {
              if (s.lat && s.lng) {
                pts.push([s.lat, s.lng]);
                var isLastStopWithoutAcademy = (!hasAcademy && idx === stops.length - 1);
                if (s.isMyChild) {
                  myChildLatLng = [s.lat, s.lng];
                  var myIcon = L.divIcon({
                    className: '',
                    html: '<div class="my-child-marker"><span class="my-child-badge">우리 아이</span>★</div>',
                    iconSize: [38, 38],
                    iconAnchor: [19, 19]
                  });
                  var marker = L.marker([s.lat, s.lng], { icon: myIcon, zIndexOffset: 1000 })
                    .bindPopup('<b>⭐ 우리 아이 탑승지</b><br/>' + (s.address || s.name))
                    .addTo(map);
                  marker.on('click', function() {
                    if (window.StopClickHandler) {
                      window.StopClickHandler.postMessage(JSON.stringify({ index: idx, name: s.name }));
                    }
                  });
                  marker.openPopup();
                } else if (isLastStopWithoutAcademy) {
                  var icon = L.divIcon({
                    className: '',
                    html: '<div class="last-stop-marker">🏁 [도착지] ' + (idx + 1) + '. ' + s.name + '</div>',
                    iconSize: [130, 28],
                    iconAnchor: [65, 14]
                  });
                  var m = L.marker([s.lat, s.lng], { icon: icon, zIndexOffset: 1500 })
                    .bindPopup('<b>🏁 최종 도착지 (' + (idx + 1) + '번 정류장)</b><br/>' + (s.address || s.name))
                    .addTo(map);
                  m.on('click', function() {
                    if (window.StopClickHandler) {
                      window.StopClickHandler.postMessage(JSON.stringify({ index: idx, name: s.name }));
                    }
                  });
                } else {
                  var icon = L.divIcon({
                    className: '',
                    html: '<div class="stop-marker">' + (idx + 1) + '</div>',
                    iconSize: [26, 26],
                    iconAnchor: [13, 13]
                  });
                  var m = L.marker([s.lat, s.lng], { icon: icon })
                    .bindPopup('<b>' + (idx + 1) + '번 경유지</b><br/>' + (s.address || s.name))
                    .addTo(map);
                  m.on('click', function() {
                    if (window.StopClickHandler) {
                      window.StopClickHandler.postMessage(JSON.stringify({ index: idx, name: s.name }));
                    }
                  });
                }
              }
            });
          }

          lastFallbackPoints = points || [];
          drawRoute(roadPath, progIdx, lastFallbackPoints).forEach(function(p) { pts.push(p); });

          if (bLat && bLng) {
            window.updateBus(bLat, bLng);
            pts.push([bLat, bLng]);
          }

          if (pts.length > 0) {
            allBounds = L.latLngBounds(pts);
            map.fitBounds(allBounds, { padding: [40, 40] });
          }
        };
      </script>
    </body>
    </html>
    ''';
  }

  @override
  Widget build(BuildContext context) {
    final viewPadding = MediaQuery.viewPaddingOf(context);

    return Stack(
      children: [
        // Map Container
        ClipRRect(
          borderRadius: BorderRadius.circular(widget.isFullScreen ? 0 : 20),
          child: ValueListenableBuilder<bool>(
            valueListenable: naverMapAvailable,
            builder: (context, naverOk, _) => (naverOk && !kIsWeb)
                ? _naverMap()
                : ((kIsWeb || _controller == null)
                    ? _buildWebPlaceholder()
                    : WebViewWidget(controller: _controller!)),
          ),
        ),

        // Controls Overlay
        Positioned(
          top: 12 + (widget.isFullScreen ? viewPadding.top : 0),
          right: 12 + (widget.isFullScreen ? viewPadding.right : 0),
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

              // 내 위치 (작은 빨간 점으로 표시)
              _buildControlBtn(
                icon: Icons.my_location,
                tooltip: '내 위치 보기',
                iconColor: const Color(0xFFEF4444),
                onTap: _goToMyLocation,
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
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.map, size: 48, color: Color(0xFF2563EB)),
            const SizedBox(height: 8),
            Text(
              widget.academyName ?? '실시간 셔틀 노선 지도',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF1E293B)),
            ),
            const SizedBox(height: 4),
            Text(
              '배정 경유지 ${widget.stops.length}개소 · 실시간 버스 위치 수신 중',
              style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: _openFullscreen,
              icon: const Icon(Icons.fullscreen, size: 16),
              label: const Text('전체화면으로 크게 보기'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2563EB),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class KakaoMapFullscreenPage extends StatefulWidget {
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
    // 전체화면 지도에서는 안드로이드 하단 버튼 줄(뒤로·홈·최근 앱)과 상태 표시줄을 숨긴다.
    // 화면 가장자리를 쓸어 올리면 잠깐 나타나고, 뒤로 가기는 위의 ← 버튼으로 한다.
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
        setState(() {
          _isCardDismissed = true;
        });
      }
    } catch (_) {}
  }

  Future<void> _dismissCardForToday() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
      await prefs.setString('hide_child_stop_card_date', today);
    } catch (_) {}
    if (mounted) {
      setState(() {
        _isCardDismissed = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final myStop = widget.stops.cast<RouteStop?>().firstWhere((s) => s?.isMyChild == true, orElse: () => null);
    final viewPadding = MediaQuery.viewPaddingOf(context);

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
                '${widget.myChildName} 원아 탑승 노선',
                style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
              ),
          ],
        ),
        backgroundColor: Colors.white,
        elevation: 1,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20, color: Color(0xFF0F172A)),
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
          // Fullscreen Map View
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
            ),
          ),

          // Bottom Info Card ("우리 아이 탑승 장소" / "탑승지 설정됨")
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
                          Row(
                            children: [
                              const Text(
                                '우리 아이 탑승 장소',
                                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF7C3AED)),
                              ),
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFEFF6FF),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  '총 ${widget.stops.length}개 정류장',
                                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF2563EB)),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            myStop?.address ?? widget.myChildAddress ?? (myStop?.name ?? '탑승지 설정됨'),
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    // Close button (X) to dismiss for today
                    InkWell(
                      onTap: _dismissCardForToday,
                      borderRadius: BorderRadius.circular(20),
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: const BoxDecoration(
                          color: Color(0xFFF1F5F9),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.close,
                          size: 16,
                          color: Color(0xFF64748B),
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
