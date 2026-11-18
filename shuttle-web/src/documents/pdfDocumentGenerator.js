// Database-Integrated Clean PDF Print & Download Utility for Takeme Legal Documents

export function openPrintDocument(type, data = {}) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const autoDateKorean = `${year}년 ${month}월 ${day}일`;
  const academyName = data.academyName || 'Takeme 협력유치원';

  const bus = data.selectedBus || null;
  const busStudents = data.busStudents || [];
  const student = data.selectedStudent || null;

  let title = '';
  let bodyHtml = '';

  if (type === 'safety') {
    const busNameText = bus ? `${bus.name || bus.busNumber || ''} ` : '';
    title = `어린이통학버스_${busNameText}일일안전점검표`;
    const plateText = bus ? (bus.plateNumber || `${bus.name} 전용차량`) : '';
    const driverText = bus ? (bus.driverName && bus.driverName !== '미정' ? `${bus.driverName} (인)` : '__________________ (인)') : '__________________ (인)';
    const companionText = bus ? (bus.teacherName && bus.teacherName !== '미정' ? `${bus.teacherName} (인)` : '__________________ (인)') : '__________________ (인)';

    bodyHtml = `
      <div class="doc-container">
        <div class="header-section">
          <div class="title-wrap">
            <h1>어린이통학버스 일일 안전점검표</h1>
            <p class="sub-text">도로교통법 제53조 및 어린이안전관리에 관한 법률 준수 표준서식 ${bus ? `[${bus.name}]` : ''}</p>
          </div>
          <table class="approval-table">
            <tr>
              <th rowspan="2" class="v-header">결<br>재</th>
              <th>점검자</th>
              <th>안전책임자</th>
              <th>원 장</th>
            </tr>
            <tr>
              <td class="sign-box"></td>
              <td class="sign-box"></td>
              <td class="sign-box"></td>
            </tr>
          </table>
        </div>

        <table class="info-table">
          <tr>
            <th style="width: 15%;">점검일자</th>
            <td style="width: 35%; font-weight: bold; color: #1e293b;">${autoDateKorean}</td>
            <th style="width: 15%;">유 치 원 명</th>
            <td style="width: 35%; font-weight: bold;">${academyName}</td>
          </tr>
          <tr>
            <th>호차 / 차량번호</th>
            <td style="font-weight: bold; color: #2563eb;">${bus ? `${bus.name} (${plateText})` : ''}</td>
            <th>운전자 / 동승자</th>
            <td>${driverText} &nbsp;/&nbsp; ${companionText}</td>
          </tr>
        </table>

        <table class="check-table">
          <thead>
            <tr>
              <th style="width: 7%;">번호</th>
              <th style="width: 25%;">점검 항목</th>
              <th style="width: 44%;">점검 기준 및 법정 요건</th>
              <th style="width: 24%;">점검 결과</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="center">1</td>
              <td class="bold">어린이 하차확인장치</td>
              <td>운행 종료 후 3분 내 확인벨 작동 및 경고음 상태</td>
              <td class="center"><span class="check-box" style="margin-right: 4px;"></span> 양호 &nbsp;&nbsp;&nbsp;&nbsp; <span class="check-box" style="margin-right: 4px;"></span> 불량</td>
            </tr>
            <tr>
              <td class="center">2</td>
              <td class="bold">전 좌석 어린이 안전띠</td>
              <td>안전띠 체결 및 길이 조절 장치 정상 작동 여부</td>
              <td class="center"><span class="check-box" style="margin-right: 4px;"></span> 양호 &nbsp;&nbsp;&nbsp;&nbsp; <span class="check-box" style="margin-right: 4px;"></span> 불량</td>
            </tr>
            <tr>
              <td class="center">3</td>
              <td class="bold">정지표시장치(스톱봉)</td>
              <td>승하차문 연동 개폐 및 표시등 정상 점등 여부</td>
              <td class="center"><span class="check-box" style="margin-right: 4px;"></span> 양호 &nbsp;&nbsp;&nbsp;&nbsp; <span class="check-box" style="margin-right: 4px;"></span> 불량</td>
            </tr>
            <tr>
              <td class="center">4</td>
              <td class="bold">광각 실외후사경/후방카메라</td>
              <td>차량 후방 및 양측 사각지대 확인 장치 정상 여부</td>
              <td class="center"><span class="check-box" style="margin-right: 4px;"></span> 양호 &nbsp;&nbsp;&nbsp;&nbsp; <span class="check-box" style="margin-right: 4px;"></span> 불량</td>
            </tr>
            <tr>
              <td class="center">5</td>
              <td class="bold">차량용 소화기 비치</td>
              <td>운전석 인근 규격 소화기 압력 게이지 정상 여부</td>
              <td class="center"><span class="check-box" style="margin-right: 4px;"></span> 양호 &nbsp;&nbsp;&nbsp;&nbsp; <span class="check-box" style="margin-right: 4px;"></span> 불량</td>
            </tr>
            <tr>
              <td class="center">6</td>
              <td class="bold">비상탈출용 비상망치</td>
              <td>차량 내 규격 비상망치 2개 이상 구비 및 상태</td>
              <td class="center"><span class="check-box" style="margin-right: 4px;"></span> 양호 &nbsp;&nbsp;&nbsp;&nbsp; <span class="check-box" style="margin-right: 4px;"></span> 불량</td>
            </tr>
            <tr>
              <td class="center">7</td>
              <td class="bold">응급 구급상자 구비</td>
              <td>소독약, 붕대, 거즈, 반창고 등 유효기간 및 보관</td>
              <td class="center"><span class="check-box" style="margin-right: 4px;"></span> 양호 &nbsp;&nbsp;&nbsp;&nbsp; <span class="check-box" style="margin-right: 4px;"></span> 불량</td>
            </tr>
            <tr>
              <td class="center">8</td>
              <td class="bold">타이어 및 브레이크</td>
              <td>공기압, 마모도, 제동장치 및 등화장치 정상 작동</td>
              <td class="center"><span class="check-box" style="margin-right: 4px;"></span> 양호 &nbsp;&nbsp;&nbsp;&nbsp; <span class="check-box" style="margin-right: 4px;"></span> 불량</td>
            </tr>
            <tr>
              <td class="center">9</td>
              <td class="bold">차량 내·외부 청결 및 환기</td>
              <td>좌석 소독, 쓰레기 방치 여부 및 손잡이 청결</td>
              <td class="center"><span class="check-box" style="margin-right: 4px;"></span> 양호 &nbsp;&nbsp;&nbsp;&nbsp; <span class="check-box" style="margin-right: 4px;"></span> 불량</td>
            </tr>
          </tbody>
        </table>

        <table class="notes-table">
          <tr>
            <th style="width: 15%;">특이사항<br>및 조치내용</th>
            <td style="height: 80px; vertical-align: top; padding: 8px;"></td>
          </tr>
        </table>

        <div class="footer-sign">
          위와 같이 통학버스 일일 안전점검을 성실히 실시하였음을 확인합니다.<br>
          <div class="date-line">${autoDateKorean}</div>
          <div class="sign-names">
            점검자(운전자): __________________ (인) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 동승보호자: __________________ (인)
          </div>
        </div>
      </div>
    `;
  } else if (type === 'companion') {
    const busNameText = bus ? `${bus.name || bus.busNumber || ''} ` : '';
    title = `동승보호자_${busNameText}탑승일지_및_승하차명부`;

    const plateText = bus ? (bus.plateNumber || `${bus.name} 차량`) : '';
    const companionText = bus ? (bus.teacherName && bus.teacherName !== '미정' ? `${bus.teacherName} (인)` : '__________________ (인)') : '__________________ (인)';
    const driverText = bus ? (bus.driverName && bus.driverName !== '미정' ? `${bus.driverName} (인)` : '__________________ (인)') : '__________________ (인)';
    const studentCount = busStudents.length;

    let rosterRowsHtml = '';
    if (busStudents.length > 0) {
      rosterRowsHtml = busStudents.map((st, idx) => {
        const raw = st.raw || {};
        const schoolGrade = raw['소속원명'] || raw['유치원명'] || raw['학교명']
          ? `${raw['소속원명'] || raw['유치원명'] || raw['학교명']} ${raw['반명'] ? `(${raw['반명']})` : (raw['반'] || '')}`.trim()
          : (st.className || st.grade || '-');

        // 보호자 성함 및 관계 추출 (원생과의 관계 보장)
        const parentName = st.parentName || st.parent1Name || raw['보호자 성함'] || raw['보호자성함'] || raw['보호자1 성함'] || raw['부모명'] || raw['학부모'] || '보호자';
        const parentRel = st.parentRelation || st.parent1Relation || raw['보호자 관계'] || raw['보호자1 관계'] || raw['관계'] || raw['가족관계'] || (raw['부모연락처'] ? '모' : '부모');
        const phone = st.parentPhone || st.parent1Phone || raw['부모연락처'] || raw['보호자연락처'] || raw['보호자1 연락처'] || '-';

        const location = raw['비고'] || st.boardingLocation || st.address || '-';
        const cleanLocation = location.replace(/\[등\/하차 지점 상세\]:\s*/, '');

        return `
          <tr>
            <td class="center" style="white-space: nowrap;">${idx + 1}</td>
            <td class="center bold" style="font-size: 13px; white-space: nowrap;">${st.name || st.realName}</td>
            <td class="center" style="font-size: 12px; color: #475569; white-space: nowrap;">${schoolGrade}</td>
            <td style="font-size: 12px; color: #1e293b;" title="${cleanLocation}">${cleanLocation}</td>
            <td class="center bold" style="font-size: 12.5px; color: #0f172a; white-space: nowrap;">
              <span>${parentName}</span> <span style="font-weight: 600; color: #475569; font-size: 11.5px;">(${parentRel})</span>
            </td>
            <td class="center bold" style="font-size: 12px; font-family: monospace; color: #1e3a8a; white-space: nowrap;">${phone}</td>
            <td class="center" style="white-space: nowrap;"><span class="check-box"></span></td>
            <td class="center" style="white-space: nowrap;"><span class="check-box"></span></td>
          </tr>
        `;
      }).join('');
    } else {
      rosterRowsHtml = `
        <tr>
          <td colspan="8" class="center" style="padding: 12px; color: #94a3b8; font-size: 13px;">
            배정된 원생 정보가 없습니다. (수기로 작성 가능)
          </td>
        </tr>
      `;
    }

    bodyHtml = `
      <div class="doc-container">
        <div class="header-section">
          <div class="title-wrap">
            <h1>동승보호자 탑승일지 및 안전확인서</h1>
            <p class="sub-text">어린이통학버스 안전관리 법정 동승기록부 ${bus ? `[${bus.name} 배정원생 총 ${studentCount}명 연동]` : ''}</p>
          </div>
          <table class="approval-table">
            <tr>
              <th rowspan="2" class="v-header">결<br>재</th>
              <th>담 당</th>
              <th>원 장</th>
            </tr>
            <tr>
              <td class="sign-box"></td>
              <td class="sign-box"></td>
            </tr>
          </table>
        </div>

        <table class="info-table">
          <tr>
            <th style="width: 15%;">운행일자</th>
            <td style="width: 35%; font-weight: bold; color: #1e293b;">${autoDateKorean}</td>
            <th style="width: 15%;">유 치 원 명</th>
            <td style="width: 35%; font-weight: bold;">${academyName}</td>
          </tr>
          <tr>
            <th>호차 / 차량번호</th>
            <td style="font-weight: bold; color: #2563eb;">${bus ? `${bus.name} (${plateText})` : ''}</td>
            <th>동승보호자 / 기사</th>
            <td>${companionText} &nbsp;/&nbsp; ${driverText}</td>
          </tr>
        </table>

        <div style="margin-top: 15px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: flex-end;">
          <h2 style="font-size: 15px; font-weight: 800; color: #0f172a; margin: 0;">
            ${bus ? `[${bus.name}]` : ''} 탑승 원생 명단 및 승하차 안전 확인부
          </h2>
          <span style="font-size: 13px; color: #2563eb; font-weight: bold;">
            배정 원생: ${studentCount}명
          </span>
        </div>

        <table class="check-table" style="margin-bottom: 15px;">
          <thead>
            <tr>
              <th style="width: 4%; white-space: nowrap;">번호</th>
              <th style="width: 11%; white-space: nowrap;">원생명</th>
              <th style="width: 12%; white-space: nowrap;">유치원 / 반</th>
              <th style="width: 29%;">탑승지 (등·하차 지점)</th>
              <th style="width: 14%; white-space: nowrap;">보호자 (관계)</th>
              <th style="width: 16%; white-space: nowrap;">보호자 연락처</th>
              <th style="width: 7%; white-space: nowrap;">승차</th>
              <th style="width: 7%; white-space: nowrap;">하차</th>
            </tr>
          </thead>
          <tbody>
            ${rosterRowsHtml}
          </tbody>
        </table>

        <table class="info-table" style="margin-bottom: 12px;">
          <tr>
            <th style="width: 25%;">전원 안전띠 착용 여부</th>
            <td style="width: 25%;" class="center"><span class="check-box" style="margin-right: 6px;"></span>전원 확인완료</td>
            <th style="width: 25%;">차량 잔류 원생 확인</th>
            <td style="width: 25%;" class="center"><span class="check-box" style="margin-right: 6px;"></span>잔류원생 없음</td>
          </tr>
        </table>

        <table class="notes-table">
          <tr>
            <th style="width: 15%;">운행 중 특이사항<br>및 전달사항</th>
            <td style="height: 60px; vertical-align: top; padding: 6px;"></td>
          </tr>
        </table>

        <div class="footer-sign" style="margin-top: 20px;">
          상기 차량에 동승하여 배정 어린이의 승하차 안전 및 전원 안전띠 착용 여부를 철저히 확인하였습니다.<br>
          <div class="date-line">${autoDateKorean}</div>
          <div class="sign-names">
            동승보호자: __________________ (인) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 운전자: __________________ (인)
          </div>
        </div>
      </div>
    `;
  } else if (type === 'emergency' || type === 'emergency-contacts') {
    // 2순위 필수 (분리 1): 차량 내 비치용 탑승 원아 비상연락망
    const busNameText = bus ? `${bus.name || bus.busNumber || ''} ` : '';
    title = `어린이통학버스_탑승원아_비상연락망_${busNameText || '전체'}`;
    const plateText = bus ? (bus.plateNumber || `${bus.name} 차량`) : '전 차량 공통';
    const driverInfo = bus
      ? `${bus.driverName || '미지정'}${bus.driverPhone ? ` (${bus.driverPhone})` : ''}`
      : '담당 기사님';
    const companionInfo = bus
      ? `${bus.teacherName || '미지정'}${bus.teacherPhone ? ` (${bus.teacherPhone})` : ''}`
      : '담당 동승보호자';

    let emergencyRowsHtml = '';
    if (busStudents.length > 0) {
      emergencyRowsHtml = busStudents.map((st, idx) => {
        const raw = st.raw || {};
        const classInfo = st.className || raw['소속원명'] || raw['유치원명'] || raw['반명'] || raw['반'] || raw['연령'] || '-';
        
        const p1Name = st.parentName || st.parent1Name || raw['보호자 성함'] || raw['보호자성함'] || raw['보호자1 성함'] || raw['부모명'] || raw['학부모'] || '보호자';
        const p1Rel = st.parentRelation || st.parent1Relation || raw['보호자 관계'] || raw['보호자1 관계'] || raw['관계'] || raw['가족관계'] || (raw['부모연락처'] ? '모' : '부모');
        const p1Phone = st.parentPhone || st.parent1Phone || raw['부모연락처'] || raw['보호자연락처'] || raw['보호자1 연락처'] || '-';
        
        const p2Name = st.parent2Name || raw['보호자2 성함'] || raw['보호자2성함'] || '';
        const p2Rel = st.parent2Relation || raw['보호자2 관계'] || raw['보호자2관계'] || (p2Name ? '부' : '');
        const p2Phone = st.parent2Phone || raw['보호자2 연락처'] || raw['보호자2연락처'] || raw['부모연락처2'] || raw['비상연락처'] || '';

        const stopLocation = (st.boardingLocation || raw['등원탑승지'] || raw['등원지'] || raw['탑승지'] || st.address || raw['주소'] || '-').replace(/\[등\/하차 지점 상세\]:\s*/, '');

        return `
          <tr>
            <td class="center" style="white-space: nowrap; padding: 6px 3px;">${idx + 1}</td>
            <td class="center bold" style="font-size: 13px; white-space: nowrap; padding: 6px 4px;">${st.name || st.realName}</td>
            <td class="center" style="font-size: 12px; color: #475569; white-space: nowrap; padding: 6px 4px;">${classInfo}</td>
            <td class="center bold" style="font-size: 12px; color: #0f172a; white-space: nowrap; padding: 6px 4px;">
              <span>${p1Name}</span> <span style="font-weight: normal; color: #64748b; font-size: 11px;">(${p1Rel})</span>
            </td>
            <td class="center bold" style="font-size: 12px; font-family: monospace; color: #1e3a8a; white-space: nowrap; padding: 6px 3px;">
              ${p1Phone}
            </td>
            <td class="center" style="font-size: 12px; white-space: nowrap; padding: 6px 4px;">
              ${p2Name ? `<span class="bold" style="color: #0f172a;">${p2Name}</span> <span style="color:#64748b; font-size: 11px;">(${p2Rel})</span>` : '<span style="color:#94a3b8;">-</span>'}
            </td>
            <td class="center bold" style="font-size: 12px; font-family: monospace; color: #334155; white-space: nowrap; padding: 6px 3px;">
              ${p2Phone || '<span style="color:#94a3b8;font-weight:normal;">-</span>'}
            </td>
            <td style="font-size: 11.5px; color: #334155; padding: 6px 4px;" title="${stopLocation}">
              ${stopLocation}
            </td>
          </tr>
        `;
      }).join('');
    } else {
      emergencyRowsHtml = `
        <tr>
          <td colspan="8" class="center" style="padding: 18px; color: #94a3b8;">
            배정된 원생 데이터가 없습니다.
          </td>
        </tr>
      `;
    }

    bodyHtml = `
      <div class="doc-container">
        <div class="header-section">
          <div class="title-wrap">
            <h1>어린이통학버스 탑승 원아 비상연락망</h1>
            <p class="sub-text">도로교통법 제53조 및 통학버스 비상상황 안전대응 규정 준수 [차량 운전석 및 동승석 상시 비치용]</p>
          </div>
          <table class="approval-table">
            <tr>
              <th rowspan="2" class="v-header">결<br>재</th>
              <th>안전담당</th>
              <th>원 장</th>
            </tr>
            <tr>
              <td class="sign-box"></td>
              <td class="sign-box"></td>
            </tr>
          </table>
        </div>

        <table class="info-table">
          <tr>
            <th style="width: 16%;">유 치 원 명</th>
            <td style="width: 34%; font-weight: bold;">${academyName}</td>
            <th style="width: 16%;">기준일자</th>
            <td style="width: 34%; font-weight: bold;">${autoDateKorean}</td>
          </tr>
          <tr>
            <th>호차 / 차량번호</th>
            <td style="font-weight: bold; color: #2563eb;">${bus ? `${bus.name} (${plateText})` : '전 호차 통합'}</td>
            <th>운전자 / 동승보호자</th>
            <td style="font-size: 13px;">기사: ${driverInfo} / 동승: ${companionInfo}</td>
          </tr>
        </table>

        <!-- 유관기관 긴급 연락처 박스 -->
        <table class="info-table" style="margin-bottom: 12px;">
          <tr>
            <th style="width: 16%; background: #eff6ff; color: #1e40af;">긴급 상황 연락망</th>
            <td style="width: 28%;" class="center"><strong>응급환자·구조 (119):</strong> 국번없이 119</td>
            <td style="width: 28%;" class="center"><strong>교통사고·경찰 (112):</strong> 국번없이 112</td>
            <td style="width: 28%;" class="center"><strong>유치원 행정실:</strong> 원내 비상직통망</td>
          </tr>
        </table>

        <div style="margin-bottom: 6px; display: flex; justify-content: space-between; align-items: flex-end;">
          <h2 style="font-size: 14.5px; font-weight: 800; color: #0f172a; margin: 0;">
            호차 탑승 원아별 보호자 비상연락망 (${busStudents.length}명)
          </h2>
          <span style="font-size: 12px; color: #2563eb; font-weight: bold;">
            ※ 운행 지연·사고 등 비상상황 시 주보호자 통화 후 부재 시 부보호자에게 즉시 연락하십시오.
          </span>
        </div>

        <table class="check-table" style="margin-bottom: 14px;">
          <thead>
            <tr>
              <th style="width: 4%; white-space: nowrap;">번호</th>
              <th style="width: 10%; white-space: nowrap;">원생명</th>
              <th style="width: 10%; white-space: nowrap;">반 / 연령</th>
              <th style="width: 14%; white-space: nowrap;">보호자 1 (관계)</th>
              <th style="width: 17%; white-space: nowrap;">보호자 1 연락처</th>
              <th style="width: 14%; white-space: nowrap;">보호자 2 (관계)</th>
              <th style="width: 17%; white-space: nowrap;">보호자 2 연락처</th>
              <th style="width: 14%; white-space: nowrap;">승·하차 장소</th>
            </tr>
          </thead>
          <tbody>
            ${emergencyRowsHtml}
          </tbody>
        </table>

        <div style="padding: 12px 14px; border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 4px; font-size: 12.5px; line-height: 1.7; color: #334155;">
          <strong style="color: #0f172a; font-size: 13px;">[통학버스 비상상황 발생 시 연락 및 보고 지침]</strong><br>
          1. <strong>차량 이상/사고 발생 즉시:</strong> 안전한 곳에 정차하고 비상등 점멸 후 119(인명피해 시) 및 유치원 관리책임자에게 최우선 보고합니다.<br>
          2. <strong>학부모 비상 통보:</strong> 위 비상연락망 순서(보호자1 ➔ 부재 시 보호자2)대로 현재 상황 및 예상 지연 시각을 침착하고 정확하게 안내합니다.<br>
          3. <strong>원아 보호 및 대리인 확인:</strong> 비상 인계 시 사전 등록된 보호자에게만 인계하며 현장 이탈을 금지합니다.
        </div>

        <div class="footer-sign" style="margin-top: 18px;">
          본 비상연락망은 개인정보보호법에 의거하여 통학버스 안전운행 및 비상연락 목적으로만 열람 및 관리됩니다.<br>
          <div class="date-line">${autoDateKorean}</div>
          <div class="sign-names">
            확인자(동승보호자): __________________ (인) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 관리책임자(관리자): __________________ (인)
          </div>
        </div>
      </div>
    `;
  } else if (type === 'health-allergy') {
    // 원아 건강상태 및 알레르기·기저질환 관리 명부 (전체 원아 대상 학급/반별 한 페이지씩 독립 분리 서식)
    title = `원아_건강상태_및_알레르기기저질환관리명부_${academyName}`;
    const allStudents = (busStudents && busStudents.length > 0) ? busStudents : [];

    // 반(학급)별로 원아 그룹핑
    const classGroups = {};
    allStudents.forEach((st) => {
      const raw = st.raw || {};
      const cName = st.className || raw['반명'] || raw['반'] || raw['소속원명'] || raw['유치원명'] || raw['연령'] || '일반(공통)';
      if (!classGroups[cName]) {
        classGroups[cName] = [];
      }
      classGroups[cName].push(st);
    });

    const classNames = Object.keys(classGroups);

    if (classNames.length > 0) {
      bodyHtml = classNames.map((cName) => {
        const stList = classGroups[cName];
        let classSpecialCount = 0;

        const rowsHtml = stList.map((st, idx) => {
          const raw = st.raw || {};

          // 알레르기 정보 추출
          const allergyText = (
            st.allergies ||
            raw['알레르기'] ||
            raw['특이사항(알레르기)'] ||
            raw['알러지'] ||
            ''
          ).trim();
          const hasAllergy = Boolean(allergyText && allergyText !== '없음' && allergyText !== '-' && allergyText !== '무');

          // 기저질환 정보 추출
          const medicalCondition = (
            raw['기저질환'] ||
            raw['지병'] ||
            raw['건강특이사항'] ||
            raw['특이체질'] ||
            (st.specialNotes && !st.specialNotes.includes('알레르기') ? st.specialNotes : '') ||
            ''
          ).trim();
          const hasMedical = Boolean(medicalCondition && medicalCondition !== '없음' && medicalCondition !== '-' && medicalCondition !== '무');

          if (hasAllergy || hasMedical) {
            classSpecialCount++;
          }

          // 복용약 및 주의사항
          const medication = (
            raw['복용약'] ||
            raw['투약안내'] ||
            raw['상비약'] ||
            raw['주의사항'] ||
            (hasAllergy ? '응급약 구비' : '')
          ).trim();

          return `
            <tr>
              <td class="center" style="white-space: nowrap; padding: 5px 4px;">${idx + 1}</td>
              <td class="center bold" style="font-size: 13px; white-space: nowrap; padding: 5px 6px;">${st.name || st.realName}</td>
              <td style="font-size: 12px; padding: 5px 8px; white-space: nowrap; ${hasAllergy ? 'color: #dc2626; font-weight: 700; background: #fef2f2;' : 'color: #94a3b8; text-align: center;'}">
                ${hasAllergy ? `⚠️ ${allergyText}` : '-'}
              </td>
              <td style="font-size: 12px; padding: 5px 8px; white-space: nowrap; ${hasMedical ? 'color: #b45309; font-weight: 700; background: #fffbeb;' : 'color: #94a3b8; text-align: center;'}">
                ${hasMedical ? `⚠️ ${medicalCondition}` : '-'}
              </td>
              <td class="center" style="font-size: 12px; color: #334155; padding: 5px 6px; white-space: nowrap;">
                ${medication || '<span style="color: #94a3b8;">-</span>'}
              </td>
            </tr>
          `;
        }).join('');

        return `
          <div class="doc-container page-break">
            <div class="header-section">
              <div class="title-wrap">
                <h1>원아 건강상태 및 알레르기·기저질환 관리명부</h1>
                <p class="sub-text">어린이안전관리에 관한 법률 및 보건응급의료 지침 준수 [학급별·보건실 상시 비치용]</p>
              </div>
              <table class="approval-table">
                <tr>
                  <th rowspan="2" class="v-header">결<br>재</th>
                  <th>담임교사</th>
                  <th>보건담당</th>
                  <th>원 장</th>
                </tr>
                <tr>
                  <td class="sign-box"></td>
                  <td class="sign-box"></td>
                  <td class="sign-box"></td>
                </tr>
              </table>
            </div>

            <table class="info-table">
              <tr>
                <th style="width: 15%;">유 치 원 명</th>
                <td style="width: 35%; font-weight: bold;">${academyName}</td>
                <th style="width: 15%;">기준일자</th>
                <td style="width: 35%; font-weight: bold;">${autoDateKorean}</td>
              </tr>
              <tr>
                <th>담당 학급(반)</th>
                <td style="font-weight: 800; color: #2563eb; font-size: 13.5px;">🏫 ${cName}</td>
                <th>학급 원아 현황</th>
                <td style="font-size: 12.5px;">해당 반 총원: <strong>${stList.length}명</strong> (주의 원아: <strong style="${classSpecialCount > 0 ? 'color: #dc2626;' : 'color: #059669;'}">${classSpecialCount}명</strong>)</td>
              </tr>
            </table>

            <!-- 응급의료 안내 박스 -->
            <table class="info-table" style="margin-bottom: 12px;">
              <tr>
                <th style="width: 15%; background: #fef2f2; color: #991b1b;">응급의료센터</th>
                <td style="width: 28%;" class="center"><strong>119 구급센터:</strong> 국번없이 119</td>
                <td style="width: 29%;" class="center"><strong>응급의료상담(1339):</strong> 국번없이 119/1339</td>
                <td style="width: 28%;" class="center"><strong>중독관리센터:</strong> 1588-4675</td>
              </tr>
            </table>

            <div style="margin-bottom: 8px; display: flex; justify-content: space-between; align-items: flex-end;">
              <h2 style="font-size: 14px; font-weight: 800; color: #0f172a; margin: 0;">
                [${cName}] 원아 식품·약품 알레르기 및 기저질환 명단
              </h2>
              <span style="font-size: 11.5px; color: #dc2626; font-weight: bold;">
                ※ 아나필락시스 쇼크 등 응급상황 발생 시 119 구급대원에게 본 명부를 즉시 제시하십시오.
              </span>
            </div>

            <table class="check-table" style="margin-bottom: 12px;">
              <thead>
                <tr>
                  <th style="width: 6%; white-space: nowrap;">번호</th>
                  <th style="width: 16%; white-space: nowrap;">원생명</th>
                  <th style="width: 36%; white-space: nowrap;">식품·약품 알레르기 유발요인</th>
                  <th style="width: 26%; white-space: nowrap;">기저질환 및 건강 특이체질</th>
                  <th style="width: 16%; white-space: nowrap;">복용약 / 주의사항</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>

            <div style="padding: 10px 12px; border: 1px solid #cbd5e1; background: #fffbeb; border-radius: 4px; font-size: 11.5px; line-height: 1.6; color: #78350f;">
              <strong style="color: #92400e; font-size: 12px;">[알레르기 아나필락시스 및 중증 응급상황 대처 매뉴얼]</strong><br>
              1. <strong>원인물질 즉시 차단 및 119 신고:</strong> 호흡곤란, 전신 두드러기, 입술·기도 부종 등 쇼크 징후 확인 시 지체 없이 119에 신고합니다.<br>
              2. <strong>에피네프린 및 구급처치:</strong> 원아가 휴대용 에피네프린(자가주사기)을 지참한 경우 허벅지 바깥쪽에 즉시 주사하고 시간을 기록합니다.<br>
              3. <strong>기도 확보 및 자세 유지:</strong> 호흡이 곤란한 경우 상체를 약간 높이고, 혈압 저하 시 다리를 올려 혈류를 유지하며 구급대원에게 인계합니다.
            </div>

            <div class="footer-sign" style="margin-top: 14px;">
              본 건강·알레르기 명부는 민감정보로서 학생 건강 보호 및 응급구호 목적으로만 사용되며 비밀이 보장됩니다.<br>
              <div class="date-line">${autoDateKorean}</div>
              <div class="sign-names">
                담임교사: __________________ (인) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 보건담당: __________________ (인) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 원 장: __________________ (인)
              </div>
            </div>
          </div>
        `;
      }).join('');
    } else {
      bodyHtml = `
        <div class="doc-container">
          <div class="header-section">
            <div class="title-wrap">
              <h1>원아 건강상태 및 알레르기·기저질환 관리명부</h1>
              <p class="sub-text">어린이안전관리에 관한 법률 및 보건응급의료 지침 준수</p>
            </div>
          </div>
          <div style="padding: 40px; text-align: center; color: #94a3b8; border: 1px dashed #cbd5e1; border-radius: 6px;">
            등록된 원생 데이터가 없습니다.
          </div>
        </div>
      `;
    }
  } else if (type === 'timetable') {
    // 3순위 필수: 호차별 통학버스 운행 노선표 및 승·하차 정류장 시간표
    const busNameText = bus ? `${bus.name || bus.busNumber || ''} ` : '';
    title = `통학버스_운행노선표_및_시간표_${busNameText || '전체'}`;
    const plateText = bus ? (bus.plateNumber || `${bus.name} 차량`) : '전 차량';
    const driverText = bus ? `${bus.driverName || '미지정'}${bus.driverPhone ? ` (${bus.driverPhone})` : ''}` : '미지정';
    const companionText = bus ? `${bus.teacherName || '미지정'}${bus.teacherPhone ? ` (${bus.teacherPhone})` : ''}` : '미지정';

    // Group or order stops based on busStudents
    let stopRowsHtml = '';
    if (busStudents.length > 0) {
      // Base start time 08:20 for morning, 15:10 for afternoon if not explicitly set on student
      stopRowsHtml = busStudents.map((st, idx) => {
        const raw = st.raw || {};
        const stopLocation = (st.boardingLocation || raw['등원탑승지'] || st.address || raw['주소'] || '-').replace(/\[등\/하차 지점 상세\]:\s*/, '');
        const morningMin = 20 + idx * 5;
        const morningH = 8 + Math.floor(morningMin / 60);
        const morningM = String(morningMin % 60).padStart(2, '0');
        const defaultMorning = `0${morningH}:${morningM}`;

        const afternoonMin = 10 + idx * 5;
        const afternoonH = 15 + Math.floor(afternoonMin / 60);
        const afternoonM = String(afternoonMin % 60).padStart(2, '0');
        const defaultAfternoon = `${afternoonH}:${afternoonM}`;

        const pickupTime = st.pickupTime || raw['등원시간'] || raw['탑승시간'] || defaultMorning;
        const dropoffTime = st.dropoffTime || raw['하원시간'] || defaultAfternoon;
        const classInfo = st.className || raw['반명'] || raw['반'] || '-';
        const phone = st.parentPhone || raw['부모연락처'] || raw['보호자연락처'] || '-';

        return `
          <tr>
            <td class="center bold">${idx + 1}</td>
            <td class="center bold" style="color: #2563eb; font-family: monospace;">${pickupTime}</td>
            <td class="center bold" style="color: #059669; font-family: monospace;">${dropoffTime}</td>
            <td style="font-size: 13px; font-weight: 600; color: #1e293b;">${stopLocation}</td>
            <td class="center bold" style="font-size: 13px;">${st.name || st.realName}</td>
            <td class="center" style="font-size: 12.5px;">${classInfo}</td>
            <td class="center" style="font-size: 12.5px; font-family: monospace;">${phone}</td>
          </tr>
        `;
      }).join('');
    } else {
      stopRowsHtml = `
        <tr>
          <td colspan="7" class="center" style="padding: 14px; color: #94a3b8;">
            배정된 정류장 및 원생 정보가 없습니다.
          </td>
        </tr>
      `;
    }

    bodyHtml = `
      <div class="doc-container">
        <div class="header-section">
          <div class="title-wrap">
            <h1>어린이통학버스 운행 노선표 및 승·하차 시간표</h1>
            <p class="sub-text">도로교통법 제52조 통학버스 운행노선 기록 및 차량 비치·보호자 안내 표준서식</p>
          </div>
          <table class="approval-table">
            <tr>
              <th rowspan="2" class="v-header">결<br>재</th>
              <th>배차담당</th>
              <th>원 장</th>
            </tr>
            <tr>
              <td class="sign-box"></td>
              <td class="sign-box"></td>
            </tr>
          </table>
        </div>

        <table class="info-table">
          <tr>
            <th style="width: 15%;">유 치 원 명</th>
            <td style="width: 35%; font-weight: bold;">${academyName}</td>
            <th style="width: 15%;">시 행 일 자</th>
            <td style="width: 35%; font-weight: bold;">${autoDateKorean} 기준</td>
          </tr>
          <tr>
            <th>운행 호차 / 번호</th>
            <td style="font-weight: bold; color: #2563eb;">${bus ? `${bus.name} (${plateText})` : '전체 노선'}</td>
            <th>운전자 / 차량선생님</th>
            <td style="font-size: 12px;">기사: ${driverText} / 동승: ${companionText}</td>
          </tr>
        </table>

        <div style="margin-top: 14px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: flex-end;">
          <h2 style="font-size: 15px; font-weight: 800; color: #0f172a; margin: 0;">
            ${bus ? `[${bus.name}]` : ''} 경유 정류장 순번 및 승·하차 예정 시각표 (총 ${busStudents.length}개 지점)
          </h2>
          <span style="font-size: 13px; color: #475569; font-weight: 600;">
            ※ 원활하고 안전한 운행을 위해 예정 시각 <strong>5분 전</strong>까지 정류장에서 대기해 주시기 바랍니다.
          </span>
        </div>

        <table class="check-table" style="margin-bottom: 14px;">
          <thead>
            <tr>
              <th style="width: 7%;">순번</th>
              <th style="width: 11%;">등원 예정</th>
              <th style="width: 11%;">하원 예정</th>
              <th style="width: 35%;">승·하차 정류장 (탑승 위치)</th>
              <th style="width: 12%;">탑승 원아</th>
              <th style="width: 10%;">소속 반</th>
              <th style="width: 14%;">보호자 연락처</th>
            </tr>
          </thead>
          <tbody>
            ${stopRowsHtml}
          </tbody>
        </table>

        <div style="padding: 12px 14px; border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 4px; font-size: 13px; line-height: 1.7; color: #334155;">
          <strong style="color: #0f172a; font-size: 13px;">[통학버스 이용 및 정류장 안전 안내]</strong><br>
          1. 도로 사정 및 기상 상황에 따라 도착 시각이 3~5분가량 차이가 날 수 있으며, <strong>Takeme 앱 실시간 위치 알림</strong>을 통해 정확한 도착 예정 시각을 확인하실 수 있습니다.<br>
          2. 결석 또는 자가 등·하원 시에는 원활한 노선 운행을 위해 등원 전 미리 앱 또는 동승보호자에게 알려주시기 바랍니다.<br>
          3. 하원 시에는 지정된 성인 보호자께서 정류장에 나와 직접 원아를 인계받아 주셔야 합니다.
        </div>

        <div class="footer-sign" style="margin-top: 20px;">
          위 노선표에 따라 안전운행 및 정시 운행을 준수할 것을 확인합니다.<br>
          <div class="date-line">${autoDateKorean}</div>
          <div class="sign-names">
            ${academyName} 대표 관리자 (직인)
          </div>
        </div>
      </div>
    `;
  } else if (type === 'handover') {
    // 1순위 필수: 영유아 귀가 동의서 및 응급처치(비상시 병원 이송) 동의서
    const stName = student ? (student.name || student.realName || '') : '';
    const raw = student ? (student.raw || {}) : {};
    const parentName = raw['보호자 성함'] || raw['보호자성함'] || raw['보호자1 성함'] || student?.parentName || '';
    const parentPhone = raw['부모연락처'] || raw['보호자연락처'] || raw['보호자1 연락처'] || student?.parentPhone || '';
    const parentRelation = raw['보호자 관계'] || raw['보호자1 관계'] || '모';
    const parent2Name = raw['보호자2 성함'] || raw['보호자2성함'] || '';
    const parent2Phone = raw['보호자2 연락처'] || raw['보호자2연락처'] || raw['부모연락처2'] || raw['비상연락처'] || '';
    const parent2Relation = raw['보호자2 관계'] || raw['보호자2관계'] || '부';
    const address = raw['주소'] || student?.address || '';
    const schoolGrade = raw['유치원명'] || raw['소속원명'] || raw['학교명']
      ? `${raw['유치원명'] || raw['소속원명'] || raw['학교명']} ${raw['연령'] || raw['학년'] || ''} ${raw['반명'] ? `(${raw['반명']})` : ''}`.trim()
      : (student?.className || student?.grade || '');
    const assignedBusName = raw['등원차량'] || student?.assignedVehicle?.name || (data.selectedBus?.name || '통학버스');
    const allergyText = student?.allergies || raw['알레르기'] || raw['특이사항'] || '';

    title = `영유아_귀가동의서_및_응급처치동의서_${stName || '공란양식'}`;
    bodyHtml = `
      <div class="doc-container">
        <div class="header-section">
          <div class="title-wrap" style="width: 100%; text-align: center;">
            <h1 style="font-size: 24px;">영유아 안전 귀가 동의서 및 응급처치 동의서</h1>
            <p class="sub-text">유아교육법·영유아보육법 및 어린이통학버스 안전점검 필수 구비 표준서식 (${academyName} 귀중)</p>
          </div>
        </div>

        <h2 style="font-size: 12.5px; font-weight: 800; color: #0f172a; margin: 14px 0 6px 0;">
          1. 원아 기본 인적사항
        </h2>
        <table class="info-table">
          <tr>
            <th style="width: 18%;">원 생 성 명</th>
            <td style="width: 32%; font-weight: bold; font-size: 12.5px;">${stName}</td>
            <th style="width: 18%;">소속 반 / 연령</th>
            <td style="width: 32%; font-weight: bold;">${schoolGrade}</td>
          </tr>
          <tr>
            <th>등·하원 방법</th>
            <td style="font-weight: bold; color: #2563eb;">통학차량 이용 (${assignedBusName})</td>
            <th>승·하차 지점(주소)</th>
            <td style="font-size: 13px;">${address}</td>
          </tr>
        </table>

        <h2 style="font-size: 12.5px; font-weight: 800; color: #0f172a; margin: 16px 0 6px 0;">
          2. 하원 시 원아 인계 지정 보호자 (대리인) 등록
        </h2>
        <p style="font-size: 13px; color: #475569; margin: 0 0 6px 0;">
          ※ 영유아 안전사고 예방을 위해 <strong>아래에 사전 등록된 성인 보호자(대리인)에게만 원아를 인계</strong>합니다. 등록되지 않은 제3자에게 인계를 원하실 경우 반드시 사전에 원으로 연락해 주셔야 합니다.
        </p>
        <table class="check-table">
          <thead>
            <tr>
              <th style="width: 14%;">구분</th>
              <th style="width: 20%;">성 명</th>
              <th style="width: 18%;">원아와의 관계</th>
              <th style="width: 26%;">휴대폰 연락처</th>
              <th style="width: 22%;">비고 (주요 인계 요일)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="center bold">제1보호자 (필수)</td>
              <td class="center bold">${parentName}</td>
              <td class="center">${parentName ? (parentRelation || '부 / 모') : ''}</td>
              <td class="center bold" style="font-family: monospace;">${parentPhone}</td>
              <td class="center">${parentName ? '주 보호자 (앱 연동)' : ''}</td>
            </tr>
            <tr>
              <td class="center bold">제2보호자 (대리인)</td>
              <td class="center bold">${parent2Name}</td>
              <td class="center">${parent2Name ? (parent2Relation || '부 / 모') : ''}</td>
              <td class="center bold" style="font-family: monospace;">${parent2Phone}</td>
              <td class="center">${parent2Name ? '비상 연락 및 인계' : ''}</td>
            </tr>
            <tr>
              <td class="center bold">제3보호자 (대리인)</td>
              <td class="center" style="height: 26px;"></td>
              <td class="center"></td>
              <td class="center"></td>
              <td class="center"></td>
            </tr>
          </tbody>
        </table>

        <h2 style="font-size: 12.5px; font-weight: 800; color: #0f172a; margin: 16px 0 6px 0;">
          3. 비상시 응급처치 및 의료기관 이송 동의
        </h2>
        <table class="info-table">
          <tr>
            <th style="width: 22%;">알레르기 및 기저질환</th>
            <td colspan="3" style="font-weight: bold; font-size: 13px; color: #1e293b;">
              ${allergyText && allergyText !== '없음' ? `
                <span style="color: #64748b;">[ &nbsp;&nbsp; ] 없음</span>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                <span style="color: #dc2626;">[ &nbsp;✓&nbsp; ] 있음 (상세 기재: <u>${allergyText}</u>)</span>
              ` : `
                <span>[ &nbsp;&nbsp; ] 없음</span>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                <span>[ &nbsp;&nbsp; ] 있음 (상세 기재: &nbsp;________________________________________________&nbsp;)</span>
              `}
            </td>
          </tr>
          <tr>
            <th style="width: 22%;">희망 이송 의료기관</th>
            <td style="width: 33%;">1순위: 인근 응급의료센터 / 소아과</td>
            <th style="width: 18%;">응급처치 동의</th>
            <td style="width: 27%;" class="center"><span class="check-box" style="margin-right: 4px; font-size: 11px; line-height: 12px; text-align: center;">✓</span> 동의함 &nbsp;&nbsp; <span class="check-box" style="margin-right: 4px;"></span> 동의안함</td>
          </tr>
        </table>

        <div style="margin: 14px 0; padding: 12px 15px; border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 6px; font-size: 13px; line-height: 1.75; color: #334155;">
          <strong>[귀가 및 응급처치 서약 사항]</strong><br>
          1. 본인은 원아의 안전한 하원을 위해 지정된 하차 시각에 맞춰 위 등록된 보호자(또는 대리인)가 정류장에서 직접 인계받을 것을 서약합니다.<br>
          2. 원내 활동 및 통학차량 탑승 중 질병이나 불의의 사고로 인하여 응급상황이 발생했을 때, 보호자에게 즉시 연락이 닿지 않거나 긴급을 요하는 경우 <strong>119 구급대 및 교직원이 인근 지정 의료기관으로 즉시 이송하고 의료진의 판단에 따라 필요한 응급처치를 시행하는 것에 동의</strong>합니다.
        </div>

        <div class="footer-sign" style="margin-top: 22px;">
          위 내용을 충분히 숙지하였으며, 영유아 귀가 인계 지침 및 비상시 응급처치에 동의합니다.<br>
          <div class="date-line">${autoDateKorean}</div>
          <div class="sign-names" style="margin-top: 18px;">
            보호자 성명: <span style="font-weight: bold; text-decoration: underline;">&nbsp;&nbsp;${parentName || '__________________'} &nbsp;&nbsp;</span> (자필 서명 또는 인)
          </div>
        </div>
      </div>
    `;
  } else if (type === 'consent') {
    // Student Bus Application & Consent Form ('consent')
    const stName = student ? (student.name || student.realName || '') : '';
    const raw = student ? (student.raw || {}) : {};
    const parentName = raw['보호자 성함'] || raw['보호자성함'] || student?.parentName || '';
    const parentPhone = raw['부모연락처'] || raw['보호자연락처'] || student?.parentPhone || '';
    const address = raw['주소'] || student?.address || '';
    const schoolGrade = raw['유치원명'] || raw['소속원명'] || raw['학교명']
      ? `${raw['유치원명'] || raw['소속원명'] || raw['학교명']} ${raw['연령'] || raw['학년'] || ''} ${raw['반명'] ? `(${raw['반명']})` : ''}`.trim()
      : (student?.className || student?.grade || '');
    const assignedBusName = raw['등원차량'] || student?.assignedVehicle?.name || (data.selectedBus?.name || '');

    title = `통학차량이용신청서_${stName || '공란양식'}`;
    bodyHtml = `
      <div class="doc-container">
        <div class="header-section">
          <div class="title-wrap" style="width: 100%; text-align: center;">
            <h1 style="font-size: 24px;">어린이 통학차량 이용 신청 및 안전동의서</h1>
            <p class="sub-text">${academyName ? `${academyName} 귀중` : '기관 관리자 귀중'}</p>
          </div>
        </div>

        <table class="info-table" style="margin-top: 20px;">
          <tr>
            <th style="width: 18%;">원 생 명</th>
            <td style="width: 32%; font-weight: bold; font-size: 15px; color: #1e293b;">${stName}</td>
            <th style="width: 18%;">유치원 / 연령 / 반</th>
            <td style="width: 32%; font-weight: bold;">${schoolGrade}</td>
          </tr>
          <tr>
            <th>보호자 성명</th>
            <td style="font-weight: bold;">${parentName}</td>
            <th>보호자 연락처</th>
            <td style="font-weight: bold; font-family: monospace;">${parentPhone}</td>
          </tr>
          <tr>
            <th>배정 희망 차량</th>
            <td style="font-weight: bold; color: #2563eb;">${assignedBusName || '유치원 배차 규정에 따름'}</td>
            <th>탑승지 (주소)</th>
            <td style="font-size: 13px;">${address}</td>
          </tr>
        </table>

        <div style="margin: 25px 0; padding: 18px; border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 6px;">
          <h3 style="font-size: 15px; font-weight: bold; margin-bottom: 10px; color: #1e293b;">[통학차량 안전수칙 준수 서약]</h3>
          <ol style="font-size: 13px; line-height: 2.0; color: #334155; padding-left: 20px; margin: 0;">
            <li>원생은 차량 탑승 즉시 좌석 안전띠를 반드시 착용하고, 차량이 완전히 멈출 때까지 절대 풀지 않습니다.</li>
            <li>차량 운행 중에는 창밖으로 손이나 머리를 내밀지 않으며, 자리에서 일어나거나 장난을 치지 않습니다.</li>
            <li>승·하차 시에는 동승보호자의 안내에 따라 차례대로 손잡이를 잡고 안전하게 승·하차합니다.</li>
            <li>지정된 탑승 시간 3분 전까지 정류장에 도착하여 대기하도록 지도하겠습니다.</li>
            <li>원아의 건강 이상이나 결석 발생 시 유치원 및 담당 기사님께 사전에 미리 통보하겠습니다.</li>
          </ol>
        </div>

        <div class="footer-sign" style="margin-top: 50px;">
          본인은 상기 안전수칙을 충분히 숙지하였으며, 자녀의 안전한 통학차량 이용을 위해 적극 협조할 것에 동의합니다.<br><br>
          <div class="date-line">${autoDateKorean}</div>
          <div class="sign-names" style="margin-top: 35px;">
            보호자 성명: <span style="font-weight: bold; text-decoration: underline;">&nbsp;&nbsp;${parentName || '__________________'} &nbsp;&nbsp;</span> (자필 서명)
          </div>
        </div>
      </div>
    `;
  } else if (type === 'consent-driver-location') {
    const driverName = bus ? (bus.driverName && bus.driverName !== '미정' ? bus.driverName : '') : '';
    const driverPhone = bus ? (bus.driverPhone || '') : '';
    const busPlate = bus ? (bus.plateNumber || '') : '';
    const busNameText = bus ? (bus.name || `${bus.busNumber}호차`) : '통학차량 전용';

    title = `기사_위치정보수집이용동의서_${driverName || '운전자'}`;
    bodyHtml = `
      <div class="doc-container">
        <div class="header-section">
          <div class="title-wrap" style="width: 100%; text-align: center;">
            <h1 style="font-size: 24px;">어린이통학버스 운전자 위치정보 수집·이용 동의서</h1>
            <p class="sub-text">위치정보의 보호 및 이용 등에 관한 법률 제15조 및 도로교통법 제53조 준수</p>
          </div>
        </div>

        <div style="margin: 15px 0 10px 0; font-size: 13px; color: #475569; line-height: 1.6;">
          ${academyName}은(는) 「위치정보의 보호 및 이용 등에 관한 법률」 제15조(위치정보의 수집 등의 금지) 규정에 따라 통학차량 실시간 안전 관제 및 원아 안심 승하차 알림 서비스를 위해 운전자의 개인위치정보를 수집·이용하고자 하오니 아래 내용을 확인하시고 동의하여 주시기 바랍니다.
        </div>

        <table class="info-table" style="margin-top: 10px;">
          <tr>
            <th style="width: 18%;">운전자 성명</th>
            <td style="width: 32%; font-weight: bold; font-size: 15px;">${driverName || '__________________'}</td>
            <th style="width: 18%;">생년월일</th>
            <td style="width: 32%;">______년 ___월 ___일</td>
          </tr>
          <tr>
            <th>연 락 처</th>
            <td style="font-family: monospace; font-weight: bold;">${driverPhone || '010-____-____'}</td>
            <th>소속 기관</th>
            <td style="font-weight: bold;">${academyName}</td>
          </tr>
          <tr>
            <th>담당 차량 (호차)</th>
            <td style="font-weight: bold; color: #2563eb;">${busNameText}</td>
            <th>차량 등록번호</th>
            <td style="font-weight: bold;">${busPlate || '예: 77가 1234'}</td>
          </tr>
        </table>

        <div style="margin: 18px 0; padding: 14px 16px; border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 6px; font-size: 13px; line-height: 1.8; color: #334155;">
          <h4 style="margin: 0 0 6px 0; font-size: 14px; color: #1e293b; font-weight: bold;">[위치정보 수집 및 이용에 관한 법정 고지]</h4>
          <ol style="margin: 0; padding-left: 18px;">
            <li><b>수집·이용 목적:</b> 어린이통학버스 실시간 이동 경로 및 운행 상태 관제, 실시간 도착 알림 서비스 제공, 차량 안전 사고 예방 및 긴급 구호 조치</li>
            <li><b>수집하는 위치정보 항목:</b> 모바일 단말기(스마트폰 기사용 앱)의 실시간 GPS 위치 좌표(위도, 경도), 이동 속도, 운행 시각 및 궤적</li>
            <li><b>위치정보의 보유 및 이용 기간:</b> 당일 운행 종료 및 용역/근로 계약 종료 시까지 (분쟁 해결 및 감사 증빙을 위해 최장 6개월 보관 후 복구 불가능하게 파기)</li>
            <li><b>위치정보의 제3자 제공:</b> 실시간 통학버스 위치는 원생 보호자(학부모) 및 시설 관리자에게 '안심 승하차 관제' 목적으로만 한정 제공됩니다.</li>
            <li><b>동의를 거부할 권리 및 불이익:</b> 운전자는 위치정보 수집·이용 동의를 거부할 권리가 있습니다. 단, 동의 거부 시 실시간 통학차량 안전 관제 시스템 이용 및 통학차량 운행 업무 수행에 제한이 따를 수 있습니다.</li>
          </ol>
        </div>

        <div style="border: 1px solid #94a3b8; background: #ffffff; padding: 10px 14px; border-radius: 6px; text-align: center; font-size: 14px; font-weight: bold; margin-bottom: 25px;">
          본인은 상기 위치정보의 수집·이용 및 제3자 제공에 관한 모든 내용을 충분히 이해하였으며 이에 동의합니다.<br>
          <span style="font-size: 13px; font-weight: normal; color: #475569;">[ &nbsp; ] 위 위치정보 수집 및 이용에 동의함 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; [ &nbsp; ] 동의하지 않음</span>
        </div>

        <div class="footer-sign" style="margin-top: 30px;">
          <div class="date-line">${autoDateKorean}</div>
          <div class="sign-names" style="margin-top: 30px;">
            운전자(기사) 성명: <span style="font-weight: bold; text-decoration: underline;">&nbsp;&nbsp;${driverName || '__________________'} &nbsp;&nbsp;</span> (자필 서명)
          </div>
          <div style="margin-top: 15px; font-size: 15px; font-weight: bold; color: #1e293b;">
            ${academyName} 귀중
          </div>
        </div>
      </div>
    `;
  } else if (type === 'consent-privacy-student') {
    const stName = student ? (student.realName || student.name || '') : '';
    const parentName = student ? (student.raw?.['보호자 성함'] || student.raw?.['학부모성함'] || '') : '';
    const parentPhone = student ? (student.raw?.['부모연락처'] || student.raw?.['보호자연락처'] || student.raw?.['보호자 연락처'] || '') : '';
    const address = student ? (student.address || '') : '';
    const schoolGrade = student ? `${student.raw?.['유치원명'] || student.raw?.['학교명'] || academyName} ${student.raw?.['반명'] ? `(${student.raw['반명']})` : ''}` : academyName;
    const allergies = student ? (student.allergies || student.raw?.['알레르기'] || '특이사항 없음') : '특이사항 없음';

    title = `원생_학부모_개인정보동의서_${stName || '공란양식'}`;
    bodyHtml = `
      <div class="doc-container">
        <div class="header-section">
          <div class="title-wrap" style="width: 100%; text-align: center;">
            <h1 style="font-size: 24px;">원생 및 보호자 개인정보 수집·이용 및 제공 동의서</h1>
            <p class="sub-text">개인정보보호법 제15조(수집·이용) 및 제17조(제3자 제공), 제23조(민감정보 처리) 준수</p>
          </div>
        </div>

        <table class="info-table" style="margin-top: 15px;">
          <tr>
            <th style="width: 18%;">원 생 명</th>
            <td style="width: 32%; font-weight: bold; font-size: 15px;">${stName || '__________________'}</td>
            <th style="width: 18%;">소속 / 반명</th>
            <td style="width: 32%; font-weight: bold;">${schoolGrade}</td>
          </tr>
          <tr>
            <th>보호자 성명</th>
            <td style="font-weight: bold;">${parentName || '__________________'}</td>
            <th>보호자 연락처</th>
            <td style="font-weight: bold; font-family: monospace;">${parentPhone || '010-____-____'}</td>
          </tr>
          <tr>
            <th>탑승지 (주소)</th>
            <td colspan="3" style="font-size: 13px;">${address || '________________________________________________________'}</td>
          </tr>
        </table>

        <!-- 1. 기본 개인정보 수집 및 이용 -->
        <div style="margin: 15px 0 10px 0; padding: 12px; border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 6px; font-size: 13px; line-height: 1.7;">
          <h4 style="margin: 0 0 5px 0; font-size: 14px; color: #1e293b; font-weight: bold;">1. [필수] 개인정보 수집 및 이용 동의</h4>
          <div>• <b>수집 항목:</b> 원생 성명, 생년월일, 성별, 주소(탑승지/하원지), 보호자 성명 및 휴대전화번호, 비상연락처</div>
          <div>• <b>수집·이용 목적:</b> 통학차량 노선 배정, 탑승자 명부 작성, 승하차 실시간 알림, 비상상황 긴급 연락</div>
          <div>• <b>보유 및 이용 기간:</b> ${academyName} 이용 시까지 (원아 재원·졸업/퇴원 시까지 및 관계법령에 따른 보존 의무 기간 준수)</div>
          <div style="margin-top: 6px; text-align: right; font-weight: bold; color: #1e40af;">
            개인정보 수집 및 이용에 동의하십니까? &nbsp;&nbsp; [ &nbsp; ] 동의함 &nbsp;&nbsp;&nbsp; [ &nbsp; ] 동의하지 않음
          </div>
        </div>

        <!-- 2. 민감정보(건강/알레르기) 처리 동의 -->
        <div style="margin: 10px 0; padding: 12px; border: 1px solid #cbd5e1; background: #fffbeb; border-radius: 6px; font-size: 13px; line-height: 1.7;">
          <h4 style="margin: 0 0 5px 0; font-size: 14px; color: #92400e; font-weight: bold;">2. [선택] 민감정보(건강 및 알레르기) 수집 및 이용 동의</h4>
          <div>• <b>수집 항목:</b> 원생 지병, 알레르기 유발 식품/물질 (${allergies}), 특이 체질 및 응급처치 주의사항</div>
          <div>• <b>수집 목적:</b> 차량 내 응급상황 발생 시 신속하고 적절한 응급처치 및 병원 후송 시 의료진 전달</div>
          <div>• <b>보유 기간:</b> ${academyName} 이용 시까지</div>
          <div style="margin-top: 6px; text-align: right; font-weight: bold; color: #b45309;">
            민감정보 수집 및 이용에 동의하십니까? &nbsp;&nbsp; [ &nbsp; ] 동의함 &nbsp;&nbsp;&nbsp; [ &nbsp; ] 동의하지 않음
          </div>
        </div>

        <!-- 3. 개인정보 제3자 제공 동의 -->
        <div style="margin: 10px 0 20px 0; padding: 12px; border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 6px; font-size: 12px; line-height: 1.7;">
          <h4 style="margin: 0 0 5px 0; font-size: 13px; color: #1e293b; font-weight: bold;">3. [필수] 개인정보 제3자 제공 동의</h4>
          <div>• <b>제공받는 자:</b> 통학차량 운전기사 및 차량선생님(동승자), 긴급구조기관(소방서·경찰서·의료기관)</div>
          <div>• <b>제공 목적:</b> 안전 승하차 인솔, 결석·지각 확인, 긴급 환자 이송 및 사고 대응</div>
          <div>• <b>제공 항목:</b> 원생 성명, 탑승지, 보호자 연락처, 긴급처치 정보</div>
          <div style="margin-top: 6px; text-align: right; font-weight: bold; color: #1e40af;">
            개인정보 제3자 제공에 동의하십니까? &nbsp;&nbsp; [ &nbsp; ] 동의함 &nbsp;&nbsp;&nbsp; [ &nbsp; ] 동의하지 않음
          </div>
        </div>

        <div class="footer-sign" style="margin-top: 25px;">
          본인은 만 14세 미만 아동(원생)의 법정대리인으로서 본 동의서의 내용을 확인하고 동의합니다.<br><br>
          <div class="date-line">${autoDateKorean}</div>
          <div class="sign-names" style="margin-top: 25px;">
            법정대리인(보호자) 성명: <span style="font-weight: bold; text-decoration: underline;">&nbsp;&nbsp;${parentName || '__________________'} &nbsp;&nbsp;</span> (자필 서명)
          </div>
          <div style="margin-top: 15px; font-size: 15px; font-weight: bold; color: #1e293b;">
            ${academyName} 귀중
          </div>
        </div>
      </div>
    `;
  } else if (type === 'consent-privacy-staff') {
    const driverName = bus ? (bus.driverName && bus.driverName !== '미정' ? bus.driverName : '') : '';
    const companionName = bus ? (bus.teacherName && bus.teacherName !== '미정' ? bus.teacherName : '') : '';

    title = `종사자_기사_교사_개인정보동의서`;
    bodyHtml = `
      <div class="doc-container">
        <div class="header-section">
          <div class="title-wrap" style="width: 100%; text-align: center;">
            <h1 style="font-size: 24px;">통학차량 종사자(기사·교사) 개인정보 수집·이용 동의서</h1>
            <p class="sub-text">개인정보보호법 및 도로교통법 제53조 준수 (어린이통학버스 운영자 법정 구비 서식)</p>
          </div>
        </div>

        <table class="info-table" style="margin-top: 20px;">
          <tr>
            <th style="width: 20%;">직 구분</th>
            <td style="width: 30%;">[ &nbsp; ] 운전기사 &nbsp;&nbsp; [ &nbsp; ] 차량선생님(동승자)</td>
            <th style="width: 20%;">성 명</th>
            <td style="width: 30%; font-weight: bold;">${driverName || companionName || '__________________'}</td>
          </tr>
          <tr>
            <th>생년월일</th>
            <td>______년 ___월 ___일</td>
            <th>연 락 처</th>
            <td>010-____-____</td>
          </tr>
          <tr>
            <th>주 소</th>
            <td colspan="3">____________________________________________________________________</td>
          </tr>
          <tr>
            <th>면허/자격 사항</th>
            <td>[ &nbsp; ] 1종대형 &nbsp; [ &nbsp; ] 1종보통 &nbsp; [ &nbsp; ] 보육/정교사</td>
            <th>안전교육이수일</th>
            <td>20___년 ___월 ___일</td>
          </tr>
        </table>

        <div style="margin: 25px 0; padding: 16px; border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 6px; font-size: 13px; line-height: 1.9; color: #334155;">
          <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #1e293b; font-weight: bold;">[종사자 개인정보 수집 및 법적 검증 고지]</h4>
          <ol style="margin: 0; padding-left: 18px;">
            <li><b>수집 목적:</b> 어린이통학버스 운전자 및 동승보호자의 법정 적격 심사(도로교통법 제53조), 관할 경찰서 및 교육청 신고 등록, 성범죄 및 아동학대 관련 범죄전력 조회 확인, 긴급 비상연락체계 구축</li>
            <li><b>수집 항목:</b> 성명, 주민등록번호(고유식별정보 - 도로교통법 및 아동복지법에 따른 법령상 처리), 주소, 휴대전화번호, 운전면허정보, 통학버스 안전교육 이수증 사본</li>
            <li><b>보유 및 이용 기간:</b> 고용/용역 계약 종료 후 3년간 보관 (근로기준법 및 도로교통법 의무 보존 규정 준수) 후 영구 파기</li>
            <li><b>제3자 제공:</b> 도로교통법에 따른 관할 경찰서장(어린이통학버스 신고), 관할 교육지원청(학원/유치원 지도점검부서)에 한정 제출됩니다.</li>
          </ol>
        </div>

        <div style="border: 1px solid #94a3b8; background: #ffffff; padding: 12px; border-radius: 6px; text-align: center; font-size: 14px; font-weight: bold; margin-bottom: 30px;">
          본인은 상기 개인정보 및 고유식별정보의 수집·이용과 관할 관청 제출에 동의합니다.<br>
          <span style="font-size: 13px; font-weight: normal; color: #475569;">[ &nbsp; ] 동의함 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; [ &nbsp; ] 동의하지 않음</span>
        </div>

        <div class="footer-sign" style="margin-top: 40px;">
          <div class="date-line">${autoDateKorean}</div>
          <div class="sign-names" style="margin-top: 30px;">
            종사자(기사·교사) 성명: <span style="font-weight: bold; text-decoration: underline;">&nbsp;&nbsp;${driverName || companionName || '__________________'} &nbsp;&nbsp;</span> (자필 서명)
          </div>
          <div style="margin-top: 15px; font-size: 15px; font-weight: bold; color: #1e293b;">
            ${academyName} 귀중
          </div>
        </div>
      </div>
    `;
  } else if (type === 'accounting-expense-report') {
    const busNameText = bus ? `${bus.name || `${bus.busNumber}호차`}` : '전체 통학차량';
    const plateText = bus ? (bus.plateNumber || '77가 1024') : '77가 1024';
    const driverText = bus ? (bus.driverName && bus.driverName !== '미정' ? bus.driverName : '김철수') : '김철수';

    title = `통학차량_운영비_및_유류비_정산서_${busNameText}`;
    bodyHtml = `
      <div class="doc-container">
        <div class="header-section">
          <div class="title-wrap">
            <h1 style="font-size: 24px;">통학차량 운영비 및 유류비 정산서</h1>
            <p class="sub-text">회계 세무 증빙 및 통학차량 운영비 지출결의 표준서식 [${busNameText}]</p>
          </div>
          <table class="approval-table">
            <tr>
              <th rowspan="2" class="v-header">결<br>재</th>
              <th>담 당</th>
              <th>출 납</th>
              <th>기관장(원장)</th>
            </tr>
            <tr>
              <td style="height: 48px;"></td>
              <td></td>
              <td></td>
            </tr>
          </table>
        </div>

        <table class="info-table" style="margin-top: 15px;">
          <tr>
            <th style="width: 18%;">정산 대상 차량</th>
            <td style="width: 32%; font-weight: bold; color: #2563eb;">${busNameText} (${plateText})</td>
            <th style="width: 18%;">운전자 (기사)</th>
            <td style="width: 32%; font-weight: bold;">${driverText}</td>
          </tr>
          <tr>
            <th>정 산 기 간</th>
            <td style="font-weight: bold;">${year}년 ${month}월분 정산</td>
            <th>소 속 기 관</th>
            <td style="font-weight: bold;">${academyName}</td>
          </tr>
        </table>

        <!-- 지출 내역 항목별 명세 (수기 작성용 공란 서식) -->
        <table class="list-table" style="margin-top: 20px;">
          <thead>
            <tr>
              <th style="width: 14%;">지출 일자</th>
              <th style="width: 18%;">항 목</th>
              <th style="width: 36%;">내 역 (주유소명 / 품명 / 구간)</th>
              <th style="width: 16%;">금 액 (원)</th>
              <th style="width: 16%;">증빙 첨부</th>
            </tr>
          </thead>
          <tbody>
            <tr style="height: 35px;">
              <td style="text-align: center;">&nbsp;</td>
              <td style="text-align: center;">&nbsp;</td>
              <td>&nbsp;</td>
              <td style="text-align: right;">&nbsp;</td>
              <td style="text-align: center;">&nbsp;</td>
            </tr>
            <tr style="height: 35px;">
              <td style="text-align: center;">&nbsp;</td>
              <td style="text-align: center;">&nbsp;</td>
              <td>&nbsp;</td>
              <td style="text-align: right;">&nbsp;</td>
              <td style="text-align: center;">&nbsp;</td>
            </tr>
            <tr style="height: 35px;">
              <td style="text-align: center;">&nbsp;</td>
              <td style="text-align: center;">&nbsp;</td>
              <td>&nbsp;</td>
              <td style="text-align: right;">&nbsp;</td>
              <td style="text-align: center;">&nbsp;</td>
            </tr>
            <tr style="height: 35px;">
              <td style="text-align: center;">&nbsp;</td>
              <td style="text-align: center;">&nbsp;</td>
              <td>&nbsp;</td>
              <td style="text-align: right;">&nbsp;</td>
              <td style="text-align: center;">&nbsp;</td>
            </tr>
            <tr style="height: 35px;">
              <td style="text-align: center;">&nbsp;</td>
              <td style="text-align: center;">&nbsp;</td>
              <td>&nbsp;</td>
              <td style="text-align: right;">&nbsp;</td>
              <td style="text-align: center;">&nbsp;</td>
            </tr>
            <tr style="height: 35px;">
              <td style="text-align: center;">&nbsp;</td>
              <td style="text-align: center;">&nbsp;</td>
              <td>&nbsp;</td>
              <td style="text-align: right;">&nbsp;</td>
              <td style="text-align: center;">&nbsp;</td>
            </tr>
            <tr style="height: 35px;">
              <td style="text-align: center;">&nbsp;</td>
              <td style="text-align: center;">&nbsp;</td>
              <td>&nbsp;</td>
              <td style="text-align: right;">&nbsp;</td>
              <td style="text-align: center;">&nbsp;</td>
            </tr>
            <tr style="height: 35px;">
              <td style="text-align: center;">&nbsp;</td>
              <td style="text-align: center;">&nbsp;</td>
              <td>&nbsp;</td>
              <td style="text-align: right;">&nbsp;</td>
              <td style="text-align: center;">&nbsp;</td>
            </tr>
            <tr style="background: #f8fafc; font-weight: bold; height: 38px;">
              <td colspan="3" style="text-align: center; font-size: 14.5px;">합 &nbsp;&nbsp;&nbsp;&nbsp; 계 (총 지출액)</td>
              <td style="text-align: right; font-size: 13.5px; font-family: monospace; padding-right: 12px;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 원</td>
              <td style="text-align: center; font-size: 13px;">영수증 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 매</td>
            </tr>
          </tbody>
        </table>

        <!-- 영수증 부착 및 확인 박스 -->
        <div style="margin-top: 20px; padding: 15px; border: 1px dashed #94a3b8; background: #fafafa; border-radius: 6px; text-align: center; color: #64748b; font-size: 13px;">
          <b>[ 영수증 부착 및 확인 안내 ]</b><br>
          신용카드 매출전표, 현금영수증, 세금계산서 원본을 본 정산서 뒷면에 부착하여 결재 바랍니다.<br>
          위 통학차량 운영 지출 내역은 학원·유치원 회계 관리 규정에 따라 정당하게 집행되었음을 확인합니다.
        </div>

        <div class="footer-sign" style="margin-top: 35px;">
          <div class="date-line">${autoDateKorean}</div>
          <div class="sign-names" style="margin-top: 25px;">
            정산 보고자(운전자/담당자): <span style="font-weight: bold; text-decoration: underline;">&nbsp;&nbsp;${driverText} &nbsp;&nbsp;</span> (자필 서명)
          </div>
        </div>
      </div>
    `;
  } else if (type === 'attendance-log' || type === 'attendance') {
    title = `교직원_및_셔틀운행인력_월간근태표_${academyName}`;
    const staffName = bus ? (bus.driverName && bus.driverName !== '미정' ? bus.driverName : (bus.teacherName && bus.teacherName !== '미정' ? bus.teacherName : '교직원 / 셔틀인력')) : '교직원 / 셔틀인력';
    const staffRole = bus ? (bus.driverName ? '통학버스 운전기사' : '차량선생님(동승교사)') : '교직원 / 셔틀담당자';
    const busText = bus ? `${bus.name} (${bus.plateNumber || '전용차량'})` : '원내 상주 / 셔틀 전담';

    // Generate month day rows (1 to 31)
    const daysInMonth = new Date(year, month, 0).getDate();
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    let rowsHtml = '';

    for (let d = 1; d <= daysInMonth; d++) {
      const dayDate = new Date(year, month - 1, d);
      const dayOfWeek = dayNames[dayDate.getDay()];
      const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
      const rowBg = isWeekend ? 'background-color: #f8fafc; color: #94a3b8;' : '';

      rowsHtml += `
        <tr style="${rowBg}">
          <td style="text-align: center; font-weight: bold;">${d}</td>
          <td style="text-align: center; font-weight: ${isWeekend ? 'normal' : 'bold'}; ${dayOfWeek === '일' ? 'color: #ef4444;' : dayOfWeek === '토' ? 'color: #3b82f6;' : ''}">${dayOfWeek}</td>
          <td style="text-align: center;">${isWeekend ? '-' : ''}</td>
          <td style="text-align: center;">${isWeekend ? '-' : ''}</td>
          <td style="text-align: center;">${isWeekend ? '-' : ''}</td>
          <td style="text-align: center;">${isWeekend ? '-' : ''}</td>
          <td style="text-align: center;">${isWeekend ? '휴무' : ''}</td>
        </tr>
      `;
    }

    bodyHtml = `
      <div class="doc-container">
        <div class="header-section">
          <div class="title-wrap">
            <h1>교직원 및 셔틀 운행인력 월간 근태표</h1>
            <p class="sub-text">근로기준법 제41조 및 제42조 준수 표준 출근부 (주휴수당 및 셔틀 운행시간 산정)</p>
          </div>
          <table class="approval-table">
            <tr>
              <th rowspan="2" class="v-header">결<br>재</th>
              <th>작성자</th>
              <th>안전책임자</th>
              <th>원 장</th>
            </tr>
            <tr>
              <td class="sign-box"></td>
              <td class="sign-box"></td>
              <td class="sign-box"></td>
            </tr>
          </table>
        </div>

        <table class="info-table">
          <tr>
            <th style="width: 15%;">유치원·학원명</th>
            <td style="width: 35%; font-weight: bold;">${academyName}</td>
            <th style="width: 15%;">대상 연월</th>
            <td style="width: 35%; font-weight: bold; color: #2563eb;">${year}년 ${String(month).padStart(2, '0')}월</td>
          </tr>
          <tr>
            <th>성 명</th>
            <td style="font-weight: bold;">${staffName}</td>
            <th>직책 / 직무</th>
            <td>${staffRole}</td>
          </tr>
          <tr>
            <th>배정 호차</th>
            <td>${busText}</td>
            <th>소정 근로시간</th>
            <td>일 8시간 (또는 셔틀 운행스케줄 기준)</td>
          </tr>
        </table>

        <!-- Monthly Attendance Grid -->
        <table class="grid-table" style="margin-top: 15px; font-size: 11px;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="width: 8%;">일자</th>
              <th style="width: 8%;">요일</th>
              <th style="width: 18%;">출근 시각</th>
              <th style="width: 18%;">퇴근 시각</th>
              <th style="width: 16%;">인정 근무시간</th>
              <th style="width: 14%;">확인 (서명)</th>
              <th style="width: 18%;">비고 (휴가/대체)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <!-- Monthly Summary Box -->
        <table class="grid-table" style="margin-top: 15px; font-size: 12px; background: #fafafa;">
          <tr style="font-weight: bold;">
            <th style="width: 25%; background: #e2e8f0;">총 근무일수</th>
            <td style="width: 25%; text-align: center;">_______ 일</td>
            <th style="width: 25%; background: #e2e8f0;">연장 / 휴일 근무</th>
            <td style="width: 25%; text-align: center;">_______ 시간</td>
          </tr>
          <tr style="font-weight: bold;">
            <th style="background: #e2e8f0;">유급휴가(연차/반차)</th>
            <td style="text-align: center;">_______ 일</td>
            <th style="background: #e2e8f0;">결근 / 병가 / 공가</th>
            <td style="text-align: center;">_______ 일</td>
          </tr>
        </table>

        <div style="margin-top: 15px; padding: 10px; border: 1px dashed #cbd5e1; background: #f8fafc; border-radius: 6px; font-size: 11px; color: #64748b; line-height: 1.5;">
          <strong>법적 효력 및 보존 안내</strong>: 본 출근부는 근로기준법상 3년간 보존 의무가 있는 법정 근태 대장입니다. 셔틀 운행 시작/종료 로그 및 GPS 탑승 기록을 기반으로 작성되며, 급여 계산 및 주 15시간 이상 주휴수당 적격 심사 자료로 활용됩니다.
        </div>

        <div class="footer-sign" style="margin-top: 25px;">
          <div class="date-line">${autoDateKorean}</div>
          <div class="sign-names" style="margin-top: 15px;">
            근무자 성명: <span style="font-weight: bold; text-decoration: underline;">&nbsp;&nbsp;${staffName}&nbsp;&nbsp;</span> (인/서명)
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            유치원·학원 대표자: <span style="font-weight: bold; text-decoration: underline;">&nbsp;&nbsp;${academyName} 원장&nbsp;&nbsp;</span> (직인)
          </div>
        </div>
      </div>
    `;
  } else if (type === 'safety-manual') {
    // 안전자료 1: 어린이 통학버스 안전운행 표준 매뉴얼
    const busNameText = bus ? `${bus.name || bus.busNumber || ''} ` : '';
    title = `어린이통학버스_안전운행_표준매뉴얼_${busNameText || '기관공통'}`;
    const plateText = bus ? (bus.plateNumber || `${bus.name} 차량`) : '전 차량 공통';
    const driverText = bus ? `${bus.driverName || '미지정'}${bus.driverPhone ? ` (${bus.driverPhone})` : ''}` : '담당 기사님';
    const companionText = bus ? `${bus.teacherName || '미지정'}${bus.teacherPhone ? ` (${bus.teacherPhone})` : ''}` : '담당 동승보호자';

    bodyHtml = `
      <div class="doc-container">
        <div class="header-section">
          <div class="title-wrap">
            <h1>어린이 통학버스 안전운행 표준 매뉴얼 및 행동수칙</h1>
            <p class="sub-text">도로교통법 제53조 및 교육부·경찰청 어린이통학버스 안전관리 표준지침 준수</p>
          </div>
          <table class="approval-table">
            <tr>
              <th rowspan="2" class="v-header">결<br>재</th>
              <th>안전담당</th>
              <th>원 장</th>
            </tr>
            <tr>
              <td class="sign-box"></td>
              <td class="sign-box"></td>
            </tr>
          </table>
        </div>

        <table class="info-table" style="margin-bottom: 16px;">
          <tr>
            <th style="width: 16%;">기 관 명</th>
            <td style="width: 34%; font-weight: bold;">${academyName}</td>
            <th style="width: 16%;">제정 / 시행일</th>
            <td style="width: 34%; font-weight: bold;">${autoDateKorean}</td>
          </tr>
          <tr>
            <th>지정 호차</th>
            <td style="font-weight: bold; color: #2563eb;">${bus ? `${bus.name} (${plateText})` : '원내 전 통학차량 공통'}</td>
            <th>담당 종사자</th>
            <td style="font-size: 13px;">운전자: ${driverText} / 동승보호자: ${companionText}</td>
          </tr>
        </table>
        <!-- 제1장: 운행 전 필수 점검 -->
        <div style="margin-bottom: 14px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
          <div style="background: #f1f5f9; padding: 8px 14px; font-weight: bold; color: #0f172a; font-size: 14px; border-bottom: 1px solid #cbd5e1;">
            제1장. 출발 전 필수 안전점검 수칙 (운전자·동승보호자 합동 점검)
          </div>
          <div style="padding: 10px 14px; font-size: 12.5px; line-height: 1.8; color: #334155;">
            1. <b>차량 외관 및 안전장치 확인:</b> 타이어 공기압·마모도, 후방영상장치(후방카메라), 후진경고음 발생장치, 어린이 정지표시장치 정상 작동 여부를 점검합니다.<br>
            2. <b>비상용품 및 구급장비 비치:</b> 소화기(게이지 압력 확인), 비상탈출용 안전망치(차내 2개소 이상), 비상 구급약품 세트 완비 여부를 확인합니다.<br>
            3. <b>안전벨트 및 유아보호장구 점검:</b> 전 좌석 안전벨트 체결 작동 및 꼬임 여부를 확인하고 탑승 전 원아 맞춤형 높이조절 장치를 준비합니다.
          </div>
        </div>

        <!-- 제2장: 승·하차 및 운행 중 안전지도 -->
        <div style="margin-bottom: 14px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
          <div style="background: #eff6ff; padding: 8px 14px; font-weight: bold; color: #1e40af; font-size: 14px; border-bottom: 1px solid #bfdbfe;">
            제2장. 승·하차 시 사각지대 예방 및 운행 중 안전지도 수칙
          </div>
          <div style="padding: 10px 14px; font-size: 12.5px; line-height: 1.8; color: #334155;">
            1. <b>전 좌석 안전벨트 착용 의무:</b> 모든 원아가 착석하여 안전벨트를 완전히 착용한 것을 동승보호자가 육안 확인한 후 운전자에게 출발 신호를 보냅니다.<br>
            2. <b>어린이 보호구역 속도 준수:</b> 스쿨존 내 30km/h 이하 서행 준수 및 급출발·급제동·급차선변경을 절대 금지합니다.<br>
            3. <b>승·하차 사각지대 확인:</b> 정류장 정차 후 문을 열기 전 우측 후방의 오토바이·자전거를 확인하고, 동승보호자가 먼저 하차하여 원아를 직접 대면 인계합니다.<br>
            4. <b>원아 보도 이동 확인 후 출발:</b> 하차한 원아가 안전한 인도/보호자 품으로 완전히 이동한 것을 확인한 후 차량을 출발시킵니다.
          </div>
        </div>

        <!-- 제3장: 운행 종료 및 갇힘 방지 -->
        <div style="margin-bottom: 14px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
          <div style="background: #fef2f2; padding: 8px 14px; font-weight: bold; color: #991b1b; font-size: 14px; border-bottom: 1px solid #fecaca;">
            제3장. 운행 종료 후 잔류원아 확인(갇힘 방지) 및 슬리핑차일드체크
          </div>
          <div style="padding: 10px 14px; font-size: 12.5px; line-height: 1.8; color: #334155;">
            1. <b>하차확인장치(슬리핑차일드 벨) 필수 해제:</b> 시동을 끈 후 3분 이내 맨 뒷좌석에 설치된 확인 벨을 직접 이동하여 누릅니다.<br>
            2. <b>차량 내부 전 좌석 전수 육안 점검:</b> 의자 밑, 좌석 틈새에 잠든 원아나 소지품이 남아있는지 맨 앞좌석부터 맨 끝좌석까지 철저히 확인합니다.<br>
            3. <b>잔류원아 제로 확인 서명:</b> 당일 탑승일지에 최종 탑승 인원과 하차 인원의 일치 여부를 대조하고 확인 서명을 완료합니다.
          </div>
        </div>

        <div class="footer-sign" style="margin-top: 25px;">
          본 매뉴얼을 준수하여 어린이통학버스의 안전운행 및 사고 예방에 만전을 기할 것을 서약합니다.<br>
          <div class="date-line">${autoDateKorean}</div>
          <div class="sign-names">
            운전자(기사): __________________ (인) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 동승보호자: __________________ (인) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 관리자: __________________ (인)
          </div>
        </div>
      </div>
    `;
  } else if (type === 'safety-education') {
    // 안전자료 2: 원아 교통안전 교육자료 및 학부모 가정통신문
    title = `원아교통안전_교육자료_및_가정통신문_${autoDateKorean}`;
    bodyHtml = `
      <div class="doc-container">
        <div class="header-section">
          <div class="title-wrap" style="width: 100%; text-align: center;">
            <h1 style="font-size: 24px;">어린이 통학차량 안전이용 수칙 안내 및 가정통신문</h1>
            <p class="sub-text">우리 아이들의 안전하고 행복한 등·하원을 위한 학부모 협조 안내문 (${academyName})</p>
          </div>
        </div>

        <div style="margin: 15px 0 20px 0; padding: 14px 18px; border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 8px; font-size: 13px; line-height: 1.8; color: #334155;">
          학부모님 안녕하십니까?<br>
          본원에서는 원아들의 통학차량 이용 중 발생할 수 있는 안전사고를 원천 예방하고, 안전한 교통 습관을 기르기 위해 정기 교통안전 교육을 실시하고 있습니다. 가정에서도 자녀들이 차량 이용 안전수칙을 철저히 지킬 수 있도록 많은 관심과 지도를 부탁드립니다.
        </div>

        <!-- 1. 원아 3대 실천 수칙 -->
        <div style="margin-bottom: 16px; border: 2px solid #2563eb; border-radius: 8px; overflow: hidden;">
          <div style="background: #2563eb; color: #ffffff; padding: 8px 14px; font-weight: bold; font-size: 14px;">
            🚦 우리 아이가 꼭 지켜야 할 통학차량 3대 안전 약속
          </div>
          <div style="padding: 12px 16px; font-size: 13px; line-height: 1.9; color: #1e293b; background: #ffffff;">
            1. <b>"자리에 앉으면 찰칵! 안전벨트부터 매요":</b> 차에 타자마자 스스로 안전벨트를 매고, 목적지에 도착해 선생님이 풀어줄 때까지 절대 풀지 않아요.<br>
            2. <b>"차가 완전히 멈춘 뒤 일어서요":</b> 차가 움직이는 동안에는 자리를 이동하거나 장난치지 않고 바르게 앉아서 가요.<br>
            3. <b>"차 바로 앞이나 뒤로 지나가지 않아요":</b> 버스는 몸집이 커서 운전기사 아저씨가 우리를 못 볼 수 있어요. 항상 버스에서 멀리 떨어져서 걸어요.<br>
            ★ <b>비상 행동요령:</b> 만약 차 안에 혼자 남겨졌을 때는 당황하지 말고 운전석으로 가서 <b>핸들 가운데 클랙슨(빵빵 소리)을 엉덩이나 두 손으로 힘껏 눌러요!</b>
          </div>
        </div>

        <!-- 2. 학부모 협조 사항 -->
        <div style="margin-bottom: 16px; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
          <div style="background: #f1f5f9; color: #0f172a; padding: 8px 14px; font-weight: bold; font-size: 14px; border-bottom: 1px solid #cbd5e1;">
            👪 안전한 통학을 위한 학부모님 협조 안내 사항
          </div>
          <div style="padding: 12px 16px; font-size: 13px; line-height: 1.8; color: #334155; background: #ffffff;">
            1. <b>지정 승차 시각 3분 전 도착 대기:</b> 탑승 장소에는 미리 도착하여 도로변이 아닌 안전한 인도 안쪽에서 보호자와 함께 손을 잡고 대기해 주세요.<br>
            2. <b>사전 등록 보호자 대면 인계 원칙:</b> 하원 시 안전을 위해 사전 등록된 성인 보호자에게만 인계합니다. 대리인이 마중 나오실 경우 반드시 출발 전 원으로 연락해 주시기 바랍니다.<br>
            3. <b>탑승 변동(결석/개별하원) 사전 통보:</b> 당일 미탑승 시 차량 출발 전 앱 또는 전화로 즉시 알려주시면 다른 아이들의 불필요한 도로 대기 시간을 줄일 수 있습니다.
          </div>
        </div>

        <div style="margin-top: 30px; text-align: center; font-size: 14px; font-weight: bold; color: #1e293b;">
          아이들의 안전하고 든든한 통학길을 위해 최선을 다하겠습니다.<br><br>
          <div style="font-size: 16px; color: #2563eb;">${academyName} 원장 및 교직원 일동</div>
        </div>
      </div>
    `;
  } else if (type === 'emergency-protocol') {
    // 안전자료 3: 통학차량 사고·응급상황 위기대응 행동지침서
    title = `통학차량_비상사고_및_응급상황_위기대응지침서`;
    bodyHtml = `
      <div class="doc-container">
        <div class="header-section">
          <div class="title-wrap">
            <h1>어린이 통학차량 비상사고 및 응급상황 위기대응 프로토콜</h1>
            <p class="sub-text">어린이안전관리에 관한 법률 제16조 및 재난·위기관리 표준 매뉴얼 준수</p>
          </div>
          <table class="approval-table">
            <tr>
              <th rowspan="2" class="v-header">결<br>재</th>
              <th>안전총괄</th>
              <th>원 장</th>
            </tr>
            <tr>
              <td class="sign-box"></td>
              <td class="sign-box"></td>
            </tr>
          </table>
        </div>

        <!-- 긴급 비상 연락망 요약 -->
        <table class="info-table" style="margin-bottom: 15px;">
          <tr>
            <th style="width: 16%; background: #fee2e2; color: #991b1b;">119 구급·구조</th>
            <td style="width: 34%; font-weight: bold;" class="center">국번없이 119 (환자/화재)</td>
            <th style="width: 16%; background: #dbeafe; color: #1e40af;">112 경찰신고</th>
            <td style="width: 34%; font-weight: bold;" class="center">국번없이 112 (교통사고)</td>
          </tr>
          <tr>
            <th style="width: 16%;">유치원 행정실</th>
            <td style="width: 34%; font-weight: bold;" class="center">${academyName} 비상직통</td>
            <th style="width: 16%;">응급의료상담</th>
            <td style="width: 34%; font-weight: bold;" class="center">국번없이 119 / 1339</td>
          </tr>
        </table>

        <!-- 상황별 4단계 비상 대응 프로세스 -->
        <table class="check-table" style="margin-bottom: 16px;">
          <thead>
            <tr>
              <th style="width: 15%;">구분</th>
              <th style="width: 42%;">운전자(기사) 임무</th>
              <th style="width: 43%;">동승보호자(교사) 임무</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="center bold" style="background: #f8fafc;">1단계: 정차 및 대피</td>
              <td>• 비상점멸등 작동 후 안전지대 즉시 정차<br>• 시동 OFF 및 사이드브레이크 체결<br>• 차량 후방 100m 지점에 안전삼각대 설치</td>
              <td>• 원아 동요 방지 및 "안전벨트 착용 유지" 유도<br>• 화재/위험 시 안전지대(인도 밖)로 신속 탈출 유도<br>• 비상탈출문 및 탈출망치 확보</td>
            </tr>
            <tr>
              <td class="center bold" style="background: #f8fafc;">2단계: 긴급 신고</td>
              <td>• 119 및 112 즉시 신고 (사고 위치·원아 수 전달)<br>• 2차 사고 방지 및 후방 교통 유도</td>
              <td>• 119 구급상황실에 부상 원아 상태 상세 전달<br>• 원아 비상연락망 및 건강명부 지참</td>
            </tr>
            <tr>
              <td class="center bold" style="background: #f8fafc;">3단계: 응급처치</td>
              <td>• 차량 소화기로 초기 진화 시도 (화재 시)<br>• 중상자 구출 보조 및 구급차 유도</td>
              <td>• 차량 구급상자를 활용하여 지혈 및 쇼크 조치<br>• 심정지/기도폐쇄 시 즉시 CPR 및 하임리히법 시행</td>
            </tr>
            <tr>
              <td class="center bold" style="background: #f8fafc;">4단계: 보고 및 인계</td>
              <td>• 경찰관 및 사고 조사요원에게 현장 상황 진술<br>• 견인 및 차량 수습 조치</td>
              <td>• 원장 및 학부모 비상연락망 즉시 상황 통보<br>• 의료진에게 원아 인적사항 및 병력 인계</td>
            </tr>
          </tbody>
        </table>

        <!-- 영유아 응급처치 핵심 수칙 -->
        <div style="padding: 12px 14px; border: 1.5px solid #ef4444; background: #fff5f5; border-radius: 6px; font-size: 12.5px; line-height: 1.7; color: #1e293b;">
          <strong style="color: #dc2626; font-size: 13.5px;">[골든타임 영유아 핵심 응급처치 가이드]</strong><br>
          • <b>기도폐쇄(질식/사탕 등 삼킴):</b> 말을 못 하거나 숨을 헐떡이면 즉시 상체를 숙이게 한 뒤 <b>등 뒤에서 주먹을 쥐고 명치 끝을 안쪽 위로 강하게 당겨 올립니다(영아는 등 두드리기 5회 + 가슴 압박 5회).</b><br>
          • <b>심정지(의식/호흡 없음):</b> 즉시 119 신고 후 양쪽 젖꼭지 사이 가슴 중앙을 <b>분당 100~120회 속도로 4~5cm 깊이로 강하고 빠르게 30회 압박한 뒤 인공호흡 2회</b>를 구급대 도착 시까지 반복합니다.
        </div>

        <div class="footer-sign" style="margin-top: 25px;">
          <div class="date-line">${autoDateKorean}</div>
          <div class="sign-names">
            안전관리책임자: __________________ (인) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 총괄책임자(원장): __________________ (인)
          </div>
        </div>
      </div>
    `;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('팝업 차단이 감지되었습니다. 브라우저 설정에서 팝업을 허용해주세요.');
    return;
  }
  // 부모 창과의 컨텍스트 참조를 완전히 분리하여 부모 창(메인 화면)의 클릭/이벤트 루프가 절대 멈추지 않도록 함
  try {
    printWindow.opener = null;
  } catch (e) {
    console.error(e);
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 10mm 12mm 10mm 12mm;
        }
        * {
          box-sizing: border-box;
          font-family: 'Pretendard', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
        }
        body {
          margin: 0;
          padding: 24px;
          color: #0f172a;
          background: #f1f5f9;
        }
        .doc-container {
          max-width: 210mm;
          margin: 0 auto 30px auto;
          background: #ffffff;
          padding: 28px 32px;
          border-radius: 6px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .page-break {
          page-break-after: always;
          break-after: page;
        }
        .page-break:last-child {
          page-break-after: auto;
          break-after: auto;
        }
        .header-section {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 18px;
          border-bottom: 2.5px solid #0f172a;
          padding-bottom: 12px;
        }
        .title-wrap h1 {
          font-size: 23px;
          margin: 0 0 6px 0;
          font-weight: 900;
          letter-spacing: -0.5px;
          color: #0f172a;
        }
        .sub-text {
          font-size: 13px;
          color: #475569;
          font-weight: 500;
          margin: 0;
        }
        .approval-table {
          border-collapse: collapse;
          font-size: 12.5px;
        }
        .approval-table th, .approval-table td {
          border: 1px solid #334155;
          text-align: center;
          padding: 4px 8px;
        }
        .approval-table th {
          background: #f8fafc;
          font-weight: 700;
        }
        .v-header {
          width: 24px;
          background: #f1f5f9 !important;
        }
        .sign-box {
          height: 48px;
          width: 62px;
        }
        .info-table, .check-table, .notes-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 14px;
          font-size: 13px;
          line-height: 1.5;
        }
        .info-table th, .info-table td,
        .check-table th, .check-table td,
        .notes-table th, .notes-table td {
          border: 1px solid #cbd5e1;
          padding: 8px 10px;
        }
        .info-table th, .check-table th, .notes-table th {
          background: #f8fafc;
          color: #0f172a;
          font-weight: 800;
          text-align: center;
        }
        .center {
          text-align: center;
        }
        .bold {
          font-weight: 700;
        }
        .font-check {
          font-weight: 700;
          color: #1e293b;
          font-size: 13px;
          letter-spacing: 0.5px;
        }
        .check-box {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 1.5px solid #334155;
          border-radius: 2px;
          background-color: #ffffff;
          vertical-align: middle;
        }
        .footer-sign {
          margin-top: 28px;
          text-align: center;
          font-size: 14.5px;
          line-height: 1.85;
          color: #0f172a;
        }
        .date-line {
          font-weight: 800;
          margin: 12px 0;
          font-size: 15.5px;
        }
        .sign-names {
          font-size: 14.5px;
          font-weight: 700;
          margin-top: 14px;
        }
        .print-control-bar {
          position: sticky;
          top: 0;
          z-index: 9999;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 24px;
          background: #ffffff;
          border-bottom: 2px solid #2563eb;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          margin: -24px -24px 24px -24px;
        }
        .print-control-bar .info-area {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13.5px;
          color: #0f172a;
        }
        .print-control-bar .badge {
          background: #eff6ff;
          color: #2563eb;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 6px;
          border: 1px solid #bfdbfe;
        }
        .print-control-bar .sub {
          font-size: 12px;
          color: #64748b;
          font-weight: 500;
        }
        .print-control-bar .btn-area {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .print-control-bar .btn-print {
          background: #2563eb;
          color: #ffffff;
          border: none;
          padding: 8px 18px;
          border-radius: 8px;
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
        }
        .print-control-bar .btn-print:hover {
          background: #1d4ed8;
          box-shadow: 0 4px 8px rgba(37, 99, 235, 0.3);
        }
        .print-control-bar .btn-close {
          background: #f8fafc;
          color: #475569;
          border: 1px solid #cbd5e1;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .print-control-bar .btn-close:hover {
          background: #e2e8f0;
          color: #0f172a;
        }
        @media print {
          body {
            background: #ffffff;
            padding: 0;
          }
          .doc-container {
            box-shadow: none;
            padding: 0;
            width: 100%;
            margin: 0;
          }
          .page-break {
            page-break-after: always;
            break-after: page;
          }
          .page-break:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          .print-control-bar, .print-btn-bar {
            display: none !important;
          }
          thead {
            display: table-header-group;
          }
          tr {
            page-break-inside: avoid;
          }
        }
      </style>
    </head>
    <body>
      <div class="print-control-bar">
        <div class="info-area">
          <span class="badge">A4 법정 표준 서식</span>
          <strong>${title.replace(/_/g, ' ')}</strong>
          <span class="sub">| &nbsp; 서식 내용을 확인하신 후 우측 [인쇄 / PDF로 저장]을 클릭하세요.</span>
        </div>
        <div class="btn-area">
          <button class="btn-print" onclick="window.print()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
            인쇄 / PDF로 저장
          </button>
          <button class="btn-close" onclick="window.close()">
            창 닫기
          </button>
        </div>
      </div>
      ${bodyHtml}
      <script>
        // 페이지 로드 완료 시 인쇄 대화상자 자동 호출 (취소 시 서류 미리보기 유지)
        window.onload = function() {
          setTimeout(function() {
            try {
              window.print();
            } catch(e) {
              console.log(e);
            }
          }, 350);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}
