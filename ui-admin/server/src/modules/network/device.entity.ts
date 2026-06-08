import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DeviceStatus } from './network.types';

@Entity('devices')
export class DeviceEntity {
  @PrimaryColumn()
  mac!: string;

  @Column({ type: 'varchar', nullable: true })
  vendor!: string | null;

  @Column({ type: 'varchar', nullable: true })
  ip!: string | null;

  @Column({ type: 'varchar', nullable: true })
  hostname!: string | null;

  @Column({ type: 'varchar', nullable: true })
  preferredName!: string | null;

  @Column({ type: 'enum', enum: DeviceStatus, default: DeviceStatus.PENDING })
  status!: DeviceStatus;

  @CreateDateColumn()
  firstSeen!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastSeen!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt!: Date | null;

  @UpdateDateColumn()
  updatedAt!: Date;
}
