import { kstDateString } from './school.util';

/**
 * 운행 일지·일회성 탑승·위치 변경이 오전에 어긋나던 문제(서버가 UTC 날짜를 쓴 것)의 재발 방지 테스트.
 * 한국 시간 오전 9시 전에는 UTC 날짜가 '어제'다.
 */
describe('한국 시간 오전의 날짜', () => {
  it('한국 오전 7시 54분은 UTC 로는 전날이지만 한국 날짜(그날)로 나온다', () => {
    const d = new Date('2026-11-23T22:54:00Z'); // 한국 2026-11-24 07:54
    expect(d.toISOString().split('T')[0]).toBe('2026-11-23'); // 예전 방식(UTC)은 전날이었다
    expect(kstDateString(d)).toBe('2026-11-24');
  });

  it('한국 오전 9시 이후에는 UTC 날짜와 같다', () => {
    expect(kstDateString(new Date('2026-11-24T01:00:00Z'))).toBe('2026-11-24'); // 한국 10:00
  });

  it('매월 1일 아침도 그 달로 나온다', () => {
    expect(kstDateString(new Date('2026-11-30T23:30:00Z'))).toBe('2026-12-01'); // 한국 12/1 08:30
  });
});
