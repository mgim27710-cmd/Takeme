import { randomInt } from 'crypto';

/**
 * 학부모가 학생 계정을 만들 때 발급하는 초대 코드 규칙
 * - 헷갈리는 글자(0, O, 1, I)를 뺀 영문 대문자 + 숫자 6자리
 * - 24시간 안에 한 번만 쓸 수 있다
 */
export const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 6;
export const INVITE_TTL_HOURS = 24;

export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
  }
  return code;
}

/** 사용자가 입력한 코드를 정리한다 (공백·하이픈 제거, 대문자) */
export function normalizeInviteCode(raw?: string | null): string {
  return String(raw ?? '').replace(/[\s-]/g, '').toUpperCase();
}

export function inviteExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + INVITE_TTL_HOURS * 3600 * 1000);
}

/** 초대 코드를 쓸 수 없는 이유 (쓸 수 있으면 null). 사용자에게 그대로 보여 줄 문구다. */
export function inviteProblem(
  invite: { usedAt?: Date | null; expiresAt: Date } | null | undefined,
  now: Date = new Date(),
): string | null {
  if (!invite) return '초대 코드를 찾을 수 없습니다. 코드를 다시 확인해 주세요.';
  if (invite.usedAt) return '이미 사용된 초대 코드입니다. 학부모님께 새 코드를 받아 주세요.';
  if (new Date(invite.expiresAt).getTime() <= now.getTime()) {
    return '초대 코드의 사용 기간이 지났습니다. 학부모님께 새 코드를 받아 주세요.';
  }
  return null;
}
