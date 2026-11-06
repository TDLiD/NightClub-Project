# 10. 웹 메타버스 기술 구조 (Three.js + WebSocket + WebRTC 근거리 음성/채팅)

> 이 저장소 자체가 요청하신 "웹 브라우저 3D 클럽 + 근처에 가면 음성/채팅이 켜지는" 기초 코드입니다.

## 1. 스택
| 계층 | 기술 | 파일 |
|---|---|---|
| 렌더링 | Three.js r128 (CDN, 실패 시 `/vendor` 로컬 사본) | `public/js/core.js`, `world.js` |
| 아바타/모션 | 절차적 리그 + 캔버스 얼굴 텍스처 | `avatar.js`, `motion.js` |
| 게임 로직 | 바닐라 JS 모듈(전역 `NC` 네임스페이스, 로드 순서 고정) | `npc.js`, `dialog.js`, `waiter.js`, `minigames.js`, `main.js` |
| 오디오 | Web Audio (신스·HRTF·필터·컨볼버) | `audio.js` |
| 실시간 | Node.js + Express + `ws` (WebSocket, 10Hz 위치 브로드캐스트) | `server.js` |
| 음성 | WebRTC P2P(오디오), 시그널링은 WS 릴레이, STUN/TURN = `ICE_SERVERS` | `voice.js` |
| AI 대화 | Anthropic / OpenAI 호환 API (서버 프록시) | `server-llm.js` |
| 운영 | 성인 인증 토큰(HMAC), 신고/차단/제재, 채팅 필터, 관리자 API | `server-ops.js`, `ops.js` |

## 2. 근거리(Proximity) 규칙 — 클라이언트·서버 이중 판정
| 채널 | 조건 | 서버 검증 |
|---|---|---|
| 채팅 `near`(기본) | 같은 구역(홀/같은 룸) & 거리 ≤ 8m | `canHear()` 로 수신자 필터 |
| 채팅 `room` | 같은 VIP 룸 | 룸 밖이면 near 로 강등 |
| 채팅 `all` | 전체 | VIP 룸 안에선 room 으로 강제(비밀 유지) |
| 채팅 `table` | 같은 테이블 | 서버 좌석표 |
| 음성 WebRTC | 둘 다 🎙 ON & (거리 ≤ 8m 또는 같은 룸) | 시그널링 릴레이 시 거리/룸 검사, 차단 관계 제외 |

## 3. 시그널링 흐름 (Perfect Negotiation)
```
A(🎙ON)                         서버(ws)                         B(🎙ON)
 │ 거리 ≤ 8m 감지 → RTCPeerConnection 생성, addTrack
 │ onnegotiationneeded → setLocalDescription()
 │ ── {type:'rtc', to:B, data:{sdp:offer}} ──►  visible? 근거리? 레이트리밋 ──► {type:'rtc', from:A, data}
 │                                                                   │ polite = (id 큰 쪽)
 │                                                                   │ 충돌이면 impolite 쪽 offer 무시
 │ ◄── {sdp:answer} ─────────────────────────────────────────────── │ setRemote → setLocal(answer)
 │ ◄──────────────── ICE 후보 교환 ───────────────────────────────► │
 │ ontrack → <audio muted> + MediaStreamSource → Panner(HRTF, B 위치) → voiceBus
 │ 거리 > 11m 또는 룸 경계 넘음 → pc.close() + {bye}
```

## 4. 메시지 프로토콜(요약)
| C→S | 설명 | S→C | 설명 |
|---|---|---|---|
| hello{token,name,color,look} | 입장 심사 | welcome{id,players,tables,rooms,…} | 입장 성공 |
| move{x,z,r} | 위치(이동 시 ≤10Hz) | state{s:[[id,x,z,r]…]} | 10Hz 스냅샷 |
| chat{text,scope} | 채팅 | chat{name,text,scope} | |
| emote{name} | 이모트 | emote{id,name} | |
| zone{room} | VIP 입·퇴장 | rooms{owners} | 룸 잠금 현황 |
| roomClaim{room} / roomRelease | 웨이터 부킹 잠금 | roomClaim{room,ok} | |
| rtc{to,data} | 시그널링 | rtc{from,data} | |
| sit/stand/invite/inviteReply/report/block/unblock | 기존 기능 | tables/invite/notice/blocks/kicked | |

## 5. 배포 체크리스트
- [ ] **HTTPS 필수**(마이크 권한) — Nginx/Caddy 리버스 프록시 + `TRUST_PROXY=true`, WebSocket 업그레이드 헤더 전달
- [ ] **TURN 서버**(coturn 등): 회사망·모바일 대칭 NAT에서 STUN만으론 연결 실패. 예) `ICE_SERVERS='[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:turn.example.com:3478","username":"u","credential":"p"}]'`
- [ ] 동시 접속이 많아지면 P2P 메시 → **SFU(mediasoup/LiveKit)** 로 전환(룸 1개 = SFU 룸 1개로 매핑하면 VIP 비밀방 구조 그대로 유지)
- [ ] `TOKEN_SECRET`, `ADMIN_TOKEN` 고정값 설정, `VERIFY_MODE=pass`(본인인증 연동) — mock 은 데모 전용
- [ ] LLM 키는 서버 환경변수로만, 클라이언트에 노출 금지
- [ ] 음성 녹음/저장은 하지 않음(현재 구현도 저장 없음). 신고 증거는 텍스트 채팅만

## 6. 최소 실행
```bash
npm install
npm start                    # http://localhost:3000  (로컬호스트는 HTTPS 없이도 마이크 허용)
# 솔로 데모(서버 기능 없이):  http://localhost:3000/?mode=demo
```
