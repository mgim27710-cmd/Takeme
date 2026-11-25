import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, Unique } from 'typeorm';

/**
 * 학부모가 게시물·알림장을 열어 본 기록 (카카오톡 읽음 표시처럼, 열면 자동으로 남는다).
 * 읽은 사람 명단은 교직원만 볼 수 있다. (다른 학부모에게는 보이지 않는다)
 */
@Entity('board_post_reads')
@Unique(['postId', 'userId'])
export class BoardPostRead {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  @Index()
  postId: number;

  @Column({ type: 'int' })
  @Index()
  userId: number;

  @CreateDateColumn()
  readAt: Date;
}
