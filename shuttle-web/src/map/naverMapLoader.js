// 네이버 지도(JavaScript API v3) 불러오기.
//
// 인증키(Client ID)는 코드에 적지 않고 환경변수 VITE_NAVER_MAP_CLIENT_ID 로 받는다.
//   - 내 컴퓨터:  shuttle-web/.env.local  (git 에 올라가지 않음, .env.example 참고)
//   - 서버 빌드:  서버의 shuttle-web/.env.local 또는 빌드할 때 환경변수로
// 키가 없거나, 네이버 인증에 실패하면(Web 서비스 URL 미등록 등) 기존 OpenStreetMap 지도로 표시한다.

const CLIENT_ID = (import.meta.env.VITE_NAVER_MAP_CLIENT_ID || '').trim();
const AUTH_FAIL_KEY = 'naverMapAuthFailed';

export function isNaverMapEnabled() {
  return typeof window !== 'undefined' && window.__useNaverMap === true;
}

function authFailedBefore() {
  try {
    return sessionStorage.getItem(AUTH_FAIL_KEY) === '1';
  } catch {
    return false;
  }
}

/** 앱을 그리기 전에 한 번 부른다. 네이버 지도를 쓸 수 있으면 true. */
export function loadNaverMap(timeoutMs = 6000) {
  if (typeof window === 'undefined') return Promise.resolve(false);
  window.__useNaverMap = false;
  if (!CLIENT_ID || authFailedBefore()) {
    if (!CLIENT_ID) console.info('[map] VITE_NAVER_MAP_CLIENT_ID 가 없어 OpenStreetMap 을 사용합니다.');
    return Promise.resolve(false);
  }

  // 네이버가 인증 실패 시 부르는 함수: 이번 탭에서는 OpenStreetMap 으로 다시 그린다
  window.navermap_authFailure = () => {
    console.warn('[map] 네이버 지도 인증 실패: NCP 콘솔의 Web 서비스 URL 에 지금 주소(' + window.location.origin + ')가 등록돼 있는지 확인하세요.');
    try {
      sessionStorage.setItem(AUTH_FAIL_KEY, '1');
    } catch {
      /* 무시 */
    }
    window.location.reload();
  };

  return new Promise((resolve) => {
    const done = (ok) => {
      window.__useNaverMap = ok;
      resolve(ok);
    };
    const timer = setTimeout(() => done(false), timeoutMs);
    const s = document.createElement('script');
    s.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(CLIENT_ID)}`;
    s.async = true;
    s.onload = () => {
      clearTimeout(timer);
      done(!!(window.naver && window.naver.maps));
    };
    s.onerror = () => {
      clearTimeout(timer);
      console.warn('[map] 네이버 지도 스크립트를 불러오지 못해 OpenStreetMap 을 사용합니다.');
      done(false);
    };
    document.head.appendChild(s);
  });
}
