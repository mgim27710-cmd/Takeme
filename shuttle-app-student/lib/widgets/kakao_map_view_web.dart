// ignore_for_file: avoid_web_libraries_in_flutter, deprecated_member_use
import 'dart:html' as html;
import 'dart:ui_web' as ui_web;
import 'package:flutter/material.dart';

class KakaoMapViewWeb extends StatefulWidget {
  final String htmlContent;
  final VoidCallback? onZoomIn;
  final VoidCallback? onZoomOut;
  final VoidCallback? onFitAll;
  final VoidCallback? onFocusMyChild;

  const KakaoMapViewWeb({
    super.key,
    required this.htmlContent,
    this.onZoomIn,
    this.onZoomOut,
    this.onFitAll,
    this.onFocusMyChild,
  });

  @override
  State<KakaoMapViewWeb> createState() => KakaoMapViewWebState();
}

class KakaoMapViewWebState extends State<KakaoMapViewWeb> {
  late final String _viewId;
  html.IFrameElement? _iframe;

  @override
  void initState() {
    super.initState();
    _viewId = 'kakao_web_map_${DateTime.now().millisecondsSinceEpoch}_$hashCode';

    _iframe = html.IFrameElement()
      ..id = 'iframe_$_viewId'
      ..srcdoc = widget.htmlContent
      ..style.border = 'none'
      ..style.width = '100%'
      ..style.height = '100%';

    ui_web.platformViewRegistry.registerViewFactory(
      _viewId,
      (int id) => _iframe!,
    );
  }

  @override
  void didUpdateWidget(covariant KakaoMapViewWeb oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.htmlContent != widget.htmlContent && _iframe != null) {
      _iframe!.srcdoc = widget.htmlContent;
    }
  }

  void runJs(String js) {
    if (_iframe?.contentWindow != null) {
      try {
        _iframe!.contentWindow!.postMessage({'action': 'eval', 'js': js}, '*');
      } catch (e) {
        debugPrint('[KakaoMapViewWeb] postMessage error: $e');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return HtmlElementView(viewType: _viewId);
  }
}
