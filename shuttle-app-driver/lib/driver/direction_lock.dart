/// 재탐색 방향 잠금.
///
/// 달리는 중에 재탐색 결과가 앞·뒤로 계속 뒤집히는 것을 막는다.
/// - 재탐색으로 안내 방향이 정해지면 [seconds]초 동안은 반대 방향(유턴)으로 뒤집는 새 경로를 받아들이지 않는다.
/// - 단, 차가 실제로 반대 방향으로 달리고 있으면(운전자가 정말 유턴했으면) 잠금과 상관없이 새 경로를 따라간다.
class DirectionLock {
  DirectionLock({this.seconds = 15, this.backwardDeg = 120});

  /// 잠금 시간(초). 재탐색 최소 간격(8초)보다 길어야 한 번은 확실히 버틴다.
  final int seconds;

  /// 두 방향이 이 각도 이상 어긋나면 '반대 방향'으로 본다.
  final double backwardDeg;

  double? _bearing;
  DateTime _until = DateTime.fromMillisecondsSinceEpoch(0);

  /// 지금 안내하는 방향을 잠근다. 방향을 알 수 없으면(null) 잠그지 않는다.
  void lock(double? bearing, DateTime now) {
    if (bearing == null) return;
    _bearing = bearing;
    _until = now.add(Duration(seconds: seconds));
  }

  void clear() {
    _bearing = null;
    _until = DateTime.fromMillisecondsSinceEpoch(0);
  }

  bool isActive(DateTime now) => _bearing != null && now.isBefore(_until);

  /// 새 경로가 잠긴 방향을 뒤집으려는가?
  /// [newStartBearing]: 새 경로가 출발하는 방향, [vehicleHeading]: 차가 실제로 향하는 방향(GPS)
  bool blocksFlip({required DateTime now, required double? newStartBearing, required double? vehicleHeading}) {
    if (!isActive(now) || newStartBearing == null) return false;
    final locked = _bearing!;
    if (angleDiffDeg(newStartBearing, locked) < backwardDeg) return false; // 같은 방향이면 문제없다
    // 차가 이미 반대로 달리고 있으면 진짜 유턴이므로 새 경로를 따라간다
    if (vehicleHeading != null && angleDiffDeg(vehicleHeading, locked) >= backwardDeg) return false;
    return true;
  }
}

/// 두 방향(도, 0~360)의 차이 (0~180)
double angleDiffDeg(double a, double b) {
  var d = (a - b) % 360;
  if (d < 0) d += 360;
  return d > 180 ? 360 - d : d;
}
