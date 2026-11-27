import 'package:flutter/material.dart';
import 'nav_map_controller.dart';
import 'nav_map_view_mobile.dart' if (dart.library.html) 'nav_map_view_web.dart' as platform_impl;

export 'nav_map_controller.dart';

class NavMapView extends StatelessWidget {
  final NavMapController controller;
  const NavMapView({super.key, required this.controller});

  @override
  Widget build(BuildContext context) {
    return platform_impl.NavMapViewPlatform(controller: controller);
  }
}
