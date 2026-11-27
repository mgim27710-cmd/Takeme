/**
 * 앱의 교육 단계(유치원 / 초등 / 중·고등) 규칙.
 * 앱은 로그인할 때 자기 단계(clientLevel)를 보내고, 서버는 학원의 교육 단계(Academy.educationLevel)와 맞는지 확인한다.
 */
export type EducationLevel = 'KINDERGARTEN' | 'ELEMENTARY' | 'MIDDLE_HIGH';

/** 앱이 보낸 단계를 정리한다. 알 수 없거나 비어 있으면 null (= 제한 없음, 예전 앱·웹) */
export function normalizeClientLevel(raw: unknown): EducationLevel | null {
  const v = String(raw ?? '').trim().toUpperCase();
  if (v === 'KINDERGARTEN' || v === 'ELEMENTARY' || v === 'MIDDLE_HIGH') return v;
  return null;
}

export function levelLabel(level: EducationLevel): string {
  return level === 'ELEMENTARY' ? '초등' : level === 'MIDDLE_HIGH' ? '중·고등' : '유치원';
}

/**
 * 로그인을 막아야 하면 사용자에게 보여 줄 안내 문구, 허용이면 null.
 * - 웹 관리자(원장·최고관리자)는 제한하지 않는다.
 * - 앱이 단계를 보내지 않으면(예전 앱) 제한하지 않는다.
 * - 학원 정보가 없으면 유치원으로 본다.
 */
export function loginLevelProblem(
  appLevel: EducationLevel | null,
  accountLevel: string | null | undefined,
  role: string,
): string | null {
  if (!appLevel) return null;
  if (role === 'ACADEMY_ADMIN' || role === 'SUPER_ADMIN') return null;
  const account = normalizeClientLevel(accountLevel) ?? 'KINDERGARTEN';
  if (account === appLevel) return null;
  return `이 앱은 ${levelLabel(appLevel)} 전용입니다. 우리 학원에 맞는 앱(${levelLabel(account)})을 이용해 주세요.`;
}
