# Phomate Frontend v2

AI 기반 사진 관리 웹 서비스. 채팅으로 사진 검색·자동 폴더 생성·AI 편집을 제공한다.

## 기술 스택

- React 19 + TypeScript 5.9 + Vite 7
- 외부 UI 라이브러리 없음 (lucide-react 아이콘만 사용)
- CSS 파일 직접 작성 (CSS Modules 미사용)
- 인증: Google OAuth 2.0 + PKCE + JWT

## 개발 명령어

```bash
npm run dev      # 개발 서버
npm run build    # tsc + vite build
npm run preview  # 빌드 결과 미리보기
```

환경변수: `.env` 파일에 `VITE_API_BASE_URL` 설정 필요.

---

## 프로젝트 구조

```
src/
├── pages/
│   └── Home.tsx          # 단일 상태 컨테이너. 모든 핵심 상태 여기서 관리
├── components/
│   ├── Chatbot.tsx        # AI 채팅 패널 (검색 탭 + 편집 탭)
│   ├── Sidebar.tsx        # 좌측 네비게이션
│   ├── Sharedfoldermodal.tsx
│   ├── Foldermodal.tsx
│   ├── Photocard.tsx
│   ├── Photopreview.tsx
│   ├── Folderview.tsx
│   ├── AddPhotosModal.tsx
│   ├── Uploadmodal.tsx
│   ├── Uploadstatuspanel.tsx
│   ├── Notificationpanel.tsx
│   ├── Trashview.tsx
│   ├── Actionmodal.tsx
│   ├── Invitemodal.tsx
│   ├── Navbar.tsx
│   └── StorageUsageModal.tsx
├── api/
│   ├── auth.ts            # Google OAuth, JWT 관리, authFetch 래퍼
│   ├── chat.ts            # 스트리밍 채팅, 폴더 미리보기/확정
│   ├── photo.ts           # 사진 CRUD
│   ├── upload.ts          # S3 Presigned URL 업로드
│   ├── edit.ts            # 편집 세션 (429 지수백오프 재시도 포함)
│   └── member.ts          # 사용자 프로필
├── styles/                # 컴포넌트별 CSS 파일
├── types.ts               # 공통 타입 (Photo 등)
└── main.tsx
```

---

## 핵심 아키텍처

### 상태 관리
`Home.tsx`가 모든 상태를 보유하는 단일 컨테이너다. 자식 컴포넌트는 콜백 props로 Home에 보고한다. 전역 상태 라이브러리(Redux, Zustand 등)는 없다.

### 뷰 전환
```typescript
type ViewType = 'home' | 'folder_list' | 'folder_detail' | 'shared_list' | 'shared_detail' | 'trash';
```
`handleNavigate()`로 뷰를 전환한다.

### 인증 흐름
1. `beginGoogleLogin()` → Google 리다이렉트 (PKCE)
2. `completeGoogleLoginIfNeeded()` → URL의 `code`로 토큰 교환
3. `authFetch()` → 모든 API 요청 래핑. 토큰 만료 시 자동 갱신, 401 시 재시도

### 로컬 스토리지 키
| 키 | 용도 |
|---|---|
| `phomate.accessToken` | JWT 액세스 토큰 |
| `phomate.refreshToken` | 갱신 토큰 |
| `phomate.oauth.codeVerifier` | PKCE 검증자 |
| `photoSizeBytes` | 사진 ID별 바이트 크기 캐시 |
| `folderData` | 폴더 목록 + 사진 ID 매핑 |
| `phomate.sharedFolder.members.{folderId}` | 공유 폴더 멤버 목록 캐시 |

### Chat 스트리밍
`chat.ts`는 Server-Sent Events를 직접 파싱한다. HTTP/2 프로토콜 오류 발생 시 Accept 헤더를 `text/event-stream` → `*/*`로 바꿔 재시도한다.

### 업로드 경로
1. **기본**: `createPhoto()` — 단순 FormData POST
2. **폴백**: `initPhotoUpload()` → `putFileToPresignedUrl()` → `commitPhotoUpload()` — S3 Presigned URL, progress 지원, 최대 3개 병렬

---

## 알려진 문제 및 수정 필요 사항

### 버그

**[B-1] `Sharedfoldermodal.tsx:8` — 오타 (수정 완료)**
~~`import.meta.gVITE_API_BASE_URL`~~ → `import.meta.env.VITE_API_BASE_URL`으로 수정됨.

**[B-2] `Sharedfoldermodal.tsx` — `resolveBestSharedFolderIdForInvite` 미사용**
동명 공유 폴더가 여러 개일 때 ADMIN 권한 있는 것을 골라주는 함수인데, 실제로 호출하는 곳이 없다.
`handleInviteMember`에서 `resolveOrCreateSharedFolderId` 대신 이 함수를 써야 한다.

**[B-3] `chat.ts:477` — `isHttp2ProtocolError` 오탐 가능**
`TypeError: Failed to fetch`를 HTTP/2 오류로 간주하는데, 오프라인·DNS 실패 등 다른 네트워크 오류도 여기 해당한다. 이 경우 불필요한 재시도가 발생한다.

### 코드 품질

**[Q-1] `Sharedfoldermodal.tsx` — 디버그 `console.log` 다수**
`[GetInvitation]`, `[Invite]`, `[RespondInvitation]` 접두사 로그들이 프로덕션 코드에 남아 있다.
제거 대상: 라인 187, 189, 204–206, 231–232, 259, 267, 285–288.

**[Q-2] `Sharedfoldermodal.tsx:722–769` — 인라인 스타일**
초대 알림 섹션만 `style={{ }}` 인라인 스타일을 사용한다. 나머지 컴포넌트는 모두 CSS 클래스를 쓴다.
`Sharedfoldermodal.css`에 클래스로 이동해야 일관성이 생긴다.

**[Q-3] `chat.ts:18` — `extractItemsFromUnknown` 무검증 캐스팅**
`value as SearchResultItem[]`로 배열 원소를 검증 없이 캐스팅한다.
서버 응답 형태가 달라지면 런타임에서 조용히 잘못된 데이터를 사용하게 된다.

**[Q-4] `chat.ts:504` — 오해를 부르는 변수명**
`emittedAnyDelta`인데 검색 결과(results) 수신 시에도 `true`로 설정된다.
`receivedAnyData`가 더 정확하다.

**[Q-5] `Home.tsx` — God Component**
500줄 이상의 상태·핸들러가 단일 컴포넌트에 집중되어 있다.
기능 단위로 Custom Hook으로 분리하는 것이 장기적으로 유지보수에 유리하다.
예: `useUpload`, `useSharedFolder`, `useChatSearch` 등.

### 디자인 개선

**[D-1] 색상 시스템 — flat 단색**
모든 강조 요소가 `#003366` 단색이다. 깊이감과 위계가 없다.
브랜드 컬러를 3단계로 분리 권장: `#001a3d`(브랜드) / `#1e3a6e`(인터랙션) / `#e6efff`(light accent).

**[D-2] 사이드바 — 대비 부족**
흰 배경 사이드바는 메인 콘텐츠 영역과 구분이 약하다.
다크 사이드바(`#0f172a`) + 밝은 콘텐츠 영역 대비 구조로 변경 권장.

**[D-3] 사진 카드 — 정보 영역이 사진을 압박**
1:1 정사각형 + 하단 텍스트 영역 구조가 사진 표시 면적을 줄인다.
텍스트 영역 제거 후 hover 오버레이로 메타 정보를 표시하는 방식 권장.

**[D-4] hover 인터랙션 — `translateY(-6px)` 구식**
카드가 떠오르는 효과는 2018년 스타일이다.
이미지 위에 반투명 그라디언트 오버레이가 fade-in되는 방식이 현대적이다.

**[D-5] 챗봇 패널 — AI 느낌 없음**
불투명 흰 패널은 AI 기능의 특별함을 전달하지 못한다.
`backdrop-filter: blur` 글래스모피즘 적용 권장.

---

## 디자인 토큰 (현재)

| 토큰 | 값 |
|---|---|
| 브랜드 | `#003366` |
| 배경 | `#f4f7fa` |
| 서피스 | `#ffffff` |
| 보더 | `#e5e7eb` |
| 텍스트 기본 | `#1e293b` |
| 텍스트 흐림 | `#9ca3af` |
| 위험 | `#ef4444` |
| 다크레드 | `#800020` |
| 틸 (채팅 폴더) | `#0f766e` |

---

## 주요 패턴

### API 헬퍼 함수
`chat.ts`와 `Sharedfoldermodal.tsx` 양쪽에 각자 `asNumber`, `asText`, `buildHttpError`가 중복 정의되어 있다. 공통 유틸 파일(`src/utils/api.ts`)로 추출 필요.

### 폼 응답 처리
서버가 다양한 필드명으로 응답할 수 있어 모든 API 함수가 여러 후보 키를 순서대로 확인한다.
```typescript
const sessionId =
    asNumber(data.chatSessionId) ||
    asNumber(data.chat_session_id) ||
    asNumber(data.sessionId) || ...
```

### 스트림 소비 패턴
`\r\n\r\n`으로 이벤트 블록을 분리한 뒤 `event:` / `data:` 라인을 파싱한다.
`[DONE]` 또는 `event: done`으로 종료를 감지한다.
