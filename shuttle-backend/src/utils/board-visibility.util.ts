import { Repository, SelectQueryBuilder } from 'typeorm';
import { BoardPost } from '../entities/board-post.entity';
import { Student } from '../entities/student.entity';
import { getStudentClassName } from './school.util';

/**
 * 알림장·게시물 공개 범위 규칙 (서버에서만 판단한다)
 * - 전체 공개(visibility = 'ALL'): 같은 기관의 모든 사용자에게 보인다
 * - 나의 반(visibility = 'CLASS'): 글의 반(targetClass)과 같은 반에 소속된 학부모/학생(그리고 그 반 담임)에게만 보인다
 * - 반 정보가 없는 학부모는 전체 공개만 보인다
 * (기관 구분은 호출하는 쪽에서 post.academyId 조건으로 먼저 건다)
 */

/** 반 이름 비교용 키: 공백을 모두 제거 ("햇살 반" == "햇살반") */
export function classKey(name?: string | null): string {
  return String(name ?? '').replace(/\s+/g, '');
}

/** 쿼리빌더에 공개 범위 조건을 추가한다 */
export function applyBoardVisibility(
  qb: SelectQueryBuilder<BoardPost>,
  classNames: Array<string | null | undefined>,
  alias = 'post',
): void {
  const keys = Array.from(new Set(classNames.map(classKey).filter(Boolean)));
  if (keys.length > 0) {
    qb.andWhere(
      `(${alias}.visibility = :bvAll OR REPLACE(COALESCE(${alias}.targetClass, ${alias}.className, ''), ' ', '') IN (:...bvKeys))`,
      { bvAll: 'ALL', bvKeys: keys },
    );
  } else {
    qb.andWhere(`${alias}.visibility = :bvAll`, { bvAll: 'ALL' });
  }
}

/** 글 하나를 볼 수 있는지 (단건 조회용) */
export function canViewBoardPost(
  post: Pick<BoardPost, 'visibility' | 'targetClass' | 'className'>,
  classNames: Array<string | null | undefined>,
): boolean {
  if ((post.visibility || 'ALL') === 'ALL') return true;
  const target = classKey(post.targetClass || post.className);
  return !!target && classNames.map(classKey).includes(target);
}

/** 학부모/학생 계정에 연결된 모든 원아의 반 이름 (다자녀 포함) */
export async function getLinkedClassNames(studentRepo: Repository<Student>, userId: number): Promise<string[]> {
  const students = await studentRepo.find({
    where: [{ parentUser: { id: userId } }, { studentUser: { id: userId } }],
  });
  return Array.from(new Set(students.map((s) => getStudentClassName(s)).filter(Boolean)));
}
