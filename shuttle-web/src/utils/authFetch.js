import { API_BASE_URL } from '../config';

let isRefreshing = false;
let refreshSubscribers = [];

function onRefreshed(newToken) {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
}

export function setupFetchInterceptor() {
  if (window._hasAuthFetchInterceptor) return;
  window._hasAuthFetchInterceptor = true;

  const originalFetch = window.fetch;

  window.fetch = async function (input, init = {}) {
    const token = localStorage.getItem('takeme_token');
    const headers = new Headers(init.headers || {});

    const urlStr = typeof input === 'string' ? input : input?.url || '';
    const isAuthEndpoint = urlStr.includes('/auth/login') || urlStr.includes('/auth/register') || urlStr.includes('/auth/self-unlock');
    if (token && !headers.has('Authorization') && !isAuthEndpoint && (urlStr.startsWith(API_BASE_URL) || urlStr.startsWith('/'))) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const modifiedInit = {
      ...init,
      headers,
    };

    try {
      const response = await originalFetch(input, modifiedInit);

      // 401 Unauthorized 감지 시 리프레시 토큰으로 자동 갱신 시도
      if (response.status === 401 && !urlStr.includes('/auth/login') && !urlStr.includes('/auth/refresh') && !urlStr.includes('/auth/self-unlock')) {
        // 동시 접속으로 인한 세션 종료 또는 세션 체크 실패 시 즉시 로그아웃
        let isSessionKicked = urlStr.includes('/auth/session-check');
        try {
          const clone = response.clone();
          const errBody = await clone.json();
          if (errBody && typeof errBody.message === 'string' && (errBody.message.includes('다른 기기') || errBody.message.includes('접속이 종료'))) {
            isSessionKicked = true;
          }
        } catch (_) {}

        if (isSessionKicked) {
          localStorage.removeItem('takeme_token');
          localStorage.removeItem('takeme_refresh_token');
          localStorage.removeItem('takeme_user');
          alert('다른 기기 또는 브라우저에서 로그인되어 현재 접속이 종료되었습니다. 다시 로그인해 주세요.');
          window.location.href = '/';
          return response;
        }

        const refreshToken = localStorage.getItem('takeme_refresh_token');
        if (!refreshToken) {
          return response;
        }

        if (!isRefreshing) {
          isRefreshing = true;
          try {
            const refreshRes = await originalFetch(`${API_BASE_URL}/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken }),
            });

            if (refreshRes.ok) {
              const data = await refreshRes.json();
              if (data.accessToken) {
                localStorage.setItem('takeme_token', data.accessToken);
                if (data.refreshToken) {
                  localStorage.setItem('takeme_refresh_token', data.refreshToken);
                }
                onRefreshed(data.accessToken);

                // 원래 요청 새 토큰으로 자동 재시도
                const retryHeaders = new Headers(init.headers || {});
                retryHeaders.set('Authorization', `Bearer ${data.accessToken}`);
                return originalFetch(input, { ...init, headers: retryHeaders });
              }
            } else {
              localStorage.removeItem('takeme_token');
              localStorage.removeItem('takeme_refresh_token');
              localStorage.removeItem('takeme_user');
              alert('인증이 만료되었거나 다른 기기에서 로그인되어 연결이 종료되었습니다. 다시 로그인해 주세요.');
              window.location.href = '/';
              return response;
            }
          } catch (err) {
            console.error('Token auto-refresh failed:', err);
            return response;
          } finally {
            isRefreshing = false;
          }
        } else {
          // 이미 갱신 중인 경우 대기열에 등록 후 새 토큰 도착 시 재시도
          return new Promise((resolve) => {
            refreshSubscribers.push((newToken) => {
              const retryHeaders = new Headers(init.headers || {});
              retryHeaders.set('Authorization', `Bearer ${newToken}`);
              resolve(originalFetch(input, { ...init, headers: retryHeaders }));
            });
          });
        }
      }

      return response;
    } catch (err) {
      throw err;
    }
  };
}
