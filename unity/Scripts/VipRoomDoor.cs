// VipRoomDoor.cs — VIP 룸 슬라이딩 도어 + 원자적 잠금(부킹)
// 잠금 상태 = Room CustomProperties "vip{roomId}" (0 = 비어 있음, 그 외 = 주인 ActorNumber)
using ExitGames.Client.Photon;
using Photon.Pun;
using Photon.Realtime;
using UnityEngine;
using Hashtable = ExitGames.Client.Photon.Hashtable;

public class VipRoomDoor : MonoBehaviourPunCallbacks
{
    public int roomId;
    [SerializeField] Transform leftPanel, rightPanel;
    [SerializeField] float slide = 1.15f;            // 한쪽 패널 이동 거리(m)
    [SerializeField] float openRadius = 2.2f;
    [SerializeField] Collider blocker;               // 닫혔을 때 통행 차단
    [SerializeField] Renderer led;
    [SerializeField] Color freeColor = new Color(.43f, 1f, .54f), busyColor = new Color(1f, .82f, .24f), lockedColor = new Color(1f, .2f, .33f);

    Vector3 l0, r0; float open;
    string Key => "vip" + roomId;

    void Start() { l0 = leftPanel.localPosition; r0 = rightPanel.localPosition; }

    public int Owner
    {
        get
        {
            var room = PhotonNetwork.CurrentRoom;
            return room != null && room.CustomProperties.TryGetValue(Key, out var v) && v is int i ? i : 0;
        }
    }
    public bool LockedForMe => PhotonNetwork.LocalPlayer != null && Owner != 0 && Owner != PhotonNetwork.LocalPlayer.ActorNumber;

    /// 웨이터 부킹 성공 시 호출. 동시에 여러 명이 시도해도 기대값(CAS) 덕분에 한 명만 성공.
    public void TryClaim()
    {
        int cur = Owner, me = PhotonNetwork.LocalPlayer.ActorNumber;
        if (cur != 0 && cur != me) return;
        PhotonNetwork.CurrentRoom.SetCustomProperties(new Hashtable { { Key, me } }, new Hashtable { { Key, cur } });
    }
    public void Release()
    {
        int me = PhotonNetwork.LocalPlayer.ActorNumber;
        if (Owner == me) PhotonNetwork.CurrentRoom.SetCustomProperties(new Hashtable { { Key, 0 } }, new Hashtable { { Key, me } });
    }

    public override void OnPlayerLeftRoom(Player other)
    {
        // 주인이 나가면 마스터 클라이언트만 해제(중복 쓰기 방지)
        if (PhotonNetwork.IsMasterClient && Owner == other.ActorNumber)
            PhotonNetwork.CurrentRoom.SetCustomProperties(new Hashtable { { Key, 0 } }, new Hashtable { { Key, other.ActorNumber } });
    }

    void Update()
    {
        bool want = false;
        foreach (var pv in FindObjectsOfType<PhotonView>())   // 규모가 커지면 트리거 기반 카운트로 교체
        {
            if (!pv.GetComponent<NetworkAvatar>()) continue;
            if ((pv.transform.position - transform.position).sqrMagnitude > openRadius * openRadius) continue;
            if (pv.IsMine && LockedForMe) continue;          // 잠긴 룸은 내 접근으로는 열리지 않음
            want = true; break;
        }
        open = Mathf.MoveTowards(open, want ? 1 : 0, Time.deltaTime * (want ? 2.2f : 1.6f));
        leftPanel.localPosition = l0 + Vector3.left * slide * open;
        rightPanel.localPosition = r0 + Vector3.right * slide * open;
        if (blocker) blocker.enabled = open < .75f;
        if (led) led.material.SetColor("_EmissionColor", (LockedForMe ? lockedColor : Owner != 0 ? busyColor : freeColor) * 2f);
    }
}
