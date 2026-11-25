import 'geo.dart';

/// 정류장 방문 순서 정리.
///
/// 서버가 주는 순서는 '유치원에서 가까운 순서'라서 차가 지금 어디 있는지를 모른다.
/// 그래서 차가 산 반대편에 있으면 산을 두 번 가로지르는 식으로 크게 돌아가는 경로가 나온다.
/// 앱에서 차의 현재 위치(start)와 도착지(end, 보통 유치원)를 알고 있으니 여기서 다시 정한다.
///
/// 거리는 직선 거리다. 산·강 때문에 도로가 크게 돌아가는 곳에서는 틀릴 수 있다.

/// start → pts(순서대로) → end 를 이은 직선 거리 합 (m)
double pathLength(List<GeoPoint> pts, {GeoPoint? start, GeoPoint? end}) {
  var total = 0.0;
  GeoPoint? prev = start;
  for (final p in pts) {
    if (prev != null) total += distanceM(prev, p);
    prev = p;
  }
  if (prev != null && end != null) total += distanceM(prev, end);
  return total;
}

/// 순서(인덱스 목록)의 앞뒤를 바꿔 보며 더 짧아지면 받아들이는 다듬기. start·end 는 고정.
List<int> _improve(List<int> order, List<GeoPoint> pts, GeoPoint? start, GeoPoint? end) {
  final cur = List<int>.from(order);
  double len(List<int> o) => pathLength([for (final i in o) pts[i]], start: start, end: end);
  var best = len(cur);
  var improved = true;
  var guard = 0;
  while (improved && guard++ < 50) {
    improved = false;
    for (var i = 0; i < cur.length - 1; i++) {
      for (var j = i + 1; j < cur.length; j++) {
        final cand = [
          ...cur.sublist(0, i),
          ...cur.sublist(i, j + 1).reversed,
          ...cur.sublist(j + 1),
        ];
        final l = len(cand);
        if (l < best - 1.0) {
          cur
            ..clear()
            ..addAll(cand);
          best = l;
          improved = true;
        }
      }
    }
  }
  return cur;
}

/// 정류장 좌표 목록을 어떤 순서로 들를지 인덱스로 돌려준다.
/// 지금 순서 그대로 다듬은 것과, 가까운 곳부터 고른 것 중 짧은 쪽을 쓴다 (같으면 지금 순서 유지).
List<int> bestOrder(List<GeoPoint> pts, {GeoPoint? start, GeoPoint? end}) {
  final n = pts.length;
  final current = List<int>.generate(n, (i) => i);
  if (n <= 1) return current;

  // 1) 지금 순서에서 시작해 다듬기
  final fromCurrent = _improve(current, pts, start, end);

  // 2) 출발 위치에서 가까운 곳부터 고른 뒤 다듬기
  final remaining = List<int>.generate(n, (i) => i);
  final nn = <int>[];
  GeoPoint? at = start ?? end ?? pts[0];
  while (remaining.isNotEmpty) {
    var bi = 0;
    var bd = double.infinity;
    for (var k = 0; k < remaining.length; k++) {
      final d = distanceM(at!, pts[remaining[k]]);
      if (d < bd) {
        bd = d;
        bi = k;
      }
    }
    final pick = remaining.removeAt(bi);
    nn.add(pick);
    at = pts[pick];
  }
  final fromNearest = _improve(nn, pts, start, end);

  double len(List<int> o) => pathLength([for (final i in o) pts[i]], start: start, end: end);
  final lc = len(fromCurrent);
  final ln = len(fromNearest);
  // 눈에 띄게(1% 이상) 짧을 때만 순서를 바꾼다 → GPS 가 조금 흔들려도 번호가 계속 바뀌지 않는다
  return ln < lc * 0.99 ? fromNearest : fromCurrent;
}

/// 정해진 순서(seq)에 새 정류장 p 를 끼워 넣을 때, 돌아가는 거리가 가장 적은 자리(0 ~ seq.length)
int cheapestInsertIndex(List<GeoPoint> seq, GeoPoint p, {GeoPoint? start, GeoPoint? end}) {
  var bestIdx = seq.length;
  var bestExtra = double.infinity;
  final base = pathLength(seq, start: start, end: end);
  for (var i = 0; i <= seq.length; i++) {
    final cand = [...seq.sublist(0, i), p, ...seq.sublist(i)];
    final extra = pathLength(cand, start: start, end: end) - base;
    if (extra < bestExtra - 0.5) {
      bestExtra = extra;
      bestIdx = i;
    }
  }
  return bestIdx;
}
