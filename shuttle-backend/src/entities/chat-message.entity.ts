import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { ChatRoom } from './chat-room.entity';
import { User } from './user.entity';

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ChatRoom, room => room.messages, { onDelete: 'CASCADE' })
  room: ChatRoom;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  sender: User | null;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'varchar', default: 'TEXT' })
  type: string; // 'TEXT' | 'PAYMENT_REQUEST'

  @Column({ type: 'simple-json', nullable: true })
  payload: any;

  @Column({ type: 'simple-array', nullable: true })
  readBy: number[]; // Array of User IDs

  @Column({ length: 50, nullable: true })
  messageType?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: any;

  /**
   * 교사 방해금지 시간에 학부모가 보낸 메시지: 이 시각이 되면 교사에게 전달된다.
   * 그 전에는 보낸 사람에게만 보이고, 교사 쪽 목록·안 읽은 수에도 잡히지 않는다. 전달되면 null.
   */
  @Column({ type: 'timestamp', nullable: true })
  deliverAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
