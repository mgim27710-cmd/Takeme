import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../models/route_model.dart';
import 'kakao_map_view_stub.dart' if (dart.library.html) 'kakao_map_view_web.dart';

class KakaoMapView extends StatefulWidget {
  final List<RouteStop> stops;
  final List<Map<String, dynamic>> routePoints;
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
    }
  }

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
          ${widget.myChildLng ?? 'null'}
        );
      }
    ''';
    _controller?.runJavaScript(js);
  }

  void _zoomIn() {
    _runJs('if (window.zoomIn) { window.zoomIn(); }');
  }

  void _zoomOut() {
    _runJs('if (window.zoomOut) { window.zoomOut(); }');
  }

  void _fitAll() {
    _runJs('if (window.fitAll) { window.fitAll(); }');
  }

  void _focusMyChild() {
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
            window.initData($stopsJson, $pointsJson, $acLat, $acLng, $acName, $bLat, $bLng, ${widget.isGohome}, ${widget.myChildLat ?? 'null'}, ${widget.myChildLng ?? 'null'});
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

        window.initData = function(stops, points, acLat, acLng, acName, bLat, bLng, isGohome, childLatArg, childLngArg) {
          var pts = [];
          var targetAcLat = (acLat && acLat > 30) ? acLat : 37.558274;
          var targetAcLng = (acLng && acLng > 120) ? acLng : 126.824116;
          var targetAcName = acName || '경동 부속 유치원';

          // 내 원아 정류장 또는 지정 좌표 찾기
          var myStop = null;
          if (stops && stops.length) {
            for (var i = 0; i < stops.length; i++) {
              if (stops[i].lat && stops[i].lng && stops[i].isMyChild) {
                myStop = stops[i];
                break;
              }
            }
            if (!myStop && stops[0].lat && stops[0].lng) {
              myStop = stops[0];
            }
          }

          // 탑승지 좌표 확정: 명시적 전달값 > 정류장 값 > 기본 탑승지(약 1km 떨어진 등촌삼거리)
          var resolvedChildLat = childLatArg || (myStop ? myStop.lat : null);
          var resolvedChildLng = childLngArg || (myStop ? myStop.lng : null);
          if (!resolvedChildLat || !resolvedChildLng || resolvedChildLat < 30) {
            resolvedChildLat = 37.566762;
            resolvedChildLng = 126.826972;
          }

          // 만약 유치원 좌표와 탑승지 좌표가 거의 같다면 두 점이 겹치지 않게 분리(약 900m 분리)
          if (Math.abs(resolvedChildLat - targetAcLat) < 0.0005 && Math.abs(resolvedChildLng - targetAcLng) < 0.0005) {
            resolvedChildLat = 37.566762;
            resolvedChildLng = 126.826972;
          }

          var childPlaceName = (myStop && (myStop.address || myStop.name)) ? (myStop.address || myStop.name) : '등촌 현대아이파크 정문 앞';

          if (isGohome) {
            // ================= 하원 모드: 출발지(유치원) -> 도착지(집/하차지) =================
            // 1. 타는 곳 (출발지: 유치원) 점 마커
            var pickupIcon = L.divIcon({
              className: '',
              html: '<div class="pickup-point-dot"><span class="point-label pickup-label">타는 곳</span></div>',
              iconSize: [26, 26],
              iconAnchor: [13, 13]
            });
            L.marker([targetAcLat, targetAcLng], { icon: pickupIcon, zIndexOffset: 800 })
              .bindPopup('<b>🏫 타는 곳 (출발지)</b><br/>' + targetAcName + '<br/>하원 차량 탑승 (16:00)')
              .addTo(map);
            pts.push([targetAcLat, targetAcLng]);

            // 2. 도착지 (하차지: 원아 하차 장소) 점 마커
            myChildLatLng = [resolvedChildLat, resolvedChildLng];
            var destIcon = L.divIcon({
              className: '',
              html: '<div class="dest-point-dot"><span class="point-label dest-label">도착지</span></div>',
              iconSize: [26, 26],
              iconAnchor: [13, 13]
            });
            var destMarker = L.marker([resolvedChildLat, resolvedChildLng], { icon: destIcon, zIndexOffset: 1200 })
              .bindPopup('<b>📍 도착지 (하원 하차 완료)</b><br/>' + childPlaceName + '<br/>예정 시각: 16:30 종료')
              .addTo(map);
            destMarker.openPopup();
            pts.push([resolvedChildLat, resolvedChildLng]);
          } else {
            // ================= 등원 모드: 출발지(탑승지) -> 도착지(유치원) =================
            // 1. 타는 곳 (출발지: 원아 탑승지) 점 마커
            myChildLatLng = [resolvedChildLat, resolvedChildLng];
            var pickupIcon = L.divIcon({
              className: '',
              html: '<div class="pickup-point-dot"><span class="point-label pickup-label">타는 곳</span></div>',
              iconSize: [26, 26],
              iconAnchor: [13, 13]
            });
            var pickupMarker = L.marker([resolvedChildLat, resolvedChildLng], { icon: pickupIcon, zIndexOffset: 1200 })
              .bindPopup('<b>📍 타는 곳 (출발지)</b><br/>' + childPlaceName + '<br/>탑승 예정 시각: 08:40')
              .addTo(map);
            pickupMarker.openPopup();
            pts.push([resolvedChildLat, resolvedChildLng]);

            // 2. 도착지 (도착지: 유치원) 점 마커
            var destIcon = L.divIcon({
              className: '',
              html: '<div class="dest-point-dot"><span class="point-label dest-label">도착지</span></div>',
              iconSize: [26, 26],
              iconAnchor: [13, 13]
            });
            L.marker([targetAcLat, targetAcLng], { icon: destIcon, zIndexOffset: 800 })
              .bindPopup('<b>🏫 도착지: ' + targetAcName + '</b><br/>등원 완료 (09:00)')
              .addTo(map);
            pts.push([targetAcLat, targetAcLng]);
          }

          // 3. 네비게이션 도로 경로선 (출발지에서 도착지까지 기사 앱 네비게이션 기반으로 연결)
          var gotoRoadPoints = [[37.566762,126.826972],[37.566711,126.827658],[37.566691,126.827888],[37.56653,126.827866],[37.565986,126.827793],[37.564488,126.827594],[37.564377,126.827578],[37.56436,126.827766],[37.564349,126.827873],[37.564267,126.828741],[37.564246,126.82896],[37.56424,126.829017],[37.564128,126.830201],[37.56409,126.830599],[37.56407,126.83082],[37.564056,126.830968],[37.563992,126.831649],[37.563961,126.831977],[37.563868,126.832976],[37.56381,126.833452],[37.563727,126.833632],[37.563676,126.833721],[37.563625,126.833782],[37.563618,126.83379],[37.563541,126.83385],[37.563399,126.833934],[37.563156,126.833897],[37.562493,126.833798],[37.561417,126.833639],[37.561255,126.833616],[37.561268,126.833487],[37.561278,126.83338],[37.56135,126.832654],[37.561477,126.831351],[37.561537,126.830743],[37.561569,126.830411],[37.56157,126.830392],[37.561583,126.83026],[37.561594,126.830142],[37.561599,126.830092],[37.561647,126.829585],[37.561751,126.828481],[37.561789,126.828061],[37.561831,126.827654],[37.561849,126.827453],[37.561857,126.827385],[37.561875,126.827194],[37.561895,126.826978],[37.561904,126.826883],[37.562013,126.825652],[37.561049,126.825501],[37.560333,126.825389],[37.562013,126.825652],[37.561904,126.826883],[37.561895,126.826978],[37.561875,126.827194],[37.561725,126.82717],[37.561303,126.827104],[37.560882,126.827038],[37.560713,126.827011],[37.560271,126.826942],[37.560007,126.826905],[37.55991,126.826889],[37.55978,126.826863],[37.559612,126.826845],[37.559456,126.826825],[37.55939,126.82682],[37.559172,126.826798],[37.558931,126.826773],[37.558205,126.826686],[37.558048,126.826667],[37.558071,126.826439],[37.558124,126.825877],[37.558171,126.825768],[37.5582,126.825406],[37.558223,126.825267],[37.558238,126.825244],[37.558246,126.825216],[37.558245,126.825186],[37.558237,126.825159],[37.558245,126.824988],[37.558303,126.824447],[37.558368,126.823784],[37.55838,126.823692],[37.558393,126.82364],[37.558418,126.823625],[37.558437,126.8236],[37.55845,126.823569],[37.558454,126.823535],[37.558449,126.8235],[37.558434,126.823468],[37.558413,126.823445],[37.558387,126.823431],[37.558358,126.82343],[37.558331,126.823439],[37.558308,126.82346],[37.558291,126.823489],[37.558284,126.823518],[37.558283,126.823548],[37.558289,126.823577],[37.5583,126.823603],[37.558317,126.823624],[37.55832,126.823671],[37.558309,126.823772],[37.558274,126.824116]];
          var gohomeRoadPoints = [[37.558274,126.824116],[37.558242,126.82443],[37.558181,126.824979],[37.558175,126.825029],[37.558156,126.825121],[37.558136,126.825135],[37.55812,126.825157],[37.558111,126.825185],[37.558111,126.825216],[37.55812,126.825245],[37.558136,126.825269],[37.558137,126.825393],[37.558109,126.825764],[37.558124,126.825877],[37.558071,126.826439],[37.558048,126.826667],[37.558205,126.826686],[37.558931,126.826773],[37.559172,126.826798],[37.55939,126.82682],[37.559456,126.826825],[37.559612,126.826845],[37.55978,126.826863],[37.55991,126.826889],[37.560007,126.826905],[37.560271,126.826942],[37.560713,126.827011],[37.560882,126.827038],[37.561303,126.827104],[37.561725,126.82717],[37.561875,126.827194],[37.561895,126.826978],[37.561904,126.826883],[37.562013,126.825652],[37.561049,126.825501],[37.560333,126.825389],[37.562013,126.825652],[37.561904,126.826883],[37.561895,126.826978],[37.561875,126.827194],[37.561857,126.827385],[37.561849,126.827453],[37.561831,126.827654],[37.561789,126.828061],[37.561751,126.828481],[37.561647,126.829585],[37.561599,126.830092],[37.561594,126.830142],[37.561583,126.83026],[37.56157,126.830392],[37.561569,126.830411],[37.561537,126.830743],[37.561477,126.831351],[37.56135,126.832654],[37.561278,126.83338],[37.561268,126.833487],[37.561255,126.833616],[37.561417,126.833639],[37.562493,126.833798],[37.563156,126.833897],[37.563399,126.833934],[37.563653,126.833994],[37.563775,126.83401],[37.563784,126.833865],[37.563788,126.833807],[37.56381,126.833452],[37.563868,126.832976],[37.563961,126.831977],[37.563992,126.831649],[37.564056,126.830968],[37.56407,126.83082],[37.56409,126.830599],[37.564128,126.830201],[37.56424,126.829017],[37.564246,126.82896],[37.564267,126.828741],[37.564349,126.827873],[37.56436,126.827766],[37.564377,126.827578],[37.564488,126.827594],[37.565986,126.827793],[37.56653,126.827866],[37.566691,126.827888],[37.566711,126.827658],[37.566762,126.826972]];

          var navPoints = isGohome ? gohomeRoadPoints : ((points && points.length > 5) ? points : gotoRoadPoints);

          if (navPoints && navPoints.length > 1) {
            // 네비게이션 경로 테두리선 (기사 앱 네비게이션 기반 굵은 안내선)
            L.polyline(navPoints, {
              color: '#1d4ed8',
              weight: 9,
              opacity: 0.85,
              lineJoin: 'round',
              lineCap: 'round'
            }).addTo(map);

            // 네비게이션 경로 주행선 (기사 앱 로열 블루)
            L.polyline(navPoints, {
              color: '#3b82f6',
              weight: 5,
              opacity: 1.0,
              lineJoin: 'round',
              lineCap: 'round'
            }).addTo(map);

            navPoints.forEach(function(p) { pts.push(p); });
          }

          // 4. 버스 위치
          if (bLat && bLng) {
            window.updateBus(bLat, bLng);
            pts.push([bLat, bLng]);
          }

          // 5. 두 점(타는 곳, 도착지)에 맞추어 bounds 설정
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
              : (_controller == null
                  ? _buildWebPlaceholder()
                  : WebViewWidget(controller: _controller!)),
        ),

        // Controls Overlay
        Positioned(
          top: 12,
          right: 12,
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

class KakaoMapFullscreenPage extends StatelessWidget {
  final bool isGohome;
  final List<RouteStop> stops;
  final List<Map<String, dynamic>> routePoints;
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
    this.busLat,
    this.busLng,
    this.academyLat,
    this.academyLng,
    this.academyName,
    this.myChildName,
    this.myChildAddress,
  });

  @override
  Widget build(BuildContext context) {
    final myStop = stops.cast<RouteStop?>().firstWhere((s) => s?.isMyChild == true, orElse: () => null);

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              academyName ?? '유치원 통학차량 실시간 지도',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
            ),
            if (myChildName != null)
              Text(
                '$myChildName 원아 탑승 노선',
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
              stops: stops,
              routePoints: routePoints,
              busLat: busLat,
              busLng: busLng,
              academyLat: academyLat,
              academyLng: academyLng,
              academyName: academyName,
              myChildName: myChildName,
              myChildAddress: myChildAddress,
              isFullScreen: true,
              isGohome: isGohome,
            ),
          ),

          // Bottom Info Card
          Positioned(
            left: 16,
            right: 16,
            bottom: 24,
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
                                '총 ${stops.length}개 정류장',
                                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF2563EB)),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          myStop?.address ?? myChildAddress ?? (myStop?.name ?? '탑승지 설정됨'),
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
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
