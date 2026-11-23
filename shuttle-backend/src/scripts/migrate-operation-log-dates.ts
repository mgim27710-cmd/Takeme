/**
 * 운행 일지(operation_logs)의 날짜를 한국 날짜로 옮기기 (한 번 실행)
 *
 * 예전에는 서버가 운행 일지 날짜를 UTC 로 저장해서, 한국 시간 오전 9시 전에 한 운행(보통 등원 운행)이
 * 전날 날짜로 저장됐다. 그래서 웹 운행 일지에서 그날을 선택해도 안 보였다.
 * 이제 서버는 한국 날짜로 저장하니, 예전 기록도 운행을 시작한 시각(한국 시간) 기준 날짜로 옮긴다.
 *
 * 기본은 '미리보기'라서 아무것도 바꾸지 않고 바뀔 목록만 보여준다.
 *   미리보기:  npm run migrate:operation-log-dates
 *   실제 적용:  APPLY=1 npm run migrate:operation-log-dates
 *
 * - 운행 시작 시각(startTime)이 있으면 그 시각을, 없으면 탑승 기록의 첫 시각을 기준으로 한다. 둘 다 없으면 건너뛴다.
 * - 여러 번 실행해도 같은 결과다(이미 맞는 날짜는 바꾸지 않는다).
 * - 실행 전에 DB 백업(스냅샷)을 해 두는 것을 권장한다.
 */
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../app.module';
import { OperationLog } from '../entities/operation-log.entity';
import { kstDateString } from '../utils/school.util';

/** 탑승 기록 중 가장 이른 시각 (없으면 null) */
function firstRecordTime(log: OperationLog): Date | null {
  let records: any[] = [];
  try {
    records = typeof log.boardingRecords === 'string' ? JSON.parse(log.boardingRecords) : (log.boardingRecords as any[]) || [];
  } catch {
    return null;
  }
  const times = records
    .map((r) => new Date(r?.boardTime || r?.time || ''))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  return times.length > 0 ? times[0] : null;
}

async function main() {
  const apply = process.env.APPLY === '1';
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const repo = app.get<Repository<OperationLog>>(getRepositoryToken(OperationLog));
    const logs = await repo.find({ relations: { vehicle: true }, order: { id: 'ASC' } });

    const changes: Array<{ log: OperationLog; from: string; to: string; basis: string }> = [];
    let skipped = 0;
    for (const log of logs) {
      const startTime = log.startTime ? new Date(log.startTime) : null;
      const basisDate = startTime && !isNaN(startTime.getTime()) ? startTime : firstRecordTime(log);
      if (!basisDate) {
        skipped++;
        continue;
      }
      const to = kstDateString(basisDate);
      const from = String(log.dateString);
      if (to !== from) changes.push({ log, from, to, basis: startTime ? '운행 시작 시각' : '첫 탑승 기록' });
    }

    console.log(`\n전체 운행 일지 ${logs.length}건 중 날짜를 옮길 것: ${changes.length}건 (시각이 없어 건너뜀: ${skipped}건)\n`);
    if (changes.length > 0) {
      console.table(
        changes.map((c) => ({
          일지번호: c.log.id,
          호차: c.log.vehicle?.busNumber ?? '-',
          현재날짜: c.from,
          옮길날짜: c.to,
          기준: c.basis,
        })),
      );
    }

    if (!apply) {
      console.log('\n미리보기입니다. 아무것도 바꾸지 않았습니다. 적용하려면 APPLY=1 을 붙여 다시 실행하세요.');
      return;
    }

    for (const c of changes) {
      await repo.update(c.log.id, { dateString: c.to });
    }
    console.log(`\n${changes.length}건의 날짜를 한국 날짜로 옮겼습니다.`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
