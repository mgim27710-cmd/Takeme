/**
 * 위치 변동 신청 때문에 '학생 기본 위치'가 바뀐 원아 목록 (읽기 전용 · 아무것도 바꾸지 않는다)
 *
 * 예전에는 위치 변동 신청이 승인되면 하루짜리 신청이어도 학생의 기본 탑승지(boardingLocation)와
 * 좌표가 영구로 바뀌었다. 지금은 그 날짜에만 적용되도록 고쳤으니, 이미 바뀐 원아가 누구인지 확인해
 * 원장님이 웹에서 원래 위치로 되돌릴 수 있게 목록을 뽑는다.
 *
 * 실행 (서버의 shuttle-backend 폴더에서, 빌드된 뒤):
 *   npm run report:location-changes
 * 선택:
 *   CSV=/경로/location-changes.csv   표를 CSV 파일로도 저장 (엑셀에서 열 수 있게 한글 깨짐 방지 처리)
 *
 * 표의 '의심' 열:
 *   기본위치가 신청 위치와 같음  → 하루짜리 신청이 영구로 반영된 것으로 보임 (되돌릴지 원장님 확인 필요)
 *   주소가 일회성 위치와 같음    → 일회성 변경 주소가 학생 주소 칸에 저장된 것으로 보임
 */
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { writeFileSync } from 'fs';
import { Repository } from 'typeorm';
import { AppModule } from '../app.module';
import { ApprovalRequest, ApprovalStatus, ChangeRequestType } from '../entities/approval-request.entity';
import { ScheduleOverride } from '../entities/schedule-override.entity';

type Row = {
  학생번호: number;
  이름: string;
  반: string;
  신청번호: number;
  적용날짜: string;
  신청위치: string;
  현재기본위치: string;
  현재주소: string;
  의심: string;
};

function close(a?: number | null, b?: number | null): boolean {
  return a != null && b != null && Math.abs(Number(a) - Number(b)) < 1e-6;
}

function csvCell(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const approvalRepo = app.get<Repository<ApprovalRequest>>(getRepositoryToken(ApprovalRequest));
    const overrideRepo = app.get<Repository<ScheduleOverride>>(getRepositoryToken(ScheduleOverride));

    const rows: Row[] = [];

    // 1) 승인된 위치 변동 신청 → 학생 기본 위치가 그 위치로 바뀌었는지
    const requests = await approvalRepo.find({
      where: { type: ChangeRequestType.CHANGE_LOCATION, status: ApprovalStatus.APPROVED },
      relations: { student: true },
      order: { id: 'ASC' },
    });
    for (const r of requests) {
      const s = r.student;
      if (!s) continue;
      const newAddr = (r.newAddress || r.address || '').trim();
      if (!newAddr) continue;
      const sameBoarding = (s.boardingLocation || '').trim() === newAddr;
      const sameCoords = close(s.latitude, r.newLatitude ?? r.latitude) && close(s.longitude, r.newLongitude ?? r.longitude);
      const sameAddress = (s.address || '').trim() === newAddr;
      const flags: string[] = [];
      if (sameBoarding || sameCoords) flags.push('기본위치가 신청 위치와 같음');
      if (sameAddress) flags.push('주소가 일회성 위치와 같음');
      if (flags.length === 0) continue;
      rows.push({
        학생번호: s.id,
        이름: s.adminDisplayName || s.name,
        반: s.className || '',
        신청번호: r.id,
        적용날짜: r.targetDate || '',
        신청위치: newAddr,
        현재기본위치: s.boardingLocation || '',
        현재주소: s.address || '',
        의심: flags.join(' / '),
      });
    }

    // 2) 일회성 탑승·위치 변경 주소가 학생 주소 칸에 남은 경우 (승인 신청 기록이 없어도 찾는다)
    const overrides = await overrideRepo.find({ relations: { student: true }, order: { id: 'ASC' } });
    const seen = new Set(rows.map((r) => `${r.학생번호}|${r.신청위치}`));
    for (const o of overrides) {
      const s = o.student;
      const newAddr = (o.newAddress || '').trim();
      if (!s || !newAddr) continue;
      if ((s.address || '').trim() !== newAddr) continue;
      if (seen.has(`${s.id}|${newAddr}`)) continue;
      seen.add(`${s.id}|${newAddr}`);
      rows.push({
        학생번호: s.id,
        이름: s.adminDisplayName || s.name,
        반: s.className || '',
        신청번호: o.id,
        적용날짜: String(o.startDate || ''),
        신청위치: newAddr,
        현재기본위치: s.boardingLocation || '',
        현재주소: s.address || '',
        의심: '주소가 일회성 위치와 같음',
      });
    }

    console.log(`\n위치가 바뀐 것으로 보이는 원아: ${rows.length}명(건)\n`);
    if (rows.length > 0) console.table(rows);
    else console.log('해당하는 원아가 없습니다.');

    const csvPath = (process.env.CSV || '').trim();
    if (csvPath && rows.length > 0) {
      const headers = Object.keys(rows[0]);
      const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => csvCell((r as any)[h])).join(','))];
      writeFileSync(csvPath, '﻿' + lines.join('\n'), 'utf8'); // 엑셀에서 한글이 깨지지 않게 BOM
      console.log(`\nCSV 저장: ${csvPath}`);
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
