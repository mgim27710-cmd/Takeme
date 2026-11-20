/* eslint-disable react-hooks/rules-of-hooks */
// 지도 부품 모음: react-leaflet 과 같은 이름·같은 사용법으로 쓰되,
// 네이버 지도를 쓸 수 있으면 네이버 지도로, 아니면 기존 OpenStreetMap(react-leaflet)으로 그린다.
//
// 화면 코드는 `from 'react-leaflet'` 대신 `from './map/MapKit'` 에서 가져오기만 하면 된다.
// (네이버 사용 여부는 앱 시작 때 한 번 정해지고 바뀌지 않으므로, 아래의 조건부 훅 호출은 항상 같은 순서로 실행된다.)
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as RL from 'react-leaflet';
import { isNaverMapEnabled } from './naverMapLoader';

const NaverMapCtx = createContext(null);
const OverlayCtx = createContext(null);

const nm = () => window.naver.maps;
const toLatLng = (p) => {
  if (!p) return null;
  if (Array.isArray(p)) return new (nm().LatLng)(Number(p[0]), Number(p[1]));
  if (typeof p.lat === 'function') return p;
  return new (nm().LatLng)(Number(p.lat), Number(p.lng));
};
const valid = (p) => {
  const ll = Array.isArray(p) ? p : p && [p.lat, p.lng];
  return ll && Number.isFinite(Number(ll[0])) && Number.isFinite(Number(ll[1])) && (Number(ll[0]) !== 0 || Number(ll[1]) !== 0);
};

/** Leaflet 의 bounds(LatLngBounds 또는 [[lat,lng],...]) → 네이버 LatLngBounds */
function toNaverBounds(b) {
  let pts = [];
  if (Array.isArray(b)) pts = b;
  else if (b && typeof b.getSouthWest === 'function') {
    const sw = b.getSouthWest();
    const ne = b.getNorthEast();
    pts = [[sw.lat, sw.lng], [ne.lat, ne.lng]];
  }
  pts = pts.filter(valid);
  if (!pts.length) return null;
  let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity;
  for (const p of pts) {
    const [la, ln] = Array.isArray(p) ? p : [p.lat, p.lng];
    minLat = Math.min(minLat, la); maxLat = Math.max(maxLat, la);
    minLng = Math.min(minLng, ln); maxLng = Math.max(maxLng, ln);
  }
  return new (nm().LatLngBounds)(new (nm().LatLng)(minLat, minLng), new (nm().LatLng)(maxLat, maxLng));
}

const EVENT_MAP = { zoomend: 'zoom_changed', moveend: 'idle', click: 'click' };

/** 기존 코드가 쓰는 Leaflet 지도 기능(fitBounds·flyTo·setView·getZoom·on/off)을 네이버 지도로 흉내 낸다 */
function makeAdapter(map) {
  const listeners = new Map();
  return {
    raw: map,
    getZoom: () => map.getZoom(),
    setView: (center, zoom) => {
      if (!valid(center)) return;
      map.setCenter(toLatLng(center));
      if (zoom != null) map.setZoom(zoom, false);
    },
    flyTo: (center, zoom) => {
      if (!valid(center)) return;
      map.morph(toLatLng(center), zoom ?? map.getZoom());
    },
    fitBounds: (bounds, opts = {}) => {
      const nb = toNaverBounds(bounds);
      if (!nb) return;
      const pad = Array.isArray(opts.padding) ? opts.padding[0] : (opts.padding ?? 30);
      map.fitBounds(nb, { top: pad, right: pad, bottom: pad, left: pad });
      if (opts.maxZoom && map.getZoom() > opts.maxZoom) map.setZoom(opts.maxZoom, false);
    },
    getPanes: () => {
      const p = map.getPanes ? map.getPanes() : {};
      const el = map.getElement ? map.getElement() : null;
      return {
        ...p,
        overlayPane: p.overlayLayer || el,
        overlayLayer: p.overlayLayer || el,
      };
    },
    on: (names, fn) => {
      for (const n of String(names).split(/\s+/)) {
        const ev = EVENT_MAP[n];
        if (!ev) continue;
        const l = nm().Event.addListener(map, ev, fn);
        if (!listeners.has(fn)) listeners.set(fn, []);
        listeners.get(fn).push(l);
      }
    },
    off: (_names, fn) => {
      (listeners.get(fn) || []).forEach((l) => nm().Event.removeListener(l));
      listeners.delete(fn);
    },
  };
}

// ─────────────────────────── 지도 ───────────────────────────

function NaverMapContainer({ center, zoom = 14, className, style, children, scrollWheelZoom, dragging, doubleClickZoom, zoomControl }) {
  const divRef = useRef(null);
  const [ctx, setCtx] = useState(null);

  useEffect(() => {
    if (!divRef.current) return undefined;
    const map = new (nm().Map)(divRef.current, {
      center: valid(center) ? toLatLng(center) : new (nm().LatLng)(37.565, 126.975),
      zoom,
      scrollWheel: scrollWheelZoom !== false,
      draggable: dragging !== false,
      pinchZoom: dragging !== false,
      disableDoubleClickZoom: doubleClickZoom === false,
      zoomControl: zoomControl !== false,
      zoomControlOptions: { position: nm().Position.TOP_RIGHT, style: nm().ZoomControlStyle.SMALL },
      mapDataControl: false,
      scaleControl: false,
      logoControlOptions: { position: nm().Position.BOTTOM_LEFT },
    });
    setCtx({ map, adapter: makeAdapter(map) });
    return () => {
      setCtx(null);
      map.destroy();
    };
    // 지도는 처음에 한 번만 만든다 (중심을 바꾸려면 기존 코드처럼 key 를 바꾸거나 useMap 으로 이동)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={divRef} className={className} style={{ width: '100%', height: '100%', ...style }}>
      {ctx && <NaverMapCtx.Provider value={ctx}>{children}</NaverMapCtx.Provider>}
    </div>
  );
}

export function MapContainer(props) {
  return isNaverMapEnabled() ? <NaverMapContainer {...props} /> : <RL.MapContainer {...props} />;
}

export function TileLayer(props) {
  return isNaverMapEnabled() ? null : <RL.TileLayer {...props} />;
}

export function useMap() {
  if (!isNaverMapEnabled()) return RL.useMap();
  return useContext(NaverMapCtx).adapter;
}

export function useMapEvents(handlers) {
  if (!isNaverMapEnabled()) return RL.useMapEvents(handlers);
  const { map, adapter } = useContext(NaverMapCtx);
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    const l = nm().Event.addListener(map, 'click', (e) => {
      ref.current?.click?.({ latlng: { lat: e.coord.lat(), lng: e.coord.lng() } });
    });
    return () => nm().Event.removeListener(l);
  }, [map]);
  return adapter;
}

// ─────────────────────────── 마커 ───────────────────────────

/** Leaflet 아이콘(L.divIcon) → 네이버 마커 아이콘. 일반 아이콘(그림 파일)은 네이버 기본 마커를 쓴다. */
function toNaverIcon(icon) {
  const o = icon?.options;
  if (!o || o.html == null) return undefined;
  const [w, h] = o.iconSize || [24, 24];
  const [ax, ay] = o.iconAnchor || [w / 2, h / 2];
  const html = typeof o.html === 'string' ? o.html : o.html.outerHTML;
  return {
    content: `<div class="${o.className || ''}" style="width:${w}px;height:${h}px;">${html}</div>`,
    size: new (nm().Size)(w, h),
    anchor: new (nm().Point)(ax, ay),
  };
}

function NaverMarker({ position, icon, draggable, eventHandlers, zIndexOffset, children }) {
  const { map } = useContext(NaverMapCtx);
  const [marker, setMarker] = useState(null);
  const handlersRef = useRef(eventHandlers);
  handlersRef.current = eventHandlers;

  useEffect(() => {
    if (!valid(position)) return undefined;
    const m = new (nm().Marker)({ map, position: toLatLng(position), icon: toNaverIcon(icon), draggable: !!draggable, zIndex: zIndexOffset || 0 });
    const fake = () => ({ target: { getLatLng: () => ({ lat: m.getPosition().lat(), lng: m.getPosition().lng() }) } });
    const ls = [
      nm().Event.addListener(m, 'dragend', () => handlersRef.current?.dragend?.(fake())),
      nm().Event.addListener(m, 'click', () => handlersRef.current?.click?.(fake())),
    ];
    setMarker(m);
    return () => {
      ls.forEach((l) => nm().Event.removeListener(l));
      m.setMap(null);
      setMarker(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, valid(position)]);

  useEffect(() => {
    if (marker && valid(position)) marker.setPosition(toLatLng(position));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marker, Array.isArray(position) ? position[0] : position?.lat, Array.isArray(position) ? position[1] : position?.lng]);

  useEffect(() => {
    if (marker) marker.setIcon(toNaverIcon(icon));
  }, [marker, icon]);

  useEffect(() => {
    if (marker) marker.setDraggable(!!draggable);
  }, [marker, draggable]);

  const ov = useMemo(() => (marker ? { overlay: marker, kind: 'marker' } : null), [marker]);
  return ov ? <OverlayCtx.Provider value={ov}>{children}</OverlayCtx.Provider> : null;
}

export function Marker(props) {
  return isNaverMapEnabled() ? <NaverMarker {...props} /> : <RL.Marker {...props} />;
}

// ─────────────────────────── 구역(다각형) ───────────────────────────

function polygonOptions(pathOptions = {}) {
  const color = pathOptions.color || '#2563eb';
  return {
    strokeColor: color,
    strokeWeight: pathOptions.weight ?? 2.5,
    strokeOpacity: pathOptions.opacity ?? 1,
    // 만석 여부와 무관하게 사용자가 dashArray를 준 경우에만 점선, 기본은 원래대로 실선(solid)
    strokeStyle: pathOptions.dashArray ? 'shortdash' : 'solid',
    fillColor: pathOptions.fillColor || color,
    fillOpacity: pathOptions.fillOpacity ?? 0.2,
  };
}

function syncPolygonPattern(poly, pathOptions) {
  if (!poly) return;
  try {
    const el = (typeof poly.getElement === 'function' ? poly.getElement() : null) || poly._shapeElement;
    const isHatched = String(pathOptions?.fillColor || '').startsWith('url(');

    // SVG 상위 요소 찾기
    const svg = el?.ownerSVGElement || el?.closest?.('svg') || document.querySelector('svg');
    if (svg) {
      let defs = svg.querySelector('defs#naver-hatched-defs');
      if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.setAttribute('id', 'naver-hatched-defs');
        svg.insertBefore(defs, svg.firstChild);
      }
      const globalPatterns = document.querySelectorAll('svg pattern[id^="stripe-pattern-"]');
      globalPatterns.forEach((p) => {
        if (!defs.querySelector(`#${p.id}`)) {
          defs.appendChild(p.cloneNode(true));
        }
      });
    }

    if (el) {
      if (isHatched) {
        el.setAttribute('fill', pathOptions.fillColor);
        el.style.fill = pathOptions.fillColor;
        if (pathOptions.fillOpacity != null) {
          el.setAttribute('fill-opacity', String(pathOptions.fillOpacity));
          el.style.fillOpacity = String(pathOptions.fillOpacity);
        }
      }
      // 테두리가 점선으로 칠해지는 문제 방지: dashArray가 없으면 실선(none) 보장
      if (!pathOptions?.dashArray) {
        el.removeAttribute('stroke-dasharray');
        el.style.strokeDasharray = 'none';
      }
    }
  } catch (err) {
    // ignore
  }
}

function NaverPolygon({ positions, pathOptions, children }) {
  const { map } = useContext(NaverMapCtx);
  const [poly, setPoly] = useState(null);

  useEffect(() => {
    const p = new (nm().Polygon)({ map, paths: [[]], clickable: true, ...polygonOptions(pathOptions) });
    setPoly(p);
    syncPolygonPattern(p, pathOptions);
    const timer = setTimeout(() => syncPolygonPattern(p, pathOptions), 50);
    return () => {
      clearTimeout(timer);
      p.setMap(null);
      setPoly(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    if (poly) poly.setPaths([(positions || []).filter(valid).map(toLatLng)]);
  }, [poly, positions]);

  useEffect(() => {
    if (poly) {
      poly.setOptions(polygonOptions(pathOptions));
      syncPolygonPattern(poly, pathOptions);
      const timer = setTimeout(() => syncPolygonPattern(poly, pathOptions), 50);
      return () => clearTimeout(timer);
    }
  }, [poly, pathOptions]);

  useEffect(() => {
    if (!poly || !map) return undefined;
    const update = () => syncPolygonPattern(poly, pathOptions);
    const l1 = nm().Event.addListener(map, 'idle', update);
    const l2 = nm().Event.addListener(map, 'zoom_changed', update);
    return () => {
      nm().Event.removeListener(l1);
      nm().Event.removeListener(l2);
    };
  }, [poly, map, pathOptions]);

  const ov = useMemo(() => (poly ? { overlay: poly, kind: 'shape' } : null), [poly]);
  return ov ? <OverlayCtx.Provider value={ov}>{children}</OverlayCtx.Provider> : null;
}

export function Polygon(props) {
  return isNaverMapEnabled() ? <NaverPolygon {...props} /> : <RL.Polygon {...props} />;
}

// ─────────────────────────── 원 (Circle) ───────────────────────────

function NaverCircle({ center, radius, pathOptions, children }) {
  const { map } = useContext(NaverMapCtx);
  const [circ, setCirc] = useState(null);

  useEffect(() => {
    if (!valid(center)) return undefined;
    const c = new (nm().Circle)({
      map,
      center: toLatLng(center),
      radius: Number(radius) || 1000,
      clickable: Boolean(children),
      ...polygonOptions(pathOptions || {}),
    });
    setCirc(c);
    return () => {
      c.setMap(null);
      setCirc(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    if (circ && valid(center)) circ.setCenter(toLatLng(center));
  }, [circ, center]);

  useEffect(() => {
    if (circ && radius) circ.setRadius(Number(radius));
  }, [circ, radius]);

  useEffect(() => {
    if (circ && pathOptions) circ.setOptions(polygonOptions(pathOptions));
  }, [circ, pathOptions]);

  const ov = useMemo(() => (circ ? { overlay: circ, kind: 'shape' } : null), [circ]);
  return ov ? <OverlayCtx.Provider value={ov}>{children}</OverlayCtx.Provider> : null;
}

export function Circle(props) {
  return isNaverMapEnabled() ? <NaverCircle {...props} /> : <RL.Circle {...props} />;
}

// ─────────────────────────── 말풍선(팝업) ───────────────────────────

function NaverPopup({ children }) {
  const { map } = useContext(NaverMapCtx);
  const host = useContext(OverlayCtx);
  const [box] = useState(() => {
    const d = document.createElement('div');
    d.className = 'naver-popup';
    d.style.cssText = 'background:#fff;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.18);padding:8px 12px;font-size:13px;max-width:320px;';
    return d;
  });

  useEffect(() => {
    if (!host) return undefined;
    const iw = new (nm().InfoWindow)({
      content: box,
      borderWidth: 0,
      backgroundColor: 'transparent',
      disableAnchor: false,
      anchorColor: '#fff',
      anchorSize: new (nm().Size)(12, 8),
      pixelOffset: new (nm().Point)(0, -4),
    });
    const onOpen = nm().Event.addListener(host.overlay, 'click', (e) => {
      if (iw.getMap()) {
        iw.close();
        return;
      }
      if (host.kind === 'marker') iw.open(map, host.overlay);
      else iw.open(map, e.coord);
    });
    const onMapClick = nm().Event.addListener(map, 'click', () => iw.close());
    return () => {
      nm().Event.removeListener(onOpen);
      nm().Event.removeListener(onMapClick);
      iw.close();
    };
  }, [host, map, box]);

  return createPortal(children, box);
}

export function Popup(props) {
  return isNaverMapEnabled() ? <NaverPopup {...props} /> : <RL.Popup {...props} />;
}
