// ignore_for_file: avoid_web_libraries_in_flutter, deprecated_member_use
import 'dart:async';
import 'dart:convert';
import 'dart:html' as html;
import 'dart:ui_web' as ui_web;

import 'package:flutter/material.dart';
import '../driver/geo.dart';
import 'nav_map_controller.dart';

class NavMapControllerWeb implements NavMapController {
  final String viewId;
  html.IFrameElement? _iframe;
  bool _ready = false;
  final List<String> _pending = [];
  StreamSubscription<html.MessageEvent>? _sub;

  @override
  VoidCallback? onUserDrag;

  NavMapControllerWeb({required this.viewId}) {
    _initIframe();
  }

  void _initIframe() {
    _iframe = html.IFrameElement()
      ..id = 'iframe_$viewId'
      ..src = 'nav_map.html'
      ..style.border = 'none'
      ..style.width = '100%'
      ..style.height = '100%';

    ui_web.platformViewRegistry.registerViewFactory(
      viewId,
      (int id) => _iframe!,
    );

    _sub = html.window.onMessage.listen((event) {
      final data = event.data;
      if (data is Map) {
        if (data['type'] == 'ready') {
          _ready = true;
          _flushPending();
        } else if (data['type'] == 'drag') {
          onUserDrag?.call();
        }
      }
    });

    Timer(const Duration(milliseconds: 1000), () {
      if (!_ready) {
        _ready = true;
        _flushPending();
      }
    });
  }

  void _run(String js) {
    if (_ready && _iframe?.contentWindow != null) {
      try {
        _iframe!.contentWindow!.postMessage({'action': 'eval', 'js': js}, '*');
      } catch (e) {
        debugPrint('[NavMapWeb] postMessage error: $e');
      }
    } else {
      _pending.add(js);
    }
  }

  void _flushPending() {
    if (_iframe?.contentWindow == null) return;
    for (final js in _pending) {
      try {
        _iframe!.contentWindow!.postMessage({'action': 'eval', 'js': js}, '*');
      } catch (e) {
        debugPrint('[NavMapWeb] flush error: $e');
      }
    }
    _pending.clear();
  }

  String _pts(List<GeoPoint>? p) => jsonEncode(p?.map((e) => e.toJson()).toList());

  @override
  void setRoutes({
    List<GeoPoint>? primary,
    List<TrafficSegment>? traffic,
    List<GeoPoint>? alternate,
    required List<Map<String, dynamic>> stops,
    GeoPoint? academy,
    bool fit = true,
  }) {
    final t = jsonEncode(traffic?.map((e) => e.toJson()).toList());
    _run('window.setRoutes(${_pts(primary)}, $t, ${_pts(alternate)}, ${jsonEncode(stops)}, '
        '${jsonEncode(academy?.toJson())}, $fit);');
  }

  @override
  void moveMe(GeoPoint p, {double? heading, bool follow = false, bool navigating = false}) =>
      _run('window.moveMe(${p.lat}, ${p.lng}, ${heading ?? "null"}, $follow, $navigating);');

  @override
  void centerOn(GeoPoint p, {int zoom = 16}) => _run('window.centerOn(${p.lat}, ${p.lng}, $zoom);');

  @override
  void markStopPassed(int index) => _run('window.markStop($index);');

  @override
  void fitAll() => _run('window.fitAll();');

  @override
  void setHeadingUp(bool enabled) => _run('window.setHeadingUp($enabled);');

  @override
  void resetZoom() => _run('window.resetZoom();');

  @override
  void setMyLocation(GeoPoint p) => moveMe(p);

  @override
  void moveBus(GeoPoint p, {bool follow = true}) => moveMe(p, follow: follow);

  @override
  void hideBus() {}

  @override
  void setInteractive(bool interactive) {
    if (_iframe != null) {
      _iframe!.style.pointerEvents = interactive ? 'auto' : 'none';
    }
  }

  void dispose() {
    _sub?.cancel();
  }
}

int _webMapSeq = 0;
NavMapController createNavMapController() {
  _webMapSeq++;
  return NavMapControllerWeb(viewId: 'takeme-nav-map-$_webMapSeq');
}

class NavMapViewPlatform extends StatelessWidget {
  final NavMapController controller;
  const NavMapViewPlatform({super.key, required this.controller});

  @override
  Widget build(BuildContext context) {
    if (controller is NavMapControllerWeb) {
      return HtmlElementView(viewType: (controller as NavMapControllerWeb).viewId);
    }
    return const SizedBox();
  }
}
