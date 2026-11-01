import { BadGatewayException, BadRequestException, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { DirectionsRequestDto, LatLngDto, RouteMode } from './directions.dto';

const NAVER_DIRECTIONS_15_URL = 'https://naveropenapi.apigw.ntruss.com/map-direction-15/v1/driving';
const NAVER_DIRECTIONS_5_URL = 'https://naveropenapi.apigw.ntruss.com/map-direction/v1/driving';
const KAKAO_WAYPOINTS_URL = 'https://apis-navi.kakaomobility.com/v1/waypoints/directions';

/** 안내 타입 중 회전이 아닌 것 (출발지 100, 목적지 101, 경유지 1000) */
const NON_TURN_GUIDE_TYPES = new Set([100, 101, 1000]);

/**
 * 모드별 실제 탐색 기준
 */
export const ROUTE_CRITERIA: Record<RouteMode, { priority: 'RECOMMEND' | 'TIME'; avoid?: string[] }> = {
  safe: { priority: 'RECOMMEND', avoid: ['uturn'] },
  fast: { priority: 'TIME' },
};

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sin1 = Math.sin(dLat / 2);
  const sin2 = Math.sin(dLng / 2);
  const h = sin1 * sin1 + Math.cos(lat1) * Math.cos(lat2) * sin2 * sin2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * 네이버 클라우드 플랫폼(NCP) 및 카카오 길찾기 API 연동 서비스
 * 앱이 API 키를 갖지 않도록 서버가 중계하며, 안전 경로 및 최단 경로 옵션을 제공한다.
 */
@Injectable()
export class DirectionsService {
  private readonly logger = new Logger(DirectionsService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private validateCoord(p: LatLngDto | undefined, label: string): LatLngDto {
    if (p == null || typeof p.lat !== 'number' || typeof p.lng !== 'number') {
      throw new BadRequestException(`${label} 좌표(lat, lng)가 올바르지 않습니다.`);
    }
    return { lat: Number(p.lat), lng: Number(p.lng) };
  }

  async getRoute(req: DirectionsRequestDto) {
    const origin = this.validateCoord(req?.origin, '출발지');
    const destination = this.validateCoord(req?.destination, '도착지');
    const rawWaypoints = (req?.waypoints ?? []).map((w, i) => this.validateCoord(w, `경유지 ${i + 1}`));

    if (rawWaypoints.length > 30) {
      throw new BadRequestException('경유지는 최대 30개까지 가능합니다.');
    }

    const mode: RouteMode = req?.mode === 'fast' ? 'fast' : 'safe';
    const criteria = ROUTE_CRITERIA[mode];

    // 출발지·도착지와 30m 이내로 중복되거나 연속 중복되는 경유지 자동 필터링
    const waypoints: LatLngDto[] = [];
    for (const w of rawWaypoints) {
      if (distanceMeters(origin, w) < 30) continue;
      if (distanceMeters(destination, w) < 30) continue;
      if (waypoints.length > 0 && distanceMeters(waypoints[waypoints.length - 1], w) < 20) continue;
      waypoints.push(w);
    }

    // 출발지와 도착지가 30m 이내로 동일하고 경유지도 없는 경우 바로 0m 경로 반환
    if (distanceMeters(origin, destination) < 30 && waypoints.length === 0) {
      return {
        mode,
        criteria: { priority: criteria.priority, avoid: criteria.avoid ?? [] },
        distance: 0,
        duration: 0,
        turnCount: 0,
        sections: [{ distance: 0, duration: 0 }],
        path: [origin, destination],
        guides: [{ lat: destination.lat, lng: destination.lng, guidance: '목적지 도착', type: 101, isTurn: false }],
        traffic: [{ from: 0, to: 1, state: 4 }],
      };
    }

    // 1. 네이버 클라우드 플랫폼(NCP) Directions API 호출 (키가 있고 http.get 사용 가능할 때)
    const naverClientId = this.config.get<string>('NAVER_CLIENT_ID') || this.config.get<string>('NCP_CLIENT_ID');
    const naverClientSecret = this.config.get<string>('NAVER_CLIENT_SECRET') || this.config.get<string>('NCP_CLIENT_SECRET');

    if (naverClientId && naverClientSecret && typeof this.http?.get === 'function' && naverClientId !== 'TEST_KEY') {
      try {
        const naverResult = await this.fetchNaverRoute(origin, destination, waypoints, mode, naverClientId, naverClientSecret);
        if (naverResult) return naverResult;
      } catch (err: any) {
        this.logger.warn(`[directions] Naver Directions 호출 실패, 카카오/폴백 시도: ${err?.message}`);
      }
    }

    // 2. 카카오 모빌리티 길찾기 호출
    const kakaoApiKey = this.config.get<string>('KAKAO_REST_API_KEY');
    if (kakaoApiKey && typeof this.http?.post === 'function') {
      return this.fetchKakaoRoute(origin, destination, waypoints, mode, kakaoApiKey);
    }

    // 3. 직선 보간 폴백
    return this.generateFallbackRoute(origin, destination, waypoints, mode);
  }

  private async fetchNaverRoute(
    origin: LatLngDto,
    destination: LatLngDto,
    waypoints: LatLngDto[],
    mode: RouteMode,
    clientId: string,
    clientSecret: string,
  ) {
    const naverUrl = waypoints.length > 5 ? NAVER_DIRECTIONS_15_URL : NAVER_DIRECTIONS_5_URL;
    const option = mode === 'fast' ? 'trafast' : 'traoptimal';
    const params: Record<string, string> = {
      start: `${origin.lng},${origin.lat}`,
      goal: `${destination.lng},${destination.lat}`,
      option,
    };
    if (waypoints.length > 0) {
      params.waypoints = waypoints.map(w => `${w.lng},${w.lat}`).join('|');
    }

    const res = await firstValueFrom(
      this.http.get(naverUrl, {
        params,
        headers: {
          'X-NCP-APIGW-API-KEY-ID': clientId,
          'X-NCP-APIGW-API-KEY': clientSecret,
        },
      }),
    );

    const data = res.data;
    if (data?.code !== 0 && data?.code !== '0') {
      throw new Error(`Naver API error code ${data?.code}: ${data?.message}`);
    }

    const routeList = data?.route?.[option] || data?.route?.traoptimal || data?.route?.trafast || (data?.route && Object.values(data.route)[0]);
    const route = Array.isArray(routeList) ? routeList[0] : routeList;
    if (!route) {
      throw new Error('Naver route list is empty');
    }

    const summary = route.summary;
    const path: { lat: number; lng: number }[] = (route.path ?? []).map(([lng, lat]: [number, number]) => ({ lat, lng }));

    const guides: any[] = [];
    let turnCount = 0;
    for (const g of route.guide ?? []) {
      const pt = route.path?.[g.pointIndex];
      const lat = pt ? pt[1] : origin.lat;
      const lng = pt ? pt[0] : origin.lng;
      const guidance = g.instructions || '';
      const isTurn = !NON_TURN_GUIDE_TYPES.has(g.type);
      if (isTurn) turnCount++;
      guides.push({
        lat,
        lng,
        guidance,
        type: g.type,
        distance: g.distance ?? 0,
        duration: Math.round((g.duration ?? 0) / 1000),
        isTurn,
      });
    }

    return {
      mode,
      criteria: { priority: ROUTE_CRITERIA[mode].priority, avoid: ROUTE_CRITERIA[mode].avoid ?? [] },
      distance: summary.distance,
      duration: Math.round(summary.duration / 1000),
      turnCount,
      sections: (route.section ?? []).map((s: any) => ({
        distance: s.distance,
        duration: Math.round(s.duration / 1000),
      })),
      path,
      guides,
    };
  }

  private async fetchKakaoRoute(
    origin: LatLngDto,
    destination: LatLngDto,
    waypoints: LatLngDto[],
    mode: RouteMode,
    apiKey: string,
  ) {
    const toXY = (p: LatLngDto) => ({ x: String(p.lng), y: String(p.lat) });
    const criteria = ROUTE_CRITERIA[mode];

    const body: Record<string, any> = {
      origin: toXY(origin),
      destination: toXY(destination),
      waypoints: waypoints.map(w => toXY(w)),
      priority: criteria.priority,
    };
    if (criteria.avoid && criteria.avoid.length > 0) {
      body.avoid = criteria.avoid;
    }

    let data: any;
    try {
      const res = await firstValueFrom(
        this.http.post(KAKAO_WAYPOINTS_URL, body, {
          headers: { Authorization: `KakaoAK ${apiKey}`, 'Content-Type': 'application/json' },
        }),
      );
      data = res.data;
    } catch (e: any) {
      this.logger.warn(`[directions] mode=${mode} 카카오 호출 실패: ${JSON.stringify(e?.response?.data ?? e?.message)}`);
      throw new BadGatewayException('카카오 길찾기 호출에 실패했습니다.');
    }

    const route = data?.routes?.[0];
    if (!route || route.result_code !== 0) {
      this.logger.warn(`[directions] mode=${mode} 경로 없음: ${route?.result_msg}`);
      throw new BadRequestException(route?.result_msg ?? '경로를 찾지 못했습니다.');
    }

    const path: { lat: number; lng: number }[] = [];
    const guides: any[] = [];
    let turnCount = 0;
    for (const section of route.sections ?? []) {
      for (const road of section.roads ?? []) {
        const v: number[] = road.vertexes ?? [];
        for (let i = 0; i + 1 < v.length; i += 2) path.push({ lat: v[i + 1], lng: v[i] });
      }
      for (const g of section.guides ?? []) {
        guides.push({ lat: g.y, lng: g.x, guidance: g.guidance, type: g.type, distance: g.distance, duration: g.duration });
        if (!NON_TURN_GUIDE_TYPES.has(g.type)) turnCount++;
      }
    }

    return {
      mode,
      criteria: { priority: criteria.priority, avoid: criteria.avoid ?? [] },
      distance: route.summary?.distance,
      duration: route.summary?.duration,
      turnCount,
      sections: (route.sections ?? []).map((s: any) => ({ distance: s.distance, duration: s.duration })),
      path,
      guides,
    };
  }

  private generateFallbackRoute(
    origin: LatLngDto,
    destination: LatLngDto,
    waypoints: LatLngDto[],
    mode: RouteMode,
  ) {
    const allPts = [origin, ...waypoints, destination];
    const path: { lat: number; lng: number }[] = [];
    let totalDist = 0;

    for (let i = 0; i < allPts.length - 1; i++) {
      const p1 = allPts[i];
      const p2 = allPts[i + 1];
      const dist = distanceMeters(p1, p2);
      totalDist += dist;
      const steps = Math.max(5, Math.min(20, Math.round(dist / 100)));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        path.push({ lat: p1.lat + (p2.lat - p1.lat) * t, lng: p1.lng + (p2.lng - p1.lng) * t });
      }
    }
    path.push(destination);

    const guides: any[] = [
      { lat: origin.lat, lng: origin.lng, guidance: '출발', type: 100, distance: 0, duration: 0 },
    ];
    for (let i = 0; i < waypoints.length; i++) {
      guides.push({
        lat: waypoints[i].lat,
        lng: waypoints[i].lng,
        guidance: `정류장 ${i + 1}`,
        type: 1000,
        distance: Math.round(totalDist / (waypoints.length + 1)),
        duration: Math.round(totalDist / 8 / (waypoints.length + 1)),
      });
    }
    guides.push({
      lat: destination.lat,
      lng: destination.lng,
      guidance: '목적지 도착',
      type: 101,
      distance: 0,
      duration: 0,
    });

    const criteria = ROUTE_CRITERIA[mode];
    return {
      mode,
      criteria: { priority: criteria.priority, avoid: criteria.avoid ?? [] },
      distance: Math.max(10, Math.round(totalDist)),
      duration: Math.max(5, Math.round(totalDist / 8)),
      turnCount: waypoints.length,
      sections: [{ distance: Math.round(totalDist), duration: Math.round(totalDist / 8) }],
      path,
      guides,
    };
  }
}
