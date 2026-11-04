import '../driver/geo.dart';
import 'nav_map_view_mobile.dart' if (dart.library.html) 'nav_map_view_web.dart' as platform_impl;

abstract class NavMapController {
  factory NavMapController() => platform_impl.createNavMapController();

  void setRoutes({
    List<GeoPoint>? primary,
    List<GeoPoint>? alternate,
    required List<Map<String, dynamic>> stops,
    GeoPoint? academy,
    bool fit = true,
  });

  void setMyLocation(GeoPoint p);
  void moveBus(GeoPoint p, {bool follow = true});
  void hideBus();
  void centerOn(GeoPoint p, {int zoom = 17});
  void markStopPassed(int index);
  void fitAll();
}
