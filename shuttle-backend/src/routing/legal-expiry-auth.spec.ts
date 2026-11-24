import { RoutingController } from './routing.controller';

/** 차량 법정 만료일은 로그인 없이 보거나 바꿀 수 없어야 한다 (예전에는 누구나 접근 가능으로 열려 있었다) */
describe('차량 법정 만료일 주소는 로그인이 필요하다', () => {
  const isPublic = (method: keyof RoutingController) =>
    Reflect.getMetadata('isPublic', RoutingController.prototype[method] as any);

  it('조회(GET legal-expiry)는 공개가 아니다', () => {
    expect(isPublic('getLegalExpiries')).toBeFalsy();
  });

  it('저장(POST legal-expiry)은 공개가 아니다', () => {
    expect(isPublic('saveLegalExpiry')).toBeFalsy();
  });
});
