import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ChatRoom } from './chat-room.entity';
import { User } from './user.entity';

@Entity('chat_room_members')
export class ChatRoomMember {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ChatRoom, room => room.members, { onDelete: 'CASCADE' })
  room: ChatRoom;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'timestamp', nullable: true })
  lastReadAt: Date;

  /** 내 목록에서 맨 위 고정한 시각 (null 이면 고정 안 함). TakeMe 알림 바로 아래에 고정 순서대로 보인다 */
  @Column({ type: 'timestamp', nullable: true })
  pinnedAt: Date | null;

  /** 내 목록에서 삭제한 시각. 이 뒤로 새 메시지가 오면 다시 보인다 */
  @Column({ type: 'timestamp', nullable: true })
  hiddenAt: Date | null;

  @CreateDateColumn()
  joinedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
