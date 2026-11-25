import React, { useState, useEffect, useMemo, useRef } from 'react';
import { API_BASE_URL } from '../config';
import { compressImage } from '../utils/imageCompressor';

const PRESET_PHOTOS = [
  {
    name: '야외 모래놀이 & 놀이터',
    url: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: '창의 미술 & 그리기 시간',
    url: 'https://images.unsplash.com/photo-1596464716127-f2a82984de30?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: '신나는 음악 율동 & 악기 놀이',
    url: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: '오감 발달 블록 쌓기 놀이',
    url: 'https://images.unsplash.com/photo-1566140967404-b8b3932483f5?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: '즐거운 숲 체험 & 자연 관찰',
    url: 'https://images.unsplash.com/photo-1472162072942-cd5147eb3902?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: '달콤한 생일 축하 파티',
    url: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&auto=format&fit=crop&q=80'
  }
];

const DEFAULT_POSTS_BY_LEVEL = {
  '유치원': [
    {
      id: 101,
      educationLevel: '유치원',
      postType: 'NOTICE',
      title: '[햇살반 알림장] 🍁 가을 숲 체험 및 알록달록 낙엽 왕관 만들기',
      content: `안녕하세요, 햇살반 학부모님!
오늘 우리 햇살반 친구들과 함께 따뜻한 가을 햇살을 맞으며 유치원 뒤뜰 생태 숲으로 나들이를 다녀왔습니다.

바스락거리는 단풍잎과 동글동글한 솔방울, 도토리를 주워 모아 멋진 '가을 숲 요정 왕관'을 직접 꾸며보았습니다. 자연 속에서 자연물을 만지고 냄새 맡으며 오감으로 가을을 듬뿍 느낀 행복한 시간이었습니다.

📌 알림 사항
- 오늘 만든 낙엽 왕관은 가방에 넣어 보냈으니 가정에서도 칭찬 많이 해주세요.
- 내일은 체육 활동이 예정되어 있으니 원복 대신 편안한 활동복과 운동화 착용을 부탁드립니다.`,
      imageUrl: 'https://images.unsplash.com/photo-1596464716127-f2a82984de30?w=800&auto=format&fit=crop&q=80',
      images: [
        'https://images.unsplash.com/photo-1596464716127-f2a82984de30?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1472162072942-cd5147eb3902?w=800&auto=format&fit=crop&q=80'
      ],
      authorName: '이유진 담임교사 (햇살반)',
      authorRole: 'TEACHER',
      visibility: 'CLASS',
      targetClass: '햇살반',
      likeCount: 9,
      likedUserIds: ['admin'],
      comments: [
        { id: 1, authorName: '하늘이 어머님', authorRole: 'PARENT', content: '하늘이가 집에 오자마자 낙엽 왕관 자랑하네요! 자연에서 뛰노는 모습이 너무 예쁩니다. 선생님 늘 감사드려요~', createdAt: new Date(Date.now() - 7200000).toISOString() },
        { id: 2, authorName: '원장선생님', authorRole: 'ADMIN', content: '햇살반 친구들 작품 솜씨가 대단하네요. 밝은 웃음이 사진 너머로 전해집니다 ^^', createdAt: new Date(Date.now() - 3600000).toISOString() }
      ],
      createdAt: new Date(Date.now() - 10800000).toISOString()
    },
    {
      id: 102,
      educationLevel: '유치원',
      postType: 'NOTICE',
      title: '[새싹반 알림장] 🎨 조물조물 친환경 찰흙 & 감각 도예 놀이',
      content: `새싹반 학부모님 안녕하십니까.
소근육 발달과 창의력 증진을 위한 '친환경 찰흙 조형 활동'을 진행했습니다.

찰흙의 부드러운 질감을 손끝으로 느끼며 동글동글 빚고 길쭉하게 늘려 나만의 동물 친구들과 컵을 완성했습니다. 찰흙이 옷에 조금 묻을 수 있으니 세탁 시 미온수에 가볍게 불려 세탁해 주시면 말끔히 지워집니다.

📌 준비물 안내:
- 다음 주 월요일 양치컵과 칫솔 교체 주간이오니 새 칫솔을 지퍼백에 넣어 이름표 부착 후 보내주시기 바랍니다.`,
      imageUrl: 'https://images.unsplash.com/photo-1566140967404-b8b3932483f5?w=800&auto=format&fit=crop&q=80',
      images: [
        'https://images.unsplash.com/photo-1566140967404-b8b3932483f5?w=800&auto=format&fit=crop&q=80'
      ],
      authorName: '박민지 담임교사 (새싹반)',
      authorRole: 'TEACHER',
      visibility: 'CLASS',
      targetClass: '새싹반',
      likeCount: 7,
      likedUserIds: [],
      comments: [
        { id: 1, authorName: '도윤이 아버님', authorRole: 'PARENT', content: '도윤이가 집중해서 빚는 모습이 기특하네요. 알림 확인했습니다!', createdAt: new Date(Date.now() - 14400000).toISOString() }
      ],
      createdAt: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: 103,
      educationLevel: '유치원',
      postType: 'NOTICE',
      title: '[풀잎반 알림장] 🎵 쿵작쿵작 오감 리듬 악기 합주 및 율동 시간',
      content: `풀잎반 학부모님 안녕하세요!
신나는 템버린, 에그 셰이커, 실로폰을 활용하여 가을 동요 '도토리' 음악에 맞추어 악기 합주를 해보았습니다.

친구들과 박자를 맞추며 귀 기울이고, 신나게 흔들며 리듬감을 키웠답니다. 
환절기 기온 변화가 심하니 얇은 겉옷을 챙겨 입혀 보내주세요.`,
      imageUrl: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800&auto=format&fit=crop&q=80',
      images: [
        'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800&auto=format&fit=crop&q=80'
      ],
      authorName: '정수연 담임교사 (풀잎반)',
      authorRole: 'TEACHER',
      visibility: 'CLASS',
      targetClass: '풀잎반',
      likeCount: 6,
      likedUserIds: [],
      comments: [],
      createdAt: new Date(Date.now() - 93600000).toISOString()
    },
    {
      id: 104,
      educationLevel: '유치원',
      postType: 'NOTICE',
      title: '[열매반 알림장] 🌱 유치원 텃밭 가꾸기: 무와 배추 관찰 일지 작성',
      content: `열매반 학부모님 안녕하십니까.
지난 초가을에 직접 심었던 김장용 배추와 가을 무가 어느덧 튼실하게 자라났습니다!
아이들과 함께 돋보기로 배춧잎을 갉아먹는 애벌레도 관찰하고 물주기 활동을 하였습니다. 다음 주 수확 활동도 많은 기대 바랍니다.`,
      imageUrl: 'https://images.unsplash.com/photo-1472162072942-cd5147eb3902?w=800&auto=format&fit=crop&q=80',
      images: [
        'https://images.unsplash.com/photo-1472162072942-cd5147eb3902?w=800&auto=format&fit=crop&q=80'
      ],
      authorName: '김태희 담임교사 (열매반)',
      authorRole: 'TEACHER',
      visibility: 'CLASS',
      targetClass: '열매반',
      likeCount: 8,
      likedUserIds: [],
      comments: [
        { id: 1, authorName: '시우 어머님', authorRole: 'PARENT', content: '직접 가꾼 채소 수확하면 편식도 줄어들 것 같네요. 기대됩니다!', createdAt: new Date(Date.now() - 50000000).toISOString() }
      ],
      createdAt: new Date(Date.now() - 100000000).toISOString()
    },
    {
      id: 105,
      educationLevel: '유치원',
      postType: 'NOTICE',
      title: '[전체 공지] 🍱 11월 4주차 친환경 식단표 및 영양 관리 안내',
      content: `유치원 학부모님 안녕하십니까.
아이들의 건강하고 균형 잡힌 성장을 위한 11월 4주차 주간 식단표를 공지합니다.

- 월: 기장밥, 소고기미역국, 수제 떡갈비구이, 시금치나물, 깍두기, 배
- 화: 흑미밥, 들깨무채국, 닭안심 카레볶음, 콩나물무침, 백김치, 귤
- 수: 오색비빔밥(친환경 유기농 채소), 유부장국, 계란후라이, 단호박죽, 사과
- 목: 찰보리밥, 감자애호박된장국, 삼치데리야끼구이, 메추리알장조림, 배추김치, 바나나
- 금: 클로렐라밥, 맑은 순두부탕, 치즈 불고기, 파프리카 잡채, 깍두기, 요구르트

* 모든 식자재는 HACCP 인증 국내산 무농약/친환경 식자재를 사용하고 있습니다.
* 식품 알레르기(달걀, 우유, 견과류 등)가 있는 어린이는 대체 급식이 제공됩니다.`,
      imageUrl: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=800&auto=format&fit=crop&q=80',
      images: [
        'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=800&auto=format&fit=crop&q=80'
      ],
      authorName: '영양사 & 행정실',
      authorRole: 'ADMIN',
      visibility: 'ALL',
      targetClass: null,
      likeCount: 15,
      likedUserIds: ['admin'],
      comments: [
        { id: 1, authorName: '지우 어머님', authorRole: 'PARENT', content: '매번 균형 잡힌 맛있는 식단 준비해 주셔서 안심이 됩니다. 감사합니다!', createdAt: new Date(Date.now() - 120000000).toISOString() }
      ],
      createdAt: new Date(Date.now() - 172800000).toISOString()
    },
    {
      id: 106,
      educationLevel: '유치원',
      postType: 'NOTICE',
      title: '[전체 공지] 🚌 동절기 통학버스 안전 운행 및 정류장 5분 전 대기 협조 요청',
      content: `학부모님 안녕하십니까.
기온이 내려가고 도로 결빙 위험이 발생하는 동절기를 맞이하여, 안전한 원아 통학을 위해 안내 말씀 드립니다.

1. 정류장 도착 5분 전 대기
   - 추운 날씨로 인해 도로 흐름이 지연될 수 있습니다. 대기 시간 단축 및 정시 운행을 위해 지정 탑승 장소에 5분 전 미리 대기해 주시기 바랍니다.
2. 차량 안전벨트 착용 지도
   - 차량에 탑승하는 모든 어린이는 안전지도교사의 인솔 하에 100% 안전벨트를 체결하고 출발합니다.
3. 승·하차지 변경 및 일일 불참 안내
   - 학부모 앱의 [탑승 변경 신청] 메뉴를 통해 당일 탑승 1시간 전까지 접수해 주시면 기사님 및 동승 교사에게 실시간 반영됩니다.

아이들의 안전하고 따뜻한 등하원을 위해 최선을 다하겠습니다.`,
      imageUrl: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&auto=format&fit=crop&q=80',
      images: [
        'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&auto=format&fit=crop&q=80'
      ],
      authorName: '안전관리 책임자 (원장)',
      authorRole: 'ADMIN',
      visibility: 'ALL',
      targetClass: null,
      likeCount: 22,
      likedUserIds: ['admin'],
      comments: [
        { id: 1, authorName: '서준이 어머님', authorRole: 'PARENT', content: '항상 원아 안전에 각별히 신경 써주셔서 든든합니다. 5분 전 대기 잘 지키겠습니다!', createdAt: new Date(Date.now() - 150000000).toISOString() }
      ],
      createdAt: new Date(Date.now() - 259200000).toISOString()
    },
    {
      id: 107,
      educationLevel: '유치원',
      postType: 'POST',
      title: '❤️ [칭찬합니다] 2호차 기사님과 지도교사 선생님 늘 감사드려요',
      content: `매일 아침 2호차에서 밝은 미소로 아이 이름 하나하나 다정하게 불러주시는 기사님과, 아이 신발 끈 풀린 것까지 세심하게 챙겨주시는 지도교사 선생님께 감사 인사 남깁니다.
처음 유치원 버스를 탈 때 울먹이던 아이가 이제는 버스 오는 시간만 기다릴 정도로 편안해졌어요.
항상 안전 운전해 주셔서 마음 놓고 보냅니다. 선생님, 기사님 모두 건강 조심하세요!`,
      imageUrl: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=800&auto=format&fit=crop&q=80',
      images: [],
      authorName: '햇살반 예은맘',
      authorRole: 'PARENT',
      visibility: 'ALL',
      targetClass: null,
      likeCount: 18,
      likedUserIds: ['admin'],
      comments: [
        { id: 1, authorName: '2호차 운전기사님', authorRole: 'ADMIN', content: '따뜻한 말씀 감사합니다 예은 어머님! 예은이가 인사도 잘해서 제가 매일 아침 큰 힘을 얻습니다. 늘 안전하게 모시겠습니다 ^^', createdAt: new Date(Date.now() - 14400000).toISOString() },
        { id: 2, authorName: '2호차 동승 지도교사', authorRole: 'TEACHER', content: '어머님 따뜻한 후기글에 오늘 피로가 싹 가시네요! 예은이랑 내일도 활기차게 인사 나누겠습니다 ㅎㅎ', createdAt: new Date(Date.now() - 10800000).toISOString() }
      ],
      createdAt: new Date(Date.now() - 18000000).toISOString()
    },
    {
      id: 108,
      educationLevel: '유치원',
      postType: 'POST',
      title: '📢 [나눔] 원복 7호 동복 자켓 & 활동복 바지 나눔합니다',
      content: `안녕하세요 학부모님들!
아이가 쑥쑥 자라서 작년에 깨끗하게 입었던 원복 7호(동복 자켓 1벌, 활동복 상하의 1벌)를 나눔하고자 합니다.
헤진 곳 없이 상태 매우 깨끗하고 드라이클리닝 완료했습니다.
필요하신 학부모님께서는 댓글 남겨주시면 가방에 담아 원무실에 맡겨두겠습니다.`,
      imageUrl: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&auto=format&fit=crop&q=80',
      images: [],
      authorName: '새싹반 준우맘',
      authorRole: 'PARENT',
      visibility: 'ALL',
      targetClass: null,
      likeCount: 5,
      likedUserIds: [],
      comments: [
        { id: 1, authorName: '풀잎반 지호맘', authorRole: 'PARENT', content: '어머님 안녕하세요! 저희 지호가 체구가 작아서 7호가 딱 맞을 것 같아요. 나눔 가능할까요?', createdAt: new Date(Date.now() - 5400000).toISOString() },
        { id: 2, authorName: '새싹반 준우맘', authorRole: 'PARENT', content: '네 지호맘님! 내일 등원길에 원무실 앞 바구니에 지호 이름 적어서 전달해 놓겠습니다 ^^', createdAt: new Date(Date.now() - 2700000).toISOString() }
      ],
      createdAt: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: 109,
      educationLevel: '유치원',
      postType: 'POST',
      title: '☀️ 햇살반 사랑 나눔 바자회 부스 운영 아이디어 모음 & 학부모 소통',
      content: `햇살반 부모님들 안녕하세요!
다음 달 예정된 사랑 나눔 가을 바자회 부스 운영과 관련하여 학부모님들의 다양한 아이디어나 재능 기부 의견을 자유롭게 나눠주시면 좋겠습니다.

현재 제안된 코너:
1. 핸드메이드 어린이 머리핀 & 키링 만들기
2. 안 쓰는 동화책 및 보드게임 나눔 부스
3. 팝콘 & 오미자차 쉼터

좋은 의견 있으시면 댓글로 편하게 말씀해 주세요!`,
      imageUrl: 'https://images.unsplash.com/photo-1472162072942-cd5147eb3902?w=800&auto=format&fit=crop&q=80',
      images: [],
      authorName: '햇살반 학부모대표',
      authorRole: 'PARENT',
      visibility: 'CLASS',
      targetClass: '햇살반',
      likeCount: 8,
      likedUserIds: [],
      comments: [
        { id: 1, authorName: '햇살반 담임선생님', authorRole: 'TEACHER', content: '학부모님들의 자발적인 관심과 참여에 깊이 감사드립니다! 교실에서도 아이들과 기부 물품 분류 활동을 연계해 보겠습니다 ^^', createdAt: new Date(Date.now() - 18000000).toISOString() }
      ],
      createdAt: new Date(Date.now() - 172800000).toISOString()
    }
  ],
  '초등부': [
    {
      id: 201,
      educationLevel: '초등부',
      postType: 'NOTICE',
      title: '[초등 1·2호차] 방과 후 맞춤형 하교 셔틀 안전 수칙 및 시간표 안내',
      content: `초등부 학부모님 및 학생 여러분 안녕하십니까.
초등학교 정규 수업 및 방과 후 교실 개편에 따라, 셔틀버스 운행 시간 및 학교 정문 앞 혼잡 방지를 위한 승하차 지점이 일부 조정되었습니다.

- 시행 일자: 이번 주 월요일부터 즉시 적용
- 초등 1호차: 본원 출발 14:10 -> 초등학교 동문 후문 경유 (14:25) -> 아파트 단지 순환
- 초등 2호차: 본원 출발 15:30 -> 방과후 2차 하교 연계 운행 (15:50)

학부모님께서는 학생이 정류장에 5분 전 미리 도착하여 안전 지도교사의 신호에 따라 승차할 수 있도록 지도 바랍니다.`,
      imageUrl: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&auto=format&fit=crop&q=80',
      images: [
        'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&auto=format&fit=crop&q=80'
      ],
      authorName: '초등부 행정실',
      authorRole: 'ADMIN',
      visibility: 'ALL',
      targetClass: null,
      likeCount: 14,
      likedUserIds: ['admin'],
      comments: [
        { id: 1, authorName: '민재 학부모님', authorRole: 'PARENT', content: '동문 후문 정류장 위치 확인했습니다. 기사님 수고 많으십니다!', createdAt: new Date(Date.now() - 3600000).toISOString() }
      ],
      createdAt: new Date(Date.now() - 5400000).toISOString()
    },
    {
      id: 202,
      educationLevel: '초등부',
      postType: 'NOTICE',
      title: '초등 4학년 햇살반 창의 과학 탐구 및 로봇 코딩 프로젝트 발표회',
      content: `오늘 햇살반 친구들이 팀별로 4주간 준비한 친환경 스마트 시티 로봇 프로젝트를 멋지게 발표했습니다!
스크래치 블록 코딩과 모터 센서를 결합해 스스로 장애물을 피하는 스마트 청소 로봇을 완성했어요.
창의력 넘치는 작품들을 감상해보세요!`,
      imageUrl: 'https://images.unsplash.com/photo-1588072432836-e10032774350?w=800&auto=format&fit=crop&q=80',
      images: [
        'https://images.unsplash.com/photo-1588072432836-e10032774350?w=800&auto=format&fit=crop&q=80'
      ],
      authorName: '박준호 선생님 (햇살반)',
      authorRole: 'TEACHER',
      visibility: 'CLASS',
      targetClass: '햇살반',
      likeCount: 11,
      likedUserIds: [],
      comments: [],
      createdAt: new Date(Date.now() - 10800000).toISOString()
    },
    {
      id: 203,
      educationLevel: '초등부',
      postType: 'NOTICE',
      title: '[초등부 전체] 12월 창의 융합 독서 골든벨 대회 개최 안내',
      content: `초등부 전 학년을 대상으로 생각의 깊이를 더하는 제3회 창의 융합 독서 골든벨 대회를 개최합니다.
지정 도서 3권을 읽고 흥미진진한 퀴즈를 맞히며 독서의 즐거움을 함께 나눕니다. 많은 참여와 격려 부탁드립니다.`,
      imageUrl: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&auto=format&fit=crop&q=80',
      images: [],
      authorName: '초등부 교무실',
      authorRole: 'ADMIN',
      visibility: 'ALL',
      targetClass: null,
      likeCount: 9,
      likedUserIds: [],
      comments: [],
      createdAt: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: 204,
      educationLevel: '초등부',
      postType: 'POST',
      title: '☂️ [분실물] 초등 1호차 뒷좌석 노란색 캐릭터 장우산 보관 중입니다',
      content: `오늘 1호차 15:30 운행 종료 후 차량 내부 정리 중 4번째 좌석에서 노란색 손잡이 캐릭터 장우산이 발견되었습니다.
손잡이에 이름이 적혀있지 않아 행정실 분실물 보관함에 보관하고 있으니, 해당 학생 또는 학부모님께서는 문의 바랍니다.`,
      imageUrl: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&auto=format&fit=crop&q=80',
      images: [],
      authorName: '1호차 담당 안전기사',
      authorRole: 'ADMIN',
      visibility: 'ALL',
      targetClass: null,
      likeCount: 6,
      likedUserIds: [],
      comments: [
        { id: 1, authorName: '태현이 학부모님', authorRole: 'PARENT', content: '태현이가 오늘 우산 잃어버렸다고 했는데 맞네요! 보관해 주셔서 정말 감사합니다.', createdAt: new Date(Date.now() - 3600000).toISOString() }
      ],
      createdAt: new Date(Date.now() - 14400000).toISOString()
    },
    {
      id: 205,
      educationLevel: '초등부',
      postType: 'POST',
      title: '👏 비 오는 날 우산 씌워주신 기사님 정말 감사합니다',
      content: `갑작스럽게 소나기가 쏟아졌는데 정류장에서 아이가 비 맞지 않게 직접 우산 들고 마중 나와주신 2호차 기사님께 감사의 마음을 전합니다.
늘 아이들을 내 가족처럼 아껴주셔서 마음 놓고 보냅니다.`,
      imageUrl: 'https://images.unsplash.com/photo-1588072432836-e10032774350?w=800&auto=format&fit=crop&q=80',
      images: [],
      authorName: '서우 학부모님',
      authorRole: 'PARENT',
      visibility: 'ALL',
      targetClass: null,
      likeCount: 15,
      likedUserIds: ['admin'],
      comments: [
        { id: 1, authorName: '2호차 기사님', authorRole: 'ADMIN', content: '당연히 해야 할 일인 걸요! 아이들이 감기 걸리지 않는 게 가장 중요합니다. 감사합니다 ^^', createdAt: new Date(Date.now() - 7200000).toISOString() }
      ],
      createdAt: new Date(Date.now() - 28800000).toISOString()
    }
  ],
  '중,고등부': [
    {
      id: 301,
      educationLevel: '중,고등부',
      postType: 'NOTICE',
      title: '[중·고등부] 2학기 기말고사 대비 심야 안심 귀가 셔틀 특별 편성',
      content: `중·고등부 원생 여러분 안녕하십니까.
내신 고득점을 위한 2학기 기말고사 대비 자율학습 집중 기간을 맞이하여, 밤늦게까지 학업에 매진하는 학생들의 귀가 안전을 지원합니다.

- 운행 기간: 11월 25일(월) ~ 12월 13일(금) [3주간 평일 및 토요일 운영]
- 심야 특별 셔틀 출발 시각:
  1차 귀가: 22:15 정각 출발 (주요 거점 대단지 아파트 순환)
  2차 귀가: 23:15 정각 출발 (역세권 및 학생 자택 인근 직결 노선)

* 심야 노선 탑승을 희망하는 학생은 당일 18:00까지 데스크 또는 앱에서 좌석 예약을 완료해 주시기 바랍니다.`,
      imageUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&auto=format&fit=crop&q=80',
      images: [
        'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&auto=format&fit=crop&q=80'
      ],
      authorName: '학원 총괄원장',
      authorRole: 'ADMIN',
      visibility: 'ALL',
      targetClass: null,
      likeCount: 25,
      likedUserIds: ['admin'],
      comments: [
        { id: 1, authorName: '김민성 학생', authorRole: 'STUDENT', content: '늦게까지 자습하고 안전하게 집에 갈 수 있어 너무 좋아요!', createdAt: new Date(Date.now() - 7200000).toISOString() },
        { id: 2, authorName: '고2 학부모님', authorRole: 'PARENT', content: '시험 기간마다 픽업 가느라 부담이었는데 학원에서 안심 셔틀 운영해 주시니 든든합니다.', createdAt: new Date(Date.now() - 3600000).toISOString() }
      ],
      createdAt: new Date(Date.now() - 14400000).toISOString()
    },
    {
      id: 302,
      educationLevel: '중,고등부',
      postType: 'NOTICE',
      title: '[중등 심화 열매반] 📝 전국 연합 모의평가 분석 및 1:1 오답 클리닉 안내',
      content: `열매반 학생 여러분 및 학부모님.
지난주 시행된 전국 연합 모의평가 과목별 가채점 결과 분석표가 발송되었습니다.
이번 주 수요일부터 금요일까지 수업 전후 30분씩 1:1 심층 취약 유형 분석 클리닉이 진행되오니 오답 노트를 반드시 지참해 오시기 바랍니다.`,
      imageUrl: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&auto=format&fit=crop&q=80',
      images: [
        'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&auto=format&fit=crop&q=80'
      ],
      authorName: '김도현 책임강사 (열매반)',
      authorRole: 'TEACHER',
      visibility: 'CLASS',
      targetClass: '열매반',
      likeCount: 12,
      likedUserIds: [],
      comments: [],
      createdAt: new Date(Date.now() - 28800000).toISOString()
    },
    {
      id: 303,
      educationLevel: '중,고등부',
      postType: 'NOTICE',
      title: '[전체 공지] 기말고사 대비 자율학습 스터디룸 주말 상시 개방 안내',
      content: `학생 여러분의 집중력 있는 시험 대비를 돕기 위해 본관 3층 프리미엄 스터디룸을 주말(토/일) 아침 08:30부터 밤 23:00까지 전면 개방합니다.
좌석은 1인 지정석으로 운영되며, 인강 청취용 고속 Wi-Fi 및 공기청정기가 상시 가동됩니다.`,
      imageUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&auto=format&fit=crop&q=80',
      images: [],
      authorName: '학습관리팀',
      authorRole: 'ADMIN',
      visibility: 'ALL',
      targetClass: null,
      likeCount: 18,
      likedUserIds: [],
      comments: [],
      createdAt: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: 304,
      educationLevel: '중,고등부',
      postType: 'POST',
      title: '💡 기말고사 스터디룸 주말 오전 개방 건의 및 영어 기출 스터디원 모집',
      content: `원장선생님 안녕하세요! 고등부 자습실 A룸 시험 기간 주말 개방 시간을 오전 8시부터 오픈해 주실 수 있는지 문의드립니다.
그리고 주말 오전에 영어 빈칸추론 기출 10회독 스터디 같이할 고2 친구들 있으면 댓글 남겨주세요! 같이 열공합시다.`,
      imageUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&auto=format&fit=crop&q=80',
      images: [],
      authorName: '이준호 (고2)',
      authorRole: 'STUDENT',
      visibility: 'ALL',
      targetClass: null,
      likeCount: 16,
      likedUserIds: ['admin'],
      comments: [
        { id: 1, authorName: '학원 총괄원장', authorRole: 'ADMIN', content: '학생들의 학구열을 응원합니다! 이번 주말부터 자습실을 주말 아침 8시부터 상시 개방하도록 조치하겠습니다 ^^', createdAt: new Date(Date.now() - 14400000).toISOString() },
        { id: 2, authorName: '박서연 (고2)', authorRole: 'STUDENT', content: '준호야 나 영어 스터디 참여할래! 내일 자습실에서 보자.', createdAt: new Date(Date.now() - 7200000).toISOString() }
      ],
      createdAt: new Date(Date.now() - 43200000).toISOString()
    },
    {
      id: 305,
      educationLevel: '중,고등부',
      postType: 'POST',
      title: '🚌 심야 셔틀 덕분에 늦게까지 자습하고 안전하게 집 갑니다!',
      content: `매번 시험 기간마다 버스 끊길까 봐 조마조마하며 일찍 일어났는데, 심야 안심 셔틀 덕분에 23시까지 꽉 채워 공부할 수 있어서 너무 좋습니다.
밤길에도 안전하게 집 앞까지 데려다주시는 3호차 기사님 감사합니다!`,
      imageUrl: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&auto=format&fit=crop&q=80',
      images: [],
      authorName: '정다은 (고1)',
      authorRole: 'STUDENT',
      visibility: 'ALL',
      targetClass: null,
      likeCount: 20,
      likedUserIds: ['admin'],
      comments: [
        { id: 1, authorName: '3호차 기사님', authorRole: 'ADMIN', content: '다은 학생 열공하는 모습이 대견합니다! 항상 조심히 집까지 바래다줄 테니 시험 준비 화이팅하세요 ^^', createdAt: new Date(Date.now() - 10800000).toISOString() }
      ],
      createdAt: new Date(Date.now() - 72000000).toISOString()
    }
  ]
};

const DEFAULT_POSTS = DEFAULT_POSTS_BY_LEVEL['유치원'];

export default function BoardViewer({
  isClosing = false,
  currentUser = {},
  selectedAcademyId,
  availableClasses = ['햇살반', '열매반', '풀잎반', '새싹반'],
  selectedClass = 'ALL',
  setSelectedClass,
  searchKeyword = '',
  setSearchKeyword,
  isCreatingPost = false,
  setIsCreatingPost,
  posts = [],
  setPosts,
  initialPostType,
  activeEducationLevel,
}) {
  const currentEducationLevel = activeEducationLevel || currentUser?.educationLevel || localStorage.getItem('takeme_selected_education_level') || '유치원';
  const boardStorageKey = `takeme_board_posts_${currentEducationLevel}`;
  const defaultPosts = DEFAULT_POSTS_BY_LEVEL[currentEducationLevel] || DEFAULT_POSTS_BY_LEVEL['유치원'];

  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingToCloud, setIsUploadingToCloud] = useState(false);
  const [selectedPostType, setSelectedPostType] = useState('ALL'); // 'ALL' | 'NOTICE' | 'POST'

  const isAdmin = currentUser.role === 'ACADEMY_ADMIN' || currentUser.role === 'SUPER_ADMIN';
  const isTeacher = currentUser.role === 'TEACHER';
  const teacherClass = currentUser.assignedClass || '';
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [commentInputs, setCommentInputs] = useState({});
  const [sortBy, setSortBy] = useState('LATEST'); // 'LATEST' | 'POPULAR'
  const [previewGallery, setPreviewGallery] = useState(null); // { images: string[], index: number }
  const setPreviewImageUrl = (url) => {
    if (!url) setPreviewGallery(null);
    else setPreviewGallery({ images: [url], index: 0 });
  };
  const [postToDelete, setPostToDelete] = useState(null);
  const [editingPost, setEditingPost] = useState(null);

  // Form state for new / edit post
  const defaultAuthorName = isTeacher 
    ? `${currentUser.name || '선생님'} (${teacherClass})`
    : (currentUser?.name ? `${currentUser.name} 관리자` : '관리자');

  const [postForm, setPostForm] = useState({
    title: '',
    content: '',
    postType: initialPostType || '',
    visibility: isTeacher ? 'CLASS' : 'ALL',
    targetClass: (isTeacher && teacherClass) ? teacherClass : (availableClasses[0] || '햇살반'),
    imageUrl: PRESET_PHOTOS[0].url,
    images: [PRESET_PHOTOS[0].url],
    authorName: defaultAuthorName,
    authorRole: isTeacher ? 'TEACHER' : 'ADMIN',
  });
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (initialPostType) {
      setPostForm(prev => ({ ...prev, postType: initialPostType }));
      if (initialPostType !== 'ALL') {
        setSelectedPostType(initialPostType);
      }
    }
  }, [initialPostType]);

  const [cloudStoredPhotos, setCloudStoredPhotos] = useState(() => {
    try {
      const saved = localStorage.getItem('takeme_teacher_cloud_photos') || localStorage.getItem(`takeme_teacher_cloud_${currentUser?.id || 'default'}`);
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return [];
  });

  const loadCloudStoredPhotos = async () => {
    try {
      let photos = [];
      const saved = localStorage.getItem('takeme_teacher_cloud_photos') || localStorage.getItem(`takeme_teacher_cloud_${currentUser?.id || 'default'}`);
      if (saved) photos = JSON.parse(saved);

      const token = localStorage.getItem('takeme_token');
      if (token) {
        const res = await fetch(`${API_BASE_URL}/routing/media`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const serverPhotos = data.map(item => ({
              id: item.id,
              name: item.filename || '활동_사진.jpg',
              url: item.url,
              size: item.size ? `${(item.size / (1024 * 1024)).toFixed(2)} MB` : '-',
              uploadedAt: new Date(item.createdAt).toLocaleString('ko-KR')
            }));
            photos = serverPhotos;
            localStorage.setItem('takeme_teacher_cloud_photos', JSON.stringify(photos));
          }
        }
      }
      setCloudStoredPhotos(photos);
    } catch (_) {}
  };

  useEffect(() => {
    if (isCreatingPost || editingPost) {
      loadCloudStoredPhotos();
    }
  }, [isCreatingPost, editingPost]);

  // Keyboard navigation for multi-photo Lightbox
  useEffect(() => {
    if (!previewGallery) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setPreviewGallery(null);
      if (e.key === 'ArrowLeft') {
        setPreviewGallery(prev => (prev && prev.images.length > 1 ? {
          ...prev,
          index: (prev.index - 1 + prev.images.length) % prev.images.length
        } : prev));
      }
      if (e.key === 'ArrowRight') {
        setPreviewGallery(prev => (prev && prev.images.length > 1 ? {
          ...prev,
          index: (prev.index + 1) % prev.images.length
        } : prev));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewGallery]);

  // Load posts from backend or fallback to localStorage
  const fetchPosts = async () => {
    // 화면에 이미 게시글이 있다면 스피너로 화면을 가리지 않고 백그라운드 갱신(SWR)
    if (!posts || posts.length === 0) {
      setIsLoading(true);
    }
    try {
      const activeAcademyId = selectedAcademyId || localStorage.getItem('takeme_selected_academy_id') || (() => {
        try { return JSON.parse(localStorage.getItem('takeme_user') || '{}').academyId; } catch(e){ return ''; }
      })();

      const queryParams = new URLSearchParams();
      if (activeAcademyId) queryParams.set('academyId', activeAcademyId);
      queryParams.set('educationLevel', currentEducationLevel);

      const token = localStorage.getItem('takeme_token');
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/routing/board/posts?${queryParams.toString()}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const levelFiltered = data.filter(p => !p.educationLevel || p.educationLevel === currentEducationLevel);
          const finalPosts = levelFiltered.length > 0 ? levelFiltered : defaultPosts;
          setPosts(finalPosts);
          localStorage.setItem(boardStorageKey, JSON.stringify(finalPosts));
          return;
        }
      }
      // Fallback to local storage or defaults
      const saved = localStorage.getItem(boardStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // 이전 구버전 데이터(게시물이 적거나 postType이 누락된 경우)는 최신 defaultPosts로 업그레이드
        if (Array.isArray(parsed) && parsed.length >= defaultPosts.length && parsed.some(p => p.postType)) {
          setPosts(parsed);
          return;
        }
      }
      setPosts(defaultPosts);
      localStorage.setItem(boardStorageKey, JSON.stringify(defaultPosts));
    } catch (e) {
      console.warn('Backend fetch failed, falling back to local data', e);
      const saved = localStorage.getItem(boardStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= defaultPosts.length && parsed.some(p => p.postType)) {
          setPosts(parsed);
          return;
        }
      }
      setPosts(defaultPosts);
      localStorage.setItem(boardStorageKey, JSON.stringify(defaultPosts));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // 즉각 렌더링 (0초 반응): 로컬 캐시가 있으면 네트워크 응답 전에 즉시 화면에 노출
    try {
      const saved = localStorage.getItem(boardStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= defaultPosts.length && parsed.some(p => p.postType)) {
          setPosts(parsed);
        } else {
          setPosts(defaultPosts);
          localStorage.setItem(boardStorageKey, JSON.stringify(defaultPosts));
        }
      } else {
        setPosts(defaultPosts);
        localStorage.setItem(boardStorageKey, JSON.stringify(defaultPosts));
      }
    } catch (_) {}

    fetchPosts();
  }, [selectedAcademyId, currentEducationLevel]);

  // Sync to local storage on change
  const savePostsLocal = (newPosts) => {
    setPosts(newPosts);
    localStorage.setItem(boardStorageKey, JSON.stringify(newPosts));
  };

  // Filter & Sort
  const filteredPosts = useMemo(() => {
    let result = [...posts];

    if (isTeacher && teacherClass) {
      // 심화 B반 교사는 오직 B반 게시글만 조회 (타 반 글 및 전체글 노출 차단)
      const normTeacherClass = String(teacherClass).replace(/\s+/g, '').toLowerCase();
      result = result.filter(p => {
        if (!p.targetClass) return false;
        const normTarget = String(p.targetClass).replace(/\s+/g, '').toLowerCase();
        return normTarget === normTeacherClass;
      });
    } else {
      if (selectedClass === 'PUBLIC_ONLY') {
        result = result.filter(p => p.visibility === 'ALL');
      } else if (selectedClass !== 'ALL') {
        const normSelected = String(selectedClass).replace(/\s+/g, '').toLowerCase();
        result = result.filter(p => {
          if (p.visibility === 'ALL') return true;
          if (!p.targetClass) return false;
          return String(p.targetClass).replace(/\s+/g, '').toLowerCase() === normSelected;
        });
      }
    }

    if (selectedPostType !== 'ALL') {
      result = result.filter(p => (p.postType || 'POST') === selectedPostType);
    }

    if (searchKeyword.trim()) {
      const kw = searchKeyword.toLowerCase().trim();
      result = result.filter(p => 
        (p.title && p.title.toLowerCase().includes(kw)) ||
        (p.content && p.content.toLowerCase().includes(kw)) ||
        (p.authorName && p.authorName.toLowerCase().includes(kw)) ||
        (p.targetClass && p.targetClass.toLowerCase().includes(kw))
      );
    }

    if (sortBy === 'POPULAR') {
      result.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
    } else {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return result;
  }, [posts, isTeacher, teacherClass, selectedClass, searchKeyword, sortBy, selectedPostType]);

  // Handle Like Toggle
  const handleToggleLike = async (postId) => {
    const currentUserId = currentUser?.id ? String(currentUser.id) : 'admin';
    
    // Optimistic UI update
    const updated = posts.map(p => {
      if (p.id !== postId) return p;
      const liked = Array.isArray(p.likedUserIds) ? [...p.likedUserIds] : [];
      const isLiked = liked.includes(currentUserId);
      const newLiked = isLiked ? liked.filter(u => u !== currentUserId) : [...liked, currentUserId];
      const newCount = isLiked ? Math.max(0, (p.likeCount || 0) - 1) : (p.likeCount || 0) + 1;
      return { ...p, likeCount: newCount, likedUserIds: newLiked };
    });
    savePostsLocal(updated);

    try {
      const token = localStorage.getItem('takeme_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch(`${API_BASE_URL}/routing/board/posts/${postId}/like`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId: currentUserId })
      });
    } catch (e) {
      console.warn('Like API call failed, saved locally', e);
    }
  };

  // Handle Comment Add
  const handleAddComment = async (postId) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;

    const authorName = currentUser?.name ? `${currentUser.name} 관리자` : '관리자';
    const newComment = {
      id: Date.now(),
      authorName,
      authorRole: 'ADMIN',
      content: text,
      createdAt: new Date().toISOString()
    };

    // Optimistic UI update
    const updated = posts.map(p => {
      if (p.id !== postId) return p;
      return {
        ...p,
        comments: [...(p.comments || []), newComment]
      };
    });
    savePostsLocal(updated);
    setCommentInputs(prev => ({ ...prev, [postId]: '' }));

    try {
      const token = localStorage.getItem('takeme_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch(`${API_BASE_URL}/routing/board/posts/${postId}/comments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content: text,
          authorName,
          authorRole: 'ADMIN'
        })
      });
    } catch (e) {
      console.warn('Comment API call failed, saved locally', e);
    }
  };

  // Handle Comment Delete
  const handleDeleteComment = async (postId, commentId) => {
    if (!window.confirm('이 댓글을 삭제하시겠습니까?')) return;

    const updated = posts.map(p => {
      if (p.id !== postId) return p;
      return {
        ...p,
        comments: (p.comments || []).filter(c => c.id !== commentId)
      };
    });
    savePostsLocal(updated);

    try {
      const token = localStorage.getItem('takeme_token');
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch(`${API_BASE_URL}/routing/board/posts/${postId}/comments/${commentId}`, {
        method: 'DELETE',
        headers
      });
    } catch (e) {
      console.warn('Comment delete API failed, updated locally', e);
    }
  };

  // Handle Post Delete
  const handleDeletePost = async (postId) => {
    const updated = posts.filter(p => p.id !== postId);
    savePostsLocal(updated);
    setPostToDelete(null);

    try {
      const token = localStorage.getItem('takeme_token');
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch(`${API_BASE_URL}/routing/board/posts/${postId}`, {
        method: 'DELETE',
        headers
      });
    } catch (e) {
      console.warn('Post delete API failed, updated locally', e);
    }
  };

  // Handle Multiple Files Upload to Cloud Storage API
  const handleFileUpload = async (e) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    setIsUploadingToCloud(true);
    const newImageUrls = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      if (file.size > 20 * 1024 * 1024) {
        alert(`${file.name}: 20MB 이하의 이미지만 업로드 가능합니다.`);
        continue;
      }

      try {
        const compressed = await compressImage(file);
        const base64Data = compressed.base64Data;
        const uploadFilename = compressed.filename;
        const uploadMime = compressed.mimeType;

        let finalUrl = base64Data;
        try {
          const res = await fetch(`${API_BASE_URL}/routing/board/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              base64Data,
              filename: uploadFilename,
              mimeType: uploadMime
            })
          });
          const data = await res.json();
          if (res.ok && data.url) {
            finalUrl = data.url;
          }
        } catch (netErr) {
          console.warn('Cloud upload fallback to local base64', netErr);
        }

        newImageUrls.push(finalUrl);
      } catch (err) {
        console.error('File reading failed', file.name, err);
      }
    }

    if (newImageUrls.length > 0) {
      setPostForm(prev => {
        const currentImages = Array.isArray(prev.images) ? prev.images : (prev.imageUrl ? [prev.imageUrl] : []);
        const isPresetOnly = currentImages.length === 1 && PRESET_PHOTOS.some(p => p.url === currentImages[0]);
        const updatedImages = isPresetOnly ? newImageUrls : [...currentImages, ...newImageUrls];
        return {
          ...prev,
          images: updatedImages,
          imageUrl: prev.imageUrl && !isPresetOnly ? prev.imageUrl : updatedImages[0]
        };
      });

      const uploadedCloudItems = newImageUrls.map((url, i) => ({
        id: `upload-${Date.now()}-${i}`,
        name: files[i]?.name || '활동사진.jpg',
        url,
        size: files[i] ? `${(files[i].size / (1024 * 1024)).toFixed(2)} MB` : '-',
        uploadedAt: '방금 전'
      }));
      setCloudStoredPhotos(prev => {
        const updated = [...uploadedCloudItems, ...prev];
        try {
          localStorage.setItem('takeme_teacher_cloud_photos', JSON.stringify(updated));
        } catch (_) {}
        return updated;
      });
    }

    setIsUploadingToCloud(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveImage = (indexToRemove) => {
    setPostForm(prev => {
      const currentImages = Array.isArray(prev.images) ? prev.images : [];
      const updated = currentImages.filter((_, idx) => idx !== indexToRemove);
      const isRemovedPrimary = prev.imageUrl === currentImages[indexToRemove];
      return {
        ...prev,
        images: updated,
        imageUrl: updated.length > 0 ? (isRemovedPrimary ? updated[0] : prev.imageUrl) : ''
      };
    });
  };

  const handleSetPrimaryImage = (url) => {
    setPostForm(prev => ({ ...prev, imageUrl: url }));
  };

  const handleSelectPreset = (presetUrl) => {
    setPostForm(prev => {
      const currentImages = Array.isArray(prev.images) ? prev.images : [];
      const updated = currentImages.includes(presetUrl) ? currentImages : [...currentImages, presetUrl];
      return {
        ...prev,
        imageUrl: presetUrl,
        images: updated
      };
    });
  };

  // Handle Save New or Edited Post
  const handleSavePost = async () => {
    if (!postForm.postType) {
      alert('카테고리(알림장 또는 게시물)를 선택해 주세요.');
      return;
    }
    if (!postForm.title.trim()) {
      alert('게시글 제목을 입력해 주세요.');
      return;
    }
    if (!postForm.content.trim()) {
      alert('게시글 내용을 입력해 주세요.');
      return;
    }

    const activeAcademyId = selectedAcademyId || localStorage.getItem('takeme_selected_academy_id') || undefined;
    const formImages = Array.isArray(postForm.images) && postForm.images.length > 0
      ? postForm.images
      : (postForm.imageUrl ? [postForm.imageUrl] : [PRESET_PHOTOS[0].url]);
    const primaryImageUrl = postForm.imageUrl || formImages[0] || PRESET_PHOTOS[0].url;

    if (editingPost) {
      // Edit mode
      const updated = posts.map(p => {
        if (p.id !== editingPost.id) return p;
        return {
          ...p,
          title: postForm.title.trim(),
          content: postForm.content.trim(),
          postType: postForm.postType,
          visibility: postForm.visibility,
          targetClass: postForm.visibility === 'CLASS' ? postForm.targetClass : null,
          imageUrl: primaryImageUrl,
          images: formImages,
          authorName: postForm.authorName || '관리자'
        };
      });
      savePostsLocal(updated);
      setEditingPost(null);
      setIsCreatingPost(false);

      try {
        const token = localStorage.getItem('takeme_token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        await fetch(`${API_BASE_URL}/routing/board/posts/${editingPost.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            title: postForm.title.trim(),
            content: postForm.content.trim(),
            postType: postForm.postType,
            visibility: postForm.visibility,
            targetClass: postForm.visibility === 'CLASS' ? postForm.targetClass : null,
            imageUrl: primaryImageUrl,
            images: formImages,
          })
        });
      } catch (e) {
        console.warn('Update API failed, saved locally', e);
      }
    } else {
      // Create mode
      const newPost = {
        id: Date.now(),
        educationLevel: currentEducationLevel,
        title: postForm.title.trim(),
        content: postForm.content.trim(),
        postType: postForm.postType,
        visibility: postForm.visibility,
        targetClass: postForm.visibility === 'CLASS' ? postForm.targetClass : null,
        imageUrl: primaryImageUrl,
        images: formImages,
        authorName: postForm.authorName || defaultAuthorName,
        authorRole: isTeacher ? 'TEACHER' : 'ADMIN',
        likeCount: 0,
        likedUserIds: [],
        comments: [],
        createdAt: new Date().toISOString()
      };

      const updated = [newPost, ...posts];
      savePostsLocal(updated);
      setIsCreatingPost(false);
      setSelectedPostType(postForm.postType);

      try {
        const token = localStorage.getItem('takeme_token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${API_BASE_URL}/routing/board/posts`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            title: newPost.title,
            content: newPost.content,
            postType: newPost.postType,
            visibility: newPost.visibility,
            targetClass: newPost.targetClass,
            imageUrl: newPost.imageUrl,
            images: newPost.images,
            authorName: newPost.authorName,
            authorRole: newPost.authorRole,
            academyId: activeAcademyId ? Number(activeAcademyId) : undefined
          })
        });
        if (res.ok) {
          const savedData = await res.json();
          // Update id from server
          if (savedData?.id) {
            savePostsLocal(updated.map(p => p.id === newPost.id ? savedData : p));
          }
        }
      } catch (e) {
        console.warn('Create API failed, saved locally', e);
      }
    }

    // Reset Form
    setPostForm({
      title: '',
      content: '',
      postType: initialPostType || '',
      visibility: isTeacher ? 'CLASS' : 'ALL',
      targetClass: (isTeacher && teacherClass) ? teacherClass : (availableClasses[0] || '햇살반'),
      imageUrl: PRESET_PHOTOS[0].url,
      images: [PRESET_PHOTOS[0].url],
      authorName: defaultAuthorName,
      authorRole: isTeacher ? 'TEACHER' : 'ADMIN',
    });
  };


  const canEditPost = (post) => {
    if (isAdmin) return true;
    if (isTeacher) {
      if (post.authorName && post.authorName.includes(currentUser.name)) return true;
      if (post.targetClass && post.targetClass.trim() === teacherClass.trim()) return true;
      if (post.authorRole === 'TEACHER' && post.targetClass === teacherClass) return true;
    }
    return false;
  };


  const handleDownloadCloudImage = async (e, imageUrl, title) => {
    e.stopPropagation();
    if (!imageUrl) return alert('다운로드할 사진이 없습니다.');
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      const cleanTitle = (title || '유치원_활동사진').replace(/[^a-zA-Z0-9가-힣_-]/g, '_');
      link.download = `${cleanTitle}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      window.open(imageUrl, '_blank');
    }
  };

  const openEditModal = (post) => {
    const postImages = Array.isArray(post.images) && post.images.length > 0
      ? post.images
      : (post.imageUrl ? [post.imageUrl] : [PRESET_PHOTOS[0].url]);

    setEditingPost(post);
    setPostForm({
      title: post.title,
      content: post.content,
      postType: post.postType === 'NOTICE' ? 'NOTICE' : 'POST',
      visibility: post.visibility || (isTeacher ? 'CLASS' : 'ALL'),
      targetClass: post.targetClass || (isTeacher ? teacherClass : availableClasses[0]) || '햇살반',
      imageUrl: post.imageUrl || postImages[0] || PRESET_PHOTOS[0].url,
      images: postImages,
      authorName: post.authorName || defaultAuthorName,
      authorRole: post.authorRole || (isTeacher ? 'TEACHER' : 'ADMIN')
    });
    setIsCreatingPost(true);
  };

  return (
    <div className={`absolute inset-0 z-[2000] flex flex-col bg-slate-100 h-full overflow-hidden transition-all duration-300 ${isClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}>
      
      {/* Top Bar Header */}
      <div className="bg-white px-8 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-xs z-10">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-800">
              {isTeacher && teacherClass ? `${teacherClass} 활동 앨범` : '원아 활동 앨범 & 소식 게시판'}
            </h1>
            <span className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
              {isTeacher && teacherClass ? `${teacherClass} 전용` : (selectedClass === 'ALL' ? '전체 보기' : selectedClass === 'PUBLIC_ONLY' ? '전체 공개글' : `${selectedClass} 전용`)}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isTeacher && teacherClass
              ? `${teacherClass} 원아들의 활동 사진과 소식만 모아보는 전용 공간입니다.`
              : '학부모와 접속자는 자신이 속한 반의 사진과 전체 공개 소식만 열람할 수 있습니다.'}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Category Filter Chips (전체 · 알림장 · 게시물) */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600 border border-slate-200">
            <button
              onClick={() => setSelectedPostType('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedPostType === 'ALL' ? 'bg-white text-slate-900 shadow-xs font-black' : 'hover:text-slate-800'
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setSelectedPostType('NOTICE')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                selectedPostType === 'NOTICE' ? 'bg-orange-500 text-white shadow-xs font-black' : 'text-orange-600 hover:text-orange-700'
              }`}
            >
              <span>📢</span>
              <span>알림장</span>
            </button>
            <button
              onClick={() => setSelectedPostType('POST')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                selectedPostType === 'POST' ? 'bg-blue-600 text-white shadow-xs font-black' : 'text-blue-600 hover:text-blue-700'
              }`}
            >
              <span>📝</span>
              <span>게시물</span>
            </button>
          </div>

          {/* Quick View Category Switcher (Admin/Director Only) */}
          {!isTeacher && (
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600 border border-slate-200">
              <button
                onClick={() => setSelectedClass('ALL')}
                className={`px-3 py-1.5 rounded-lg transition-all ${selectedClass === 'ALL' ? 'bg-white text-blue-600 shadow-xs' : 'hover:text-slate-800'}`}
              >
                전체 게시글
              </button>
              <button
                onClick={() => setSelectedClass('PUBLIC_ONLY')}
                className={`px-3 py-1.5 rounded-lg transition-all ${selectedClass === 'PUBLIC_ONLY' ? 'bg-white text-blue-600 shadow-xs' : 'hover:text-slate-800'}`}
              >
                전체 공개 공지
              </button>
            </div>
          )}

          {/* Sort Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600 border border-slate-200">
            <button
              onClick={() => setSortBy('LATEST')}
              className={`px-3 py-1.5 rounded-lg transition-all ${sortBy === 'LATEST' ? 'bg-white text-blue-600 shadow-xs' : 'hover:text-slate-800'}`}
            >
              최신순
            </button>
            <button
              onClick={() => setSortBy('POPULAR')}
              className={`px-3 py-1.5 rounded-lg transition-all ${sortBy === 'POPULAR' ? 'bg-white text-blue-600 shadow-xs' : 'hover:text-slate-800'}`}
            >
              인기순
            </button>
          </div>

          {/* New Post Button */}
          <button
            onClick={() => {
              setEditingPost(null);
              setPostForm({
                title: '',
                content: '',
                postType: initialPostType || '',
                visibility: isTeacher ? 'CLASS' : (selectedClass !== 'ALL' && selectedClass !== 'PUBLIC_ONLY' ? 'CLASS' : 'ALL'),
                targetClass: (isTeacher && teacherClass) ? teacherClass : (selectedClass !== 'ALL' && selectedClass !== 'PUBLIC_ONLY' ? selectedClass : (availableClasses[0] || '햇살반')),
                imageUrl: PRESET_PHOTOS[0].url,
                images: [PRESET_PHOTOS[0].url],
                authorName: defaultAuthorName,
                authorRole: isTeacher ? 'TEACHER' : 'ADMIN',
              });
              setIsCreatingPost(true);
            }}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            <span>새 사진/게시글 작성</span>
          </button>
        </div>
      </div>

      {/* Main Content Area - Grid of Cards */}
      <div className="flex-1 overflow-y-auto p-8 bg-slate-50/70">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center py-20 text-slate-400">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-sm font-bold">게시글과 앨범을 불러오는 중입니다...</p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="h-full min-h-[400px] flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-300 text-center p-8">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4 mx-auto">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2">등록된 사진이나 게시글이 없습니다</h3>
            <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
              {searchKeyword ? `'${searchKeyword}' 검색어와 일치하는 게시물이 없습니다.` : '원아들의 신나는 활동 사진이나 공지사항을 첫 번째로 등록해 보세요!'}
            </p>
            <button
              onClick={() => {
                setEditingPost(null);
                setIsCreatingPost(true);
              }}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black shadow-md transition-all"
            >
              + 첫 게시글 작성하기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {filteredPosts.map(post => {
              const currentUserId = currentUser?.id ? String(currentUser.id) : 'admin';
              const isLiked = Array.isArray(post.likedUserIds) && post.likedUserIds.includes(currentUserId);
              const isClassSpecific = post.visibility === 'CLASS' && post.targetClass;
              const isCommentExpanded = activeCommentPostId === post.id;
              const formattedDate = new Date(post.createdAt).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              const postImages = Array.isArray(post.images) && post.images.length > 0 
                ? post.images 
                : (post.imageUrl ? [post.imageUrl] : []);

              return (
                <div
                  key={post.id}
                  className="bg-white rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden group"
                >
                  {/* [요구사항 반영 1] 메인 사진 위에 제목 */}
                  <div className="p-4 pb-3 bg-white border-b border-slate-100 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full border ${
                          (post.postType === 'NOTICE')
                            ? 'bg-orange-50 text-orange-600 border-orange-200'
                            : 'bg-blue-50 text-blue-600 border-blue-200'
                        }`}>
                          <span>{post.postType === 'NOTICE' ? '📢 알림장' : '📝 게시물'}</span>
                        </span>
                        {isClassSpecific ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            <span>{post.targetClass} 전용</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span>전체 공개</span>
                          </span>
                        )}
                      </div>

                      {/* Post Actions (Admin or Authorized Teacher) */}
                      {canEditPost(post) && (
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => openEditModal(post)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-xs font-bold"
                            title="게시글 수정"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => setPostToDelete(post)}
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors text-xs font-bold"
                            title="게시글 삭제"
                          >
                            삭제
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 제목 */}
                    <h3 className="font-black text-slate-900 text-base leading-snug line-clamp-2 hover:text-blue-600 transition-colors" title={post.title}>
                      {post.title}
                    </h3>
                  </div>

                  {/* [요구사항 반영 2] 메인 사진 이미지 영역 */}
                  <div 
                    onClick={() => setPreviewGallery({ images: postImages, index: 0 })}
                    className="relative w-full aspect-[16/10] bg-slate-100 overflow-hidden cursor-zoom-in"
                  >
                    {post.imageUrl ? (
                      <img
                        src={post.imageUrl}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                        <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-400">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <span className="text-xs mt-1 font-bold">등록된 사진 없음</span>
                      </div>
                    )}

                    {postImages.length > 1 && (
                      <div className="absolute top-2.5 right-2.5 bg-black/70 backdrop-blur-xs text-white text-[11px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-md z-10">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>사진 {postImages.length}장</span>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 px-3 py-1.5 bg-black/60 text-white text-[11px] font-bold rounded-full backdrop-blur-xs transition-opacity shadow-sm">
                        {postImages.length > 1 ? `전체 ${postImages.length}장 크게 보기` : '크게 보기'}
                      </span>
                    </div>
                  </div>

                  {/* 여러 장일 경우 작은 썸네일 스트립 표시 */}
                  {postImages.length > 1 && (
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border-b border-slate-100 overflow-x-auto">
                      {postImages.slice(0, 6).map((imgUrl, idx) => (
                        <div
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewGallery({ images: postImages, index: idx });
                          }}
                          className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-slate-200 hover:border-blue-500 hover:scale-105 transition-all cursor-pointer shadow-2xs"
                          title={`사진 ${idx + 1} 크게 보기`}
                        >
                          <img src={imgUrl} alt={`사진 ${idx+1}`} className="w-full h-full object-cover" />
                          {idx === 5 && postImages.length > 6 && (
                            <div className="absolute inset-0 bg-black/60 text-white text-[10px] font-black flex items-center justify-center">
                              +{postImages.length - 6}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* [요구사항 반영 3] 사진 아래 글 쓴이 & 본문 */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      {/* 글 쓴이 정보 */}
                      <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 text-white font-black text-xs flex items-center justify-center shadow-xs">
                            {post.authorName?.[0] || '원'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-black text-slate-800">{post.authorName}</span>
                              <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border ${
                                (post.postType === 'NOTICE')
                                  ? 'bg-orange-50 text-orange-600 border-orange-200'
                                  : 'bg-blue-50 text-blue-600 border-blue-200'
                              }`}>
                                {post.postType === 'NOTICE' ? '알림장' : '게시물'}
                              </span>
                              <span className="text-[10px] font-bold px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                                {post.authorRole === 'ADMIN' ? '관리자' : post.authorRole === 'TEACHER' ? '선생님' : '학부모'}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 block">{formattedDate}</span>
                          </div>
                        </div>
                      </div>

                      {/* 본문 내용 */}
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 mb-3 whitespace-pre-line font-normal">
                        {post.content}
                      </p>
                    </div>

                    {/* [요구사항 반영 4] 좋아요 및 댓글 인터랙션 바 */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {/* 좋아요 버튼 */}
                        <button
                          type="button"
                          onClick={() => handleToggleLike(post.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all transform active:scale-90 ${
                            isLiked 
                              ? 'bg-red-50 text-red-500 border border-red-200' 
                              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          <svg className={`w-4 h-4 transition-transform ${isLiked ? 'text-rose-500 fill-rose-500 scale-110' : 'text-slate-400'}`} viewBox="0 0 24 24" fill={isLiked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                          <span>{post.likeCount || 0}</span>
                        </button>

                        {/* 댓글 버튼 (열기/접기 토글) */}
                        <button
                          type="button"
                          onClick={() => setActiveCommentPostId(isCommentExpanded ? null : post.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            isCommentExpanded
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          <span>댓글 {post.comments?.length || 0}</span>
                        </button>

                        {/* 클라우드 사진 원본 저장 버튼 */}
                        <button
                          type="button"
                          onClick={(e) => handleDownloadCloudImage(e, post.imageUrl, post.title)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-slate-50 text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200"
                          title="클라우드 원본 사진 저장 (PC/휴대폰 다운로드)"
                        >
                          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          <span>사진 저장</span>
                        </button>
                      </div>

                      <span className="text-[11px] text-slate-400 font-medium">
                        {isClassSpecific ? `${post.targetClass}` : '전체공개'}
                      </span>
                    </div>

                    {/* [요구사항 반영 5] 펼쳐지는 댓글 목록 및 입력창 */}
                    {isCommentExpanded && (
                      <div className="mt-3 pt-3 border-t border-dashed border-slate-200 animate-fade-in space-y-3">
                        <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                          <span>댓글 목록 ({post.comments?.length || 0})</span>
                          <span className="text-[10px] text-slate-400 font-normal">학부모 및 교직원 소통</span>
                        </div>

                        {/* 댓글 리스트 */}
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {(!post.comments || post.comments.length === 0) ? (
                            <p className="text-[11px] text-slate-400 text-center py-3 bg-slate-50 rounded-xl">
                              아직 등록된 댓글이 없습니다. 첫 댓글을 남겨보세요!
                            </p>
                          ) : (
                            post.comments.map(c => (
                              <div key={c.id} className="p-2.5 bg-slate-50 rounded-xl text-xs flex justify-between items-start group/comment">
                                <div>
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <span className="font-bold text-slate-800 text-[11px]">{c.authorName}</span>
                                    <span className="text-[9px] px-1 py-0.2 bg-slate-200 text-slate-600 rounded font-medium">
                                      {c.authorRole === 'ADMIN' ? '관리자' : c.authorRole === 'TEACHER' ? '선생님' : '학부모'}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <p className="text-slate-700 leading-normal">{c.content}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteComment(post.id, c.id)}
                                  className="text-slate-300 hover:text-red-500 p-1 opacity-0 group-hover/comment:opacity-100 transition-opacity"
                                  title="댓글 삭제"
                                >
                                  ✕
                                </button>
                              </div>
                            ))
                          )}
                        </div>

                        {/* 댓글 입력창 */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={commentInputs[post.id] || ''}
                            onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(post.id); }}
                            placeholder="따뜻한 댓글을 남겨보세요..."
                            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddComment(post.id)}
                            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-xs transition-colors"
                          >
                            등록
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New / Edit Post Modal */}
      {isCreatingPost && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl p-6 sm:p-8 animate-scale-up border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <h3 className="text-xl font-black text-slate-800">
                {editingPost
                  ? (postForm.postType === 'NOTICE' ? '알림장 수정' : '게시물 수정')
                  : (postForm.postType === 'NOTICE' ? '알림장 작성' : postForm.postType === 'POST' ? '게시물 작성' : '알림장 / 게시글 작성')}
              </h3>
              <button
                type="button"
                onClick={() => { setIsCreatingPost(false); setEditingPost(null); }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-5">
              {/* 카테고리 선택 (알림장 vs 게시물) */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  카테고리 선택 <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPostForm(prev => ({ ...prev, postType: 'NOTICE' }))}
                    className={`py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all border ${
                      postForm.postType === 'NOTICE'
                        ? 'bg-orange-500 text-white border-orange-500 shadow-md ring-2 ring-orange-300'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-orange-50'
                    }`}
                  >
                    <span className="text-base">📢</span>
                    <span>알림장 (중요 공지)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPostForm(prev => ({ ...prev, postType: 'POST' }))}
                    className={`py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all border ${
                      postForm.postType === 'POST'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-300'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50'
                    }`}
                  >
                    <span className="text-base">📝</span>
                    <span>게시물 (일상/활동)</span>
                  </button>
                </div>
              </div>
              {/* 제목 */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  게시글 제목 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={postForm.title}
                  onChange={(e) => setPostForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="예: 햇살반 가을 소풍 활동 사진입니다"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              {/* 공개 범위 선택 (교사는 자동으로 담당 반 전용으로 고정) */}
              {isTeacher && teacherClass ? (
                <div className="bg-blue-50/80 p-4 rounded-2xl border border-blue-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-500 block mb-0.5">게시 대상</span>
                    <span className="text-sm font-extrabold text-blue-900">{teacherClass} 전용 사진첩</span>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 bg-blue-600 text-white rounded-xl shadow-xs">
                    {teacherClass}만 열람
                  </span>
                </div>
              ) : (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <label className="block text-xs font-black text-slate-700">
                    공개 범위 설정 <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPostForm(prev => ({ ...prev, visibility: 'ALL' }))}
                      className={`py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all border ${
                        postForm.visibility === 'ALL'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>전체 공개 (모든 학부모·교사)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPostForm(prev => ({ ...prev, visibility: 'CLASS' }))}
                      className={`py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all border ${
                        postForm.visibility === 'CLASS'
                          ? 'bg-orange-500 text-white border-orange-500 shadow-md'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>반별 전용 (선택한 반만 열람)</span>
                    </button>
                  </div>

                  {/* 반 선택 (반별 공개일 때만 노출) */}
                  {postForm.visibility === 'CLASS' && (
                    <div className="pt-2 border-t border-slate-200 animate-fade-in flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-600 shrink-0">대상 반 선택:</span>
                      <select
                        value={postForm.targetClass}
                        onChange={(e) => setPostForm(prev => ({ ...prev, targetClass: e.target.value }))}
                        className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        {availableClasses.map(cls => (
                          <option key={cls} value={cls}>{cls}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* 활동 사진 업로드 (다중 선택 지원) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-black text-slate-700">
                      활동 사진 업로드 <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                      총 {postForm.images?.length || (postForm.imageUrl ? 1 : 0)}장 선택됨
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {cloudStoredPhotos.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const urls = cloudStoredPhotos.map(p => p.url).filter(Boolean);
                          setPostForm(prev => {
                            const current = Array.isArray(prev.images) ? prev.images : [];
                            const isPresetOnly = current.length === 1 && PRESET_PHOTOS.some(p => p.url === current[0]);
                            const merged = isPresetOnly ? urls : Array.from(new Set([...current, ...urls]));
                            return {
                              ...prev,
                              images: merged,
                              imageUrl: prev.imageUrl && !isPresetOnly ? prev.imageUrl : (merged[0] || prev.imageUrl)
                            };
                          });
                        }}
                        className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-xl border border-amber-200 transition flex items-center gap-1.5 shadow-2xs"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <span>임시 보관함 사진 가져오기 ({cloudStoredPhotos.length}장)</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingToCloud}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>{isUploadingToCloud ? '업로드 중...' : '컴퓨터에서 사진 여러장 추가'}</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* 다중 사진 갤러리 그리드 미리보기 */}
                {postForm.images && postForm.images.length > 0 ? (
                  <div className="mb-3 space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5 max-h-56 overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-200">
                      {postForm.images.map((imgUrl, idx) => {
                        const isPrimary = (postForm.imageUrl === imgUrl) || (!postForm.imageUrl && idx === 0);
                        return (
                          <div
                            key={idx}
                            onClick={() => handleSetPrimaryImage(imgUrl)}
                            className={`group relative rounded-xl overflow-hidden aspect-video border-2 cursor-pointer transition-all ${
                              isPrimary
                                ? 'border-blue-600 ring-2 ring-blue-400 shadow-sm'
                                : 'border-slate-200 hover:border-slate-400 opacity-90 hover:opacity-100'
                            }`}
                          >
                            <img src={imgUrl} alt={`업로드 사진 ${idx + 1}`} className="w-full h-full object-cover" />
                            
                            {/* 대표 뱃지 */}
                            {isPrimary ? (
                              <div className="absolute top-1 left-1 bg-blue-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded shadow-xs">
                                대표 사진
                              </div>
                            ) : (
                              <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                클릭하여 대표 설정
                              </div>
                            )}

                            {/* 개별 사진 삭제 버튼 */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveImage(idx);
                              }}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-red-600 text-white flex items-center justify-center text-[11px] font-bold shadow-xs transition-colors"
                              title="이 사진 제거"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      클릭한 사진이 게시글 목록에 나타나는 <strong>[대표 사진]</strong>으로 지정됩니다. (여러 장의 사진은 부모님 앱 및 게시판 상세에서 모두 볼 수 있습니다.)
                    </p>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-36 bg-slate-50 hover:bg-blue-50/30 border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-2xl flex flex-col items-center justify-center text-slate-400 cursor-pointer mb-3 transition-colors"
                  >
                    <svg className="w-7 h-7 text-slate-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs font-bold text-slate-600">클릭하여 사진을 여러 장 선택하세요</span>
                    <span className="text-[11px] text-slate-400 mt-0.5">JPG, PNG, WEBP 다중 선택 지원 (장당 최대 20MB)</span>
                  </div>
                )}

                {/* 추천 테마 사진 추가 */}
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 mb-1.5 block">
                    또는 추천 테마 사진 추가 (클릭하여 추가):
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {PRESET_PHOTOS.map((preset, idx) => {
                      const isAdded = postForm.images?.includes(preset.url);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectPreset(preset.url)}
                          className={`relative rounded-xl overflow-hidden aspect-video border-2 transition-all ${
                            isAdded ? 'border-blue-600 ring-2 ring-blue-300' : 'border-transparent hover:border-slate-300'
                          }`}
                          title={preset.name}
                        >
                          <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                          {isAdded && (
                            <div className="absolute inset-0 bg-blue-900/40 flex items-center justify-center text-white text-[10px] font-black">
                              추가됨
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 본문 내용 */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  활동 내용 및 설명 <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={postForm.content}
                  onChange={(e) => setPostForm(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="원아들의 활동 이야기나 공지사항 내용을 자유롭게 작성해 주세요..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none"
                />
              </div>

              {/* 작성자 명 */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">작성자 명칭</label>
                <input
                  type="text"
                  value={postForm.authorName}
                  onChange={(e) => setPostForm(prev => ({ ...prev, authorName: e.target.value }))}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-3 pt-6 mt-6 border-t border-slate-100">
              <button
                type="button"
                onClick={() => { setIsCreatingPost(false); setEditingPost(null); }}
                className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSavePost}
                className={`flex-1 py-3.5 text-white font-black rounded-xl text-sm shadow-lg transition-all ${
                  postForm.postType === 'NOTICE'
                    ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20'
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                }`}
              >
                {editingPost
                  ? (postForm.postType === 'NOTICE' ? '알림장 수정 완료' : '게시물 수정 완료')
                  : (postForm.postType === 'NOTICE' ? '알림장 발행하기' : '게시물 발행하기')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Post Modal */}
      {postToDelete && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center shadow-2xl animate-scale-up border border-slate-100">
            <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-3 mx-auto">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2">게시글을 삭제하시겠습니까?</h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              <b className="text-slate-800">'{postToDelete.title}'</b><br />
              삭제된 게시글과 첨부된 사진, 댓글은 복구할 수 없습니다.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPostToDelete(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => handleDeletePost(postToDelete.id)}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl text-xs shadow-md transition-colors"
              >
                삭제 확정
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Preview Modal with Multi-Photo Navigation */}
      {previewGallery && previewGallery.images && previewGallery.images.length > 0 && (
        <div 
          onClick={() => setPreviewGallery(null)}
          className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-5xl max-h-[92vh] w-full flex flex-col items-center select-none"
          >
            {/* Top Bar inside modal */}
            <div className="w-full flex items-center justify-between text-white text-xs font-bold pb-3 px-2">
              <span className="bg-white/20 px-3 py-1 rounded-full backdrop-blur-xs">
                {previewGallery.index + 1} / {previewGallery.images.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => handleDownloadCloudImage(e, previewGallery.images[previewGallery.index], `photo_${previewGallery.index + 1}`)}
                  className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>다운로드</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewGallery(null)}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-sm font-bold transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Main Image with Prev / Next Arrow */}
            <div className="relative flex items-center justify-center w-full max-h-[75vh]">
              {previewGallery.images.length > 1 && (
                <button
                  type="button"
                  onClick={() => setPreviewGallery(prev => ({
                    ...prev,
                    index: (prev.index - 1 + prev.images.length) % prev.images.length
                  }))}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all z-20 shadow-lg border border-white/20"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}

              <img
                src={previewGallery.images[previewGallery.index]}
                alt={`확대 이미지 ${previewGallery.index + 1}`}
                className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl animate-scale-up"
              />

              {previewGallery.images.length > 1 && (
                <button
                  type="button"
                  onClick={() => setPreviewGallery(prev => ({
                    ...prev,
                    index: (prev.index + 1) % prev.images.length
                  }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all z-20 shadow-lg border border-white/20"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>

            {/* Thumbnail Bottom Row */}
            {previewGallery.images.length > 1 && (
              <div className="flex items-center gap-2 mt-4 px-2 overflow-x-auto max-w-full py-1">
                {previewGallery.images.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPreviewGallery(prev => ({ ...prev, index: i }))}
                    className={`w-12 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${
                      i === previewGallery.index ? 'border-blue-400 scale-105 ring-2 ring-blue-400/50' : 'border-white/30 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt={`썸네일 ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
