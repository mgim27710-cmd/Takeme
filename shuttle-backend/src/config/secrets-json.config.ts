import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * 서버 인증키 파일(secrets.json) 읽기.
 *
 * 위치: shuttle-backend/secrets.json (다른 곳에 두려면 환경변수 SECRETS_JSON_PATH 로 경로 지정)
 * 형식: secrets.example.json 을 복사해서 값만 채운다. 이 파일은 git 에 올라가지 않는다.
 *
 * 읽은 값은 ConfigService.get('NAVER_CLIENT_ID') 처럼 .env 값과 똑같이 쓴다.
 * 같은 이름이 .env(또는 실제 환경변수)에도 있으면 그쪽이 우선이다.
 */
export function loadSecretsJson(): Record<string, string> {
  const file = resolve(process.env.SECRETS_JSON_PATH || 'secrets.json');
  if (!existsSync(file)) return {};
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    const out: Record<string, string> = {};
    if (raw && typeof raw === 'object') {
      for (const [key, value] of Object.entries(raw)) {
        // 설명용 키("_설명" 등)와 빈 값은 건너뛴다
        if (key.startsWith('_')) continue;
        if (typeof value === 'string' && value.trim()) out[key] = value.trim();
      }
    }
    return out;
  } catch (err: any) {
    console.warn(`[secrets.json] ${file} 을(를) 읽지 못했습니다: ${err?.message || err}`);
    return {};
  }
}
