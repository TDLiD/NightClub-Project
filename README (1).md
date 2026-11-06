# 🪩 추억의 나이트 · 메타버스

## 파일 구성
| 단계 | 파일 | 설명 |
|---|---|---|
| 1 데모 | `public/index.html` | 3D 나이트 홀 + NPC 부킹/합석. (three.js는 CDN) |
| 데이터 | `public/data/npcs.json`, `public/data/dialogs.json` | 손님(NPC)·대화 문구/점수. 수정 후 새로고침하면 반영 |
| 2 멀티플레이 | `server.js`, `public/multi.js` | WebSocket 실시간 접속, 테이블 초대(부킹), 전체/테이블 채팅 |
| 3 운영 | `server-ops.js`, `public/ops.js` | 성인 인증, 신고·차단, 입장 제한, 자동 제재, 관리자 API |

`index.html`은 `/api/health` 가 응답하면 자동으로 `ops.js → multi.js`를 불러와 온라인 모드(배지 ONLINE)로 바뀌고,
서버 응답이 없으면 데모 모드(배지 DEMO)입니다. `?mode=demo` 로 강제 데모도 가능합니다.

> 데이터를 JSON으로 분리했기 때문에 `index.html`을 파일로 더블클릭(`file://`)하면 JSON을 읽지 못합니다. `npm start` 후 `http://localhost:3000/?mode=demo` 로 여세요(또는 `npx serve public`).

## 데이터 추가/수정 (코드 수정 불필요)
- **손님 추가**: `public/data/npcs.json` 의 `npcs` 배열에 항목 추가 → 새로고침. `trait`는 `shy/outgoing/playful/cool`, 색은 `"#RRGGBB"`, `"enabled": false`면 숨김. 마지막 항목 뒤 쉼표 금지.
- **대화 수정**: `public/data/dialogs.json` — `open`/`topics`(선택지·성격별 점수), `reaction1`/`reaction2`(성격별 반응), `chats`(합석 후 대화), `booking`(성공 기준점·재도전 대기시간·시작 호감도).

## 실행
```bash
npm install
npm start            # http://localhost:3000
```
| 환경변수 | 기본값 | 설명 |
|---|---|---|
| `PORT` | 3000 | |
| `MAX_PLAYERS` | 50 | 동시 접속 상한(초과 시 만석 안내) |
| `MAX_PER_IP` | 3 | 같은 IP 동시 접속 상한 |
| `TOKEN_SECRET` | 랜덤 | 인증 토큰 서명 키. **운영 시 반드시 고정값 지정** |
| `ADMIN_TOKEN` | 없음 | 설정해야 `/admin/*` 활성화 (`x-admin-token` 헤더) |
| `VERIFY_MODE` | mock | `mock`=생년월일 자기신고(개발용), `pass`=본인인증 기관 연동(구현 필요) |
| `REPORT_BAN_COUNT` / `AUTO_BAN_MIN` | 3 / 30 | 24시간 내 서로 다른 신고자 N명이면 자동 임시정지(분) |
| `TRUST_PROXY` | 없음 | 리버스 프록시(nginx 등) 뒤에서 `true` |

## 운영 기능 요약
- **성인 인증**: 서버가 서명 토큰(성인 여부+해시 uid, 12시간)을 발급, WebSocket 입장 시 필수. 생년월일 원문은 저장하지 않음. 성인 판정은 연 나이(올해-출생연도 ≥ 19).
- **입장 제한**: 만석, IP당 동시 접속, 동일 계정 중복 접속, 닉네임 규칙/중복, 정지 계정·IP.
- **신고**: 사유 선택 + 대상의 최근 채팅 10건 증거 저장 → `GET /admin/reports`. 3명 이상 신고 시 자동 임시정지.
- **차단**: 서로의 아바타·위치·채팅·초대가 서버에서 차단(양방향). 계정(uid) 단위로 저장.
- **채팅 보호**: 도배 제한(10초 6건), 욕설 마스킹, 전화번호·링크 가림, 초대 1분 6건 제한.
- **관리자**: `POST /admin/ban {uid,minutes,reason}`, `/admin/unban`, `/admin/ban-ip`, `/admin/report-status`.

## ⚠ 실서비스 전 반드시
1. **본인인증 교체**: `mock`은 법적 성인 인증이 아닙니다. 휴대폰 본인확인/PASS/아이핀 연동(`providers.pass`)으로 바꾸세요. 연동 후에는 CI 기반 해시로 uid가 고정되어 신고·차단·정지가 기기 변경 후에도 유지됩니다.
2. 술·만남을 콘셉트로 한 서비스는 청소년보호법·정보통신망법·개인정보보호법 검토가 필요합니다(이용약관, 개인정보처리방침, 신고 처리 절차, 로그 보관).
3. HTTPS/WSS 적용, `TOKEN_SECRET`·`ADMIN_TOKEN` 설정, 데이터(`data/ops.json`) 백업. 대규모 운영이면 JSON 파일 대신 DB로 교체.
4. 온라인 모드에서는 NPC가 꺼지고 실제 접속자끼리 부킹합니다. 사진 대신 아바타만 사용해 개인정보 노출을 줄였습니다.
