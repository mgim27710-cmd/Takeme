import 'package:flutter_test/flutter_test.dart';
import 'package:shuttle_app_driver/driver/geo.dart';

void main() {
  test('geo distance test', () {
    final d = distanceM(const GeoPoint(37.5, 127.0), const GeoPoint(37.501, 127.0));
    expect(d, closeTo(111.2, 1.0));
  });
}
