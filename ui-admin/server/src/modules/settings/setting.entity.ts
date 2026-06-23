import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('settings')
export class SettingEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  key!: string;

  // AES-256-GCM encrypted payload (see shared/crypto.util.ts).
  @Column({ type: 'text' })
  value!: string;

  @UpdateDateColumn()
  updatedAt!: Date;
}
