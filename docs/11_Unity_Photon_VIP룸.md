# 11. Unity + Photon(PUN 2) 다중 접속 클럽 & VIP 룸 비밀 대화방 구조 (+ Unreal 블루프린트 대응)

> 스크립트: `unity/Scripts/*.cs` (Unity 2022.3 LTS 이상, PUN 2, Photon Voice 2 기준)
> 웹 버전과 같은 설계를 엔진으로 옮긴 것입니다. 붙여 넣은 뒤 컴파일 에러가 나면 PUN/Voice 버전 차이(아래 주의) 먼저 확인하세요.

## 1. 핵심 아이디어 — "룸을 옮기지 말고 Interest Group 을 바꾼다"
Photon 에서 VIP 룸마다 별도 Photon Room 으로 `JoinRoom` 하면 클럽 홀과의 연결이 끊기고 로딩이 생깁니다.
대신 **한 Photon Room(클럽 전체) 안에서 Interest Group** 을 사용합니다.

| 채널 | Interest Group | 설명 |
|---|---|---|
| 홀 전체(위치·애니메이션·전체 채팅) | 0 (기본) | 모두 항상 수신 |
| VIP 1/2/3 비밀 대화 | 10 / 11 / 12 | 룸 트리거에 들어간 로컬 플레이어만 구독 |
| 음성(Photon Voice) | Recorder.InterestGroup = 10+N | 룸 안 사람끼리만 들림 |

```
[문 근처 접근] → VipRoomDoor: 잠금 확인(Room CustomProperties "vip{N}") → 문 슬라이드 열림
[룸 트리거 진입] → VipRoomZone.OnTriggerEnter (내 PhotonView만)
      ├ PhotonNetwork.SetInterestGroups(disable:[], enable:[10+N])
      ├ VoiceGroup.Join(10+N)   (Recorder.InterestGroup + 수신 그룹 변경)
      └ AudioMixer "VIP" 스냅샷 0.25s 전환 (음악 LPF 520Hz, −10dB)
[룸 안 채팅] → SecretRoomChat.Send → RaiseEvent(InterestGroup = 10+N)  → 룸 구독자만 수신
[트리거 이탈] → 그룹 해제 · Hall 스냅샷 · 음성 그룹 0 복귀
```

## 2. 씬 구성
```
Club (Scene)
├─ Network
│   ├─ ClubLauncher            (접속·룸 입장·아바타 스폰, 룸 커스텀 프로퍼티 vip0~2 = 0 초기화)
│   ├─ PunVoiceClient + Recorder (Photon Voice 2)
│   └─ SecretRoomChat          (IOnEventCallback)
├─ Zones
│   ├─ Stage (Trigger) → AnimatorBaseLayer "StageDance"
│   ├─ DanceFloor (Trigger) → "Groove"
│   └─ VIP_0..2
│       ├─ Door (VipRoomDoor: leftPanel, rightPanel, blocker Collider, LED Renderer)
│       └─ Inside (BoxCollider isTrigger, VipRoomZone)
├─ Audio (AudioMixer: Music group + Snapshots Hall / Corridor / VIP)
└─ Resources/PlayerAvatar.prefab  (PhotonView, PhotonTransformView, PhotonAnimatorView, NetworkAvatar, CharacterController)
```

## 3. 스크립트 요약
| 파일 | 역할 |
|---|---|
| `ClubLauncher.cs` | ConnectUsingSettings → JoinOrCreateRoom(최대 인원, `vip0~2=0`) → PhotonNetwork.Instantiate |
| `NetworkAvatar.cs` | 로컬 입력 이동, 이모트 RPC(`RpcEmote`), 구역별 베이스 댄스, 원격 보간은 PhotonTransformView |
| `VipRoomDoor.cs` | 문 개폐 연출, **CAS 잠금**(`SetCustomProperties(new, expected)`), 주인 퇴장 시 마스터가 해제, LED 색 |
| `VipRoomZone.cs` | 룸 트리거: Interest Group·음성 그룹·오디오 스냅샷 전환, 잠긴 룸이면 밖으로 밀어냄 |
| `VoiceGroup.cs` | Photon Voice 버전 차이를 감싼 어댑터(Recorder.InterestGroup + 수신 그룹 변경) |
| `SecretRoomChat.cs` | RaiseEvent 기반 채팅(룸 안이면 그룹 전송), 필터·길이 제한, 로컬 에코 |

## 4. 잠금(부킹) 원자성
```csharp
// 기대값(expected)이 맞을 때만 서버가 반영 → 두 사람이 동시에 잡아도 한 명만 성공
room.SetCustomProperties(new Hashtable{{"vip1", myActor}}, new Hashtable{{"vip1", 0}});
```
- 결과는 `OnRoomPropertiesUpdate` 로 모두에게 전파 → 문 LED/잠금 갱신.
- 주인이 나가면 `OnPlayerLeftRoom` 에서 **MasterClient 만** `vip1=0` 으로 해제(중복 쓰기 방지).

## 5. ⚠ 보안·버전 주의
- Interest Group 구독은 **클라이언트가 결정**합니다. 변조 클라이언트가 그룹 11을 몰래 구독하면 엿들을 수 있습니다. 실서비스의 "비밀 대화"는 Photon Server Plugin / WebHook 으로 구독 권한을 검증하거나, 룸 대화만 별도 채팅 서버(Photon Chat 프라이빗 채널 + 서버 인증)로 분리하세요. (웹 버전은 서버가 `zone` 입장과 채팅 수신자를 직접 검증합니다.)
- `RoomOptions.MaxPlayers` 는 PUN 2.4x 이후 int, 이전 byte — 코드에서는 byte 값을 넣어 양쪽 호환.
- Photon Voice 2.53+ 는 `PunVoiceClient`, 이전 버전은 `PhotonVoiceNetwork` — `VoiceGroup.cs` 의 `#if` 를 프로젝트에 맞게 선택.

## 6. Unreal Engine 5 대응 (블루프린트 구조)
| 웹/Unity 개념 | UE5 |
|---|---|
| Photon Room | Dedicated Server 세션(EOS / Steam) |
| Interest Group | **Replication Graph** 의 공간 노드 + 룸별 `AlwaysRelevant` 노드, 또는 `IsNetRelevantFor` 오버라이드 |
| 음성 그룹 | EOS Voice / Vivox 채널 "club_vip_N" (Join/Leave) |
| 잠금 | 서버 권한 `BP_VipRoom.OwnerPlayerState` (Replicated) |

**BP_VipRoom (Actor)**
```
Components: DoorLeft, DoorRight (StaticMesh), DoorBlocker (Box), InsideVolume (Box), AudioVolume_VIP
Variables : RoomId(int), OwnerPS(PlayerState, Replicated, RepNotify), DoorAlpha(float)
Event BeginOverlap(InsideVolume)
  └ Cast To BP_ClubCharacter → Is Locally Controlled?
       ├ OwnerPS 유효 && OwnerPS != 내 PlayerState → Launch Character(밖으로) + Toast "예약된 룸"
       └ else → Server_EnterRoom(RoomId) ─► (서버) PlayerState.CurrentRoom = RoomId
                Client: VoiceChat Join Channel("vip_"+RoomId) · Set Sound Mix Modifier(SM_VIP, fade 0.25)
Event EndOverlap(InsideVolume) → Server_LeaveRoom · Voice Leave · Pop Sound Mix
Server_ClaimRoom(PS)  (Run on Server, Reliable)
  └ Branch OwnerPS == None → Set OwnerPS = PS → OnRep_OwnerPS(LED 빨강/초록)
Tick → DoorAlpha = FInterpTo(근처 허용 플레이어 있으면 1, 아니면 0) → SetRelativeLocation(Door)
```
**BP_ClubCharacter.IsNetRelevantFor**: 같은 `CurrentRoom` 이거나 둘 다 홀이면 relevant → 룸 안의 이모트·채팅 RPC는 룸 밖 클라이언트로 복제되지 않음.
