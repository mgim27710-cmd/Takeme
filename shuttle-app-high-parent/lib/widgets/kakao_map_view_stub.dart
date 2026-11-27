import 'package:flutter/material.dart';

class KakaoMapViewWeb extends StatelessWidget {
  final String htmlContent;
  final bool isInteractive;
  final VoidCallback? onZoomIn;
  final VoidCallback? onZoomOut;
  final VoidCallback? onFitAll;
  final VoidCallback? onFocusMyChild;

  const KakaoMapViewWeb({
    super.key,
    required this.htmlContent,
    this.isInteractive = true,
    this.onZoomIn,
    this.onZoomOut,
    this.onFitAll,
    this.onFocusMyChild,
  });

  @override
  Widget build(BuildContext context) {
    return const SizedBox.shrink();
  }
}

