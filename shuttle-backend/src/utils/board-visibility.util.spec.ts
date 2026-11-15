import { canViewBoardPost, classKey } from './board-visibility.util';

describe('알림장/게시물 공개 범위', () => {
  const classPost = { visibility: 'CLASS', targetClass: '햇살반', className: '햇살반' };
  const allPost = { visibility: 'ALL', targetClass: '햇살반', className: '햇살반' };

  it('전체 공개는 반이 달라도, 반이 없어도 보인다', () => {
    expect(canViewBoardPost(allPost, ['별빛반'])).toBe(true);
    expect(canViewBoardPost(allPost, [])).toBe(true);
  });

  it('나의 반 글은 같은 반 학부모에게만 보인다', () => {
    expect(canViewBoardPost(classPost, ['햇살반'])).toBe(true);
    expect(canViewBoardPost(classPost, ['별빛반'])).toBe(false);
  });

  it('반이 없는 학부모는 나의 반 글이 보이지 않는다', () => {
    expect(canViewBoardPost(classPost, [])).toBe(false);
  });

  it('다자녀는 아이들이 속한 어느 반의 글이든 보인다', () => {
    expect(canViewBoardPost(classPost, ['별빛반', '햇살반'])).toBe(true);
  });

  it('반 이름의 공백 차이는 같은 반으로 본다', () => {
    expect(classKey(' 햇살 반 ')).toBe('햇살반');
    expect(canViewBoardPost(classPost, ['햇살 반'])).toBe(true);
  });

  it('기존 글(visibility 값 없음)은 전체 공개와 같다', () => {
    expect(canViewBoardPost({ visibility: undefined as any, targetClass: null as any, className: null as any }, [])).toBe(true);
  });

  it('나의 반 글인데 반 정보가 없으면 보이지 않는다', () => {
    expect(canViewBoardPost({ visibility: 'CLASS', targetClass: null as any, className: null as any }, ['햇살반'])).toBe(false);
  });
});
