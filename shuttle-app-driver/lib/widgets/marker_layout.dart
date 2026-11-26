import '../driver/geo.dart';

/// 지도 마커(정류장 번호·유치원·유턴)가 서로 가리지 않게 하는 계산, 그리고 지금 가는 구간을 나누는 계산.
/// 화면 그리기와 떨어져 있어서 테스트로 확인할 수 있다.

/// 유치원 이 거리(m) 안에 있는 정류장은 따로 마커를 찍지 않고 유치원 이름표 옆 번호표로 묶는다.
const double academyBadgeMeters = 40;

/// 유턴 표시가 정류장·유치원과 이 거리(m) 안이면 옆으로 비껴 놓는다.
const double markerNearMeters = 30;

/// [center] 에서 [meters] 안에 있는 정류장의 번호(목록 위치) 모음
List<int> stopsNearPoint(List<GeoPoint?> stops, GeoPoint center, {double meters = academyBadgeMeters}) {
  final out = <int>[];
  for (var i = 0; i < stops.length; i++) {
    final s = stops[i];
    if (s != null && distanceM(s, center) <= meters) out.add(i);
  }
  return out;
}

/// [p] 가 [others] 중 하나와 [meters] 안에 있는가
bool isNearAny(GeoPoint p, Iterable<GeoPoint> others, {double meters = markerNearMeters}) {
  for (final o in others) {
    if (distanceM(p, o) <= meters) return true;
  }
  return false;
}

/// 경로 [path] 에서 [fromIdx] 이후로 [target] 에 가장 가까운 점의 번호.
/// 거의 같은 거리(2m 이내)면 앞쪽 점을 고른다. (같은 길을 갔다 돌아올 때 먼저 만나는 쪽)
int nearestPathIndexFrom(List<GeoPoint> path, int fromIdx, GeoPoint target) {
  if (path.isEmpty) return 0;
  var best = fromIdx.clamp(0, path.length - 1);
  var bestD = distanceM(path[best], target);
  for (var j = best + 1; j < path.length; j++) {
    final d = distanceM(path[j], target);
    if (d < bestD - 2.0) {
      bestD = d;
      best = j;
    }
  }
  return best;
}

/// 경로를 지금 가는 구간과 나머지로 나눈 결과 (점 번호 범위, 양 끝 포함)
class RangeSplit {
  /// 지금 가는 구간 (없으면 null)
  final (int, int)? current;

  /// 그 뒤에 갈 구간 (없으면 null). 경계 점을 current 와 함께 써서 선이 끊기지 않는다.
  final (int, int)? later;
  const RangeSplit(this.current, this.later);
}

/// 점 번호 범위 [from]~[to] 를 [legEnd](지금 구간의 끝 점)에서 둘로 나눈다.
RangeSplit splitRangeAt(int from, int to, int legEnd) {
  (int, int)? cur;
  (int, int)? later;
  if (from <= legEnd) cur = (from, legEnd < to ? legEnd : to);
  if (to > legEnd) later = (from > legEnd ? from : legEnd, to);
  return RangeSplit(cur, later);
}
