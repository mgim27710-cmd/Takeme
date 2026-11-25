import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Academy } from '../entities/academy.entity';
import { BoardPost } from '../entities/board-post.entity';
import { BoardComment } from '../entities/board-comment.entity';
import { MediaAsset } from '../entities/media-asset.entity';

interface DummySeedPost {
  educationLevel: '유치원' | '초등부' | '중,고등부';
  postType: 'NOTICE' | 'POST';
  visibility: 'ALL' | 'CLASS';
  targetClass?: string;
  title: string;
  content: string;
  imageUrl?: string;
  images?: string[];
  authorName: string;
  authorRole: 'ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT';
  likeCount: number;
  likedUserIds?: string[];
  daysAgo: number;
  hoursAgo: number;
  comments?: Array<{
    authorName: string;
    authorRole: 'ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT';
    content: string;
    minutesAgo: number;
  }>;
}

const DUMMY_POSTS: DummySeedPost[] = [
  // ===================== [유치원 알림장 (NOTICE)] =====================
  {
    educationLevel: '유치원',
    postType: 'NOTICE',
    visibility: 'CLASS',
    targetClass: '햇살반',
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
    likeCount: 9,
    likedUserIds: ['admin', 'parent_1', 'parent_2'],
    daysAgo: 0,
    hoursAgo: 3,
    comments: [
      {
        authorName: '하늘이 어머님',
        authorRole: 'PARENT',
        content: '하늘이가 집에 오자마자 낙엽 왕관 자랑하네요! 자연에서 뛰노는 모습이 너무 예쁩니다. 선생님 늘 감사드려요~',
        minutesAgo: 120
      },
      {
        authorName: '원장선생님',
        authorRole: 'ADMIN',
        content: '햇살반 친구들 작품 솜씨가 대단하네요. 밝은 웃음이 사진 너머로 전해집니다 ^^',
        minutesAgo: 60
      }
    ]
  },
  {
    educationLevel: '유치원',
    postType: 'NOTICE',
    visibility: 'CLASS',
    targetClass: '새싹반',
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
    likeCount: 7,
    likedUserIds: ['admin', 'parent_3'],
    daysAgo: 1,
    hoursAgo: 4,
    comments: [
      {
        authorName: '도윤이 아버님',
        authorRole: 'PARENT',
        content: '도윤이가 집중해서 빚는 모습이 기특하네요. 알림 확인했습니다!',
        minutesAgo: 180
      }
    ]
  },
  {
    educationLevel: '유치원',
    postType: 'NOTICE',
    visibility: 'CLASS',
    targetClass: '풀잎반',
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
    likeCount: 6,
    likedUserIds: [],
    daysAgo: 1,
    hoursAgo: 7,
    comments: []
  },
  {
    educationLevel: '유치원',
    postType: 'NOTICE',
    visibility: 'ALL',
    targetClass: undefined,
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
    likeCount: 15,
    likedUserIds: ['admin', 'parent_1', 'parent_4'],
    daysAgo: 2,
    hoursAgo: 1,
    comments: [
      {
        authorName: '지우 어머님',
        authorRole: 'PARENT',
        content: '매번 균형 잡힌 맛있는 식단 준비해 주셔서 안심이 됩니다. 감사합니다!',
        minutesAgo: 600
      }
    ]
  },
  {
    educationLevel: '유치원',
    postType: 'NOTICE',
    visibility: 'ALL',
    targetClass: undefined,
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
    likeCount: 22,
    likedUserIds: ['admin'],
    daysAgo: 3,
    hoursAgo: 5,
    comments: [
      {
        authorName: '서준이 어머님',
        authorRole: 'PARENT',
        content: '항상 원아 안전에 각별히 신경 써주셔서 든든합니다. 5분 전 대기 잘 지키겠습니다!',
        minutesAgo: 1440
      }
    ]
  },

  // ===================== [유치원 일반 소통 게시판 (POST)] =====================
  {
    educationLevel: '유치원',
    postType: 'POST',
    visibility: 'ALL',
    targetClass: undefined,
    title: '❤️ [칭찬합니다] 2호차 기사님과 지도교사 선생님 늘 감사드려요',
    content: `매일 아침 2호차에서 밝은 미소로 아이 이름 하나하나 다정하게 불러주시는 기사님과, 아이 신발 끈 풀린 것까지 세심하게 챙겨주시는 지도교사 선생님께 감사 인사 남깁니다.
처음 유치원 버스를 탈 때 울먹이던 아이가 이제는 버스 오는 시간만 기다릴 정도로 편안해졌어요.
항상 안전 운전해 주셔서 마음 놓고 보냅니다. 선생님, 기사님 모두 건강 조심하세요!`,
    imageUrl: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=800&auto=format&fit=crop&q=80',
    images: [],
    authorName: '햇살반 예은맘',
    authorRole: 'PARENT',
    likeCount: 18,
    likedUserIds: ['admin', 'teacher_1'],
    daysAgo: 0,
    hoursAgo: 5,
    comments: [
      {
        authorName: '2호차 운전기사님',
        authorRole: 'ADMIN',
        content: '따뜻한 말씀 감사합니다 예은 어머님! 예은이가 인사도 잘해서 제가 매일 아침 큰 힘을 얻습니다. 늘 안전하게 모시겠습니다 ^^',
        minutesAgo: 240
      },
      {
        authorName: '2호차 동승 지도교사',
        authorRole: 'TEACHER',
        content: '어머님 따뜻한 후기글에 오늘 피로가 싹 가시네요! 예은이랑 내일도 활기차게 인사 나누겠습니다 ㅎㅎ',
        minutesAgo: 200
      }
    ]
  },
  {
    educationLevel: '유치원',
    postType: 'POST',
    visibility: 'ALL',
    targetClass: undefined,
    title: '📢 [나눔] 원복 7호 동복 자켓 & 활동복 바지 나눔합니다',
    content: `안녕하세요 학부모님들!
아이가 쑥쑥 자라서 작년에 깨끗하게 입었던 원복 7호(동복 자켓 1벌, 활동복 상하의 1벌)를 나눔하고자 합니다.
헤진 곳 없이 상태 매우 깨끗하고 드라이클리닝 완료했습니다.
필요하신 학부모님께서는 댓글 남겨주시면 가방에 담아 원무실에 맡겨두겠습니다.`,
    imageUrl: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&auto=format&fit=crop&q=80',
    images: [],
    authorName: '새싹반 준우맘',
    authorRole: 'PARENT',
    likeCount: 5,
    likedUserIds: [],
    daysAgo: 1,
    hoursAgo: 2,
    comments: [
      {
        authorName: '풀잎반 지호맘',
        authorRole: 'PARENT',
        content: '어머님 안녕하세요! 저희 지호가 체구가 작아서 7호가 딱 맞을 것 같아요. 나눔 가능할까요?',
        minutesAgo: 90
      },
      {
        authorName: '새싹반 준우맘',
        authorRole: 'PARENT',
        content: '네 지호맘님! 내일 등원길에 원무실 앞 바구니에 지호 이름 적어서 전달해 놓겠습니다 ^^',
        minutesAgo: 45
      }
    ]
  },
  {
    educationLevel: '유치원',
    postType: 'POST',
    visibility: 'CLASS',
    targetClass: '햇살반',
    title: '☀️ 햇살반 가을 바자회 준비 관련 아이디어 모음 & 학부모 소통',
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
    likeCount: 8,
    likedUserIds: [],
    daysAgo: 2,
    hoursAgo: 6,
    comments: [
      {
        authorName: '햇살반 담임선생님',
        authorRole: 'TEACHER',
        content: '학부모님들의 자발적인 관심과 참여에 깊이 감사드립니다! 교실에서도 아이들과 기부 물품 분류 활동을 연계해 보겠습니다 ^^',
        minutesAgo: 300
      }
    ]
  },

  // ===================== [초등부 알림장 & 게시판] =====================
  {
    educationLevel: '초등부',
    postType: 'NOTICE',
    visibility: 'ALL',
    targetClass: undefined,
    title: '[전체 공지] 🚌 방과 후 연계 셔틀 운행 시간 및 안전 승하차 구역 변경',
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
    likeCount: 14,
    likedUserIds: ['admin'],
    daysAgo: 0,
    hoursAgo: 6,
    comments: [
      {
        authorName: '민재 학부모님',
        authorRole: 'PARENT',
        content: '동문 후문 정류장 위치 확인했습니다. 기사님 수고 많으십니다!',
        minutesAgo: 150
      }
    ]
  },
  {
    educationLevel: '초등부',
    postType: 'NOTICE',
    visibility: 'CLASS',
    targetClass: '햇살반',
    title: '[초등 3~4학년 햇살반] 🔬 창의 코딩 & 로봇 메이커 프로젝트 발표회',
    content: `햇살반 친구들과 4주간 준비한 스마트 시티 친환경 교통 신호등 & 자율주행 모형 발표회를 잘 마무리했습니다!
스크래치 블록 코딩과 센서 모듈을 직접 결합하여 프로그래밍 논리를 배우고 문제 해결력을 길렀습니다.
아이들의 빛나는 아이디어가 담긴 발표 사진을 확인해 보세요.`,
    imageUrl: 'https://images.unsplash.com/photo-1588072432836-e10032774350?w=800&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1588072432836-e10032774350?w=800&auto=format&fit=crop&q=80'
    ],
    authorName: '박준호 지도교사 (햇살반)',
    authorRole: 'TEACHER',
    likeCount: 11,
    likedUserIds: ['admin'],
    daysAgo: 1,
    hoursAgo: 8,
    comments: []
  },
  {
    educationLevel: '초등부',
    postType: 'POST',
    visibility: 'ALL',
    targetClass: undefined,
    title: '☂️ [분실물] 초등 1호차 뒷좌석에서 노란색 캐릭터 장우산을 보관 중입니다',
    content: `오늘 1호차 15:30 운행 종료 후 차량 방역 및 점검 중 4번째 열 좌석에서 노란색 손잡이 장우산이 발견되었습니다.
손잡이에 네임택이 부착되어 있지 않아 행정실 분실물 보관함에 보관하고 있으니, 해당 학생 또는 학부모님께서는 행정실로 문의 바랍니다.`,
    imageUrl: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&auto=format&fit=crop&q=80',
    images: [],
    authorName: '1호차 담당 안전기사',
    authorRole: 'ADMIN',
    likeCount: 6,
    likedUserIds: [],
    daysAgo: 1,
    hoursAgo: 2,
    comments: [
      {
        authorName: '태현이 학부모님',
        authorRole: 'PARENT',
        content: '태현이가 오늘 우산 잃어버렸다고 했는데 맞네요! 내일 셔틀 탑승할 때 기사님께 말씀드리겠습니다. 보관해 주셔서 감사합니다!',
        minutesAgo: 60
      }
    ]
  },

  // ===================== [중,고등부 알림장 & 게시판] =====================
  {
    educationLevel: '중,고등부',
    postType: 'NOTICE',
    visibility: 'ALL',
    targetClass: undefined,
    title: '[전체 공지] 🌙 2학기 기말고사 집중 대비 심야 안심 귀가 셔틀 특별 편성',
    content: `중·고등부 원생 및 학부모님 안녕하십니까.
다문화 및 내신 고득점을 위한 2학기 기말고사 대비 자율학습 집중 기간을 맞이하여, 밤늦게까지 학업에 매진하는 학생들의 귀가 안전을 지원합니다.

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
    likeCount: 25,
    likedUserIds: ['admin', 'student_1'],
    daysAgo: 0,
    hoursAgo: 9,
    comments: [
      {
        authorName: '김민성 학생',
        authorRole: 'STUDENT',
        content: '독서실 끝나고 밤 11시에 혼자 걸어가기 무서웠는데 셔틀 생겨서 너무 좋습니다!',
        minutesAgo: 180
      },
      {
        authorName: '고2 학부모님',
        authorRole: 'PARENT',
        content: '시험 기간마다 픽업 가느라 부담이었는데 학원에서 안심 셔틀 운영해 주시니 정말 든든합니다.',
        minutesAgo: 110
      }
    ]
  },
  {
    educationLevel: '중,고등부',
    postType: 'NOTICE',
    visibility: 'CLASS',
    targetClass: '열매반',
    title: '[중등 심화 열매반] 📝 11월 전국 모의평가 분석 및 1:1 취약유형 피드백 세션',
    content: `열매반 학생 여러분 및 학부모님.
지난주 시행된 11월 전국 연합 모의평가 과목별 가채점 결과 분석표가 발송되었습니다.
이번 주 수요일부터 금요일까지 수업 전후 30분씩 1:1 심층 취약 유형 분석 클리닉이 진행되오니 오답 노트를 반드시 지참해 오시기 바랍니다.`,
    imageUrl: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&auto=format&fit=crop&q=80'
    ],
    authorName: '김도현 책임강사 (열매반)',
    authorRole: 'TEACHER',
    likeCount: 12,
    likedUserIds: [],
    daysAgo: 2,
    hoursAgo: 4,
    comments: []
  },
  {
    educationLevel: '중,고등부',
    postType: 'POST',
    visibility: 'ALL',
    targetClass: undefined,
    title: '💡 기말고사 스터디룸 운영 시간 연장 건의 및 스터디원 모집',
    content: `원장선생님 안녕하세요! 고등부 자습실 A룸 시험 기간 주말 개방 시간을 오전 8시부터 오픈해 주실 수 있는지 문의드립니다.
그리고 주말 오전에 영어 빈칸추론 기출 10회독 스터디 같이할 고2 친구들 있으면 댓글 남겨주세요! 같이 열공합시다.`,
    imageUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&auto=format&fit=crop&q=80',
    images: [],
    authorName: '이준호 (고2)',
    authorRole: 'STUDENT',
    likeCount: 16,
    likedUserIds: ['admin'],
    daysAgo: 1,
    hoursAgo: 12,
    comments: [
      {
        authorName: '학원 총괄원장',
        authorRole: 'ADMIN',
        content: '학생들의 학구열을 응원합니다! 이번 주말부터 시험 종료일까지 자습실을 주말 아침 8시부터 상시 개방하도록 조치하겠습니다 ^^',
        minutesAgo: 360
      },
      {
        authorName: '박서연 (고2)',
        authorRole: 'STUDENT',
        content: '준호야 나 영어 스터디 참여할래! 내일 독서실에서 보자.',
        minutesAgo: 210
      }
    ]
  }
];

async function seed() {
  console.log('🚀 [TakeMe] 알림장 및 게시판 더미데이터 주입 작업 시작...');
  const app = await NestFactory.createApplicationContext(AppModule);

  const academyRepo: Repository<Academy> = app.get(getRepositoryToken(Academy));
  const postRepo: Repository<BoardPost> = app.get(getRepositoryToken(BoardPost));
  const commentRepo: Repository<BoardComment> = app.get(getRepositoryToken(BoardComment));
  const mediaRepo: Repository<MediaAsset> = app.get(getRepositoryToken(MediaAsset));

  const academies = await academyRepo.find();
  if (academies.length === 0) {
    console.warn('⚠️ 등록된 교육기관(Academy)이 없습니다. 기본 기관을 생성하거나 확인하세요.');
    await app.close();
    return;
  }

  console.log(`총 ${academies.length}개의 교육기관을 확인했습니다:`, academies.map(a => `${a.id}: ${a.name}`).join(', '));

  for (const academy of academies) {
    console.log(`\n🏫 기관 [ID: ${academy.id}, 이름: ${academy.name}] 더미데이터 처리 중...`);

    // 기존 더미데이터 중복 주입 방지 (해당 기관의 동일 제목 글이 있으면 건너뛰거나 업데이트)
    for (const dummy of DUMMY_POSTS) {
      const existing = await postRepo.findOne({
        where: {
          academy: { id: academy.id },
          title: dummy.title,
        },
        relations: { comments: true }
      });

      const postDate = new Date(Date.now() - (dummy.daysAgo * 86400000 + dummy.hoursAgo * 3600000));

      let post: BoardPost;
      if (existing) {
        console.log(`  - 기존 글 업데이트: [${dummy.postType}] ${dummy.title.substring(0, 25)}...`);
        post = existing;
        post.postType = dummy.postType;
        post.visibility = dummy.visibility;
        post.targetClass = dummy.targetClass || null as any;
        post.className = dummy.targetClass || null as any;
        post.content = dummy.content;
        post.imageUrl = dummy.imageUrl || null as any;
        post.images = dummy.images || [];
        post.authorName = dummy.authorName;
        post.authorRole = dummy.authorRole;
        post.likeCount = dummy.likeCount;
        post.likedUserIds = dummy.likedUserIds || [];
        await postRepo.save(post);
      } else {
        console.log(`  + 새 글 생성: [${dummy.postType}] ${dummy.title.substring(0, 25)}...`);
        post = postRepo.create({
          academy,
          postType: dummy.postType,
          visibility: dummy.visibility,
          targetClass: dummy.targetClass || null as any,
          className: dummy.targetClass || null as any,
          title: dummy.title,
          content: dummy.content,
          imageUrl: dummy.imageUrl || null as any,
          images: dummy.images || [],
          authorName: dummy.authorName,
          authorRole: dummy.authorRole,
          likeCount: dummy.likeCount,
          likedUserIds: dummy.likedUserIds || [],
          createdAt: postDate,
          updatedAt: postDate,
        });
        await postRepo.save(post);
      }

      // 댓글 주입
      if (dummy.comments && dummy.comments.length > 0) {
        for (const c of dummy.comments) {
          const commentDate = new Date(postDate.getTime() + c.minutesAgo * 60000);
          const existingComment = await commentRepo.findOne({
            where: {
              post: { id: post.id },
              content: c.content,
            }
          });
          if (!existingComment) {
            const comment = commentRepo.create({
              post,
              authorName: c.authorName,
              authorRole: c.authorRole,
              content: c.content,
              createdAt: commentDate,
            });
            await commentRepo.save(comment);
          }
        }
      }

      // 사진 보관함(MediaAsset) 동기화
      if (dummy.imageUrl) {
        const existingMedia = await mediaRepo.findOne({
          where: {
            academyId: academy.id,
            postId: post.id,
            storageKey: dummy.imageUrl,
          }
        });
        if (!existingMedia) {
          const media = mediaRepo.create({
            academyId: academy.id,
            uploaderId: 0,
            uploaderName: dummy.authorName,
            uploaderRole: dummy.authorRole,
            storageKey: dummy.imageUrl,
            filename: `${dummy.title.substring(0, 15).replace(/[^a-zA-Z0-9가-힣]/g, '_')}.jpg`,
            sourceType: dummy.postType === 'NOTICE' ? 'NOTICE' : 'BOARD',
            postId: post.id,
            className: dummy.targetClass || null as any,
            createdAt: postDate,
          });
          await mediaRepo.save(media);
        }
      }
    }
  }

  console.log('\n✅ [TakeMe] 알림장 및 게시판 더미데이터 주입 완료!');
  await app.close();
}

seed().catch(err => {
  console.error('❌ 시딩 중 오류 발생:', err);
  process.exit(1);
});
