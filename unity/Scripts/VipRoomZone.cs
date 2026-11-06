// VipRoomZone.cs — VIP 룸 내부 트리거: 들어가면 '비밀 대화방' 생성(Interest Group 구독 + 음성 그룹 + 사운드 댐핑)
using Photon.Pun;
using UnityEngine;
using UnityEngine.Audio;

[RequireComponent(typeof(BoxCollider))]
public class VipRoomZone : MonoBehaviour
{
    public int roomId;
    [SerializeField] VipRoomDoor door;
    [SerializeField] AudioMixerSnapshot hallSnapshot, vipSnapshot;   // VIP: Music LPF 520Hz, −10dB / Hall: 기본
    [SerializeField] float fade = .25f;
    [SerializeField] Transform kickOutPoint;                        // 잠긴 룸에 들어오면 이동시킬 위치(통로)

    public static int CurrentRoom { get; private set; } = -1;
    public static event System.Action<int> RoomChanged;
    public byte Group => (byte)(10 + roomId);

    void Reset() { GetComponent<BoxCollider>().isTrigger = true; }

    static bool IsLocal(Collider c, out Transform t)
    {
        var pv = c.GetComponentInParent<PhotonView>(); t = pv ? pv.transform : null;
        return pv && pv.IsMine && pv.GetComponent<NetworkAvatar>();
    }

    void OnTriggerEnter(Collider c)
    {
        if (!IsLocal(c, out var t)) return;
        if (door && door.LockedForMe)
        {
            if (kickOutPoint) { var cc = t.GetComponent<CharacterController>(); if (cc) cc.enabled = false; t.position = kickOutPoint.position; if (cc) cc.enabled = true; }
            Debug.Log($"VIP {roomId + 1} 룸은 예약된 방이에요.");
            return;
        }
        CurrentRoom = roomId;
        PhotonNetwork.SetInterestGroups(new byte[0], new[] { Group });   // 룸 그룹 구독 (그룹 0 은 항상 수신)
        VoiceGroup.Switch(Group);
        if (vipSnapshot) vipSnapshot.TransitionTo(fade);
        RoomChanged?.Invoke(roomId);
    }

    void OnTriggerExit(Collider c)
    {
        if (!IsLocal(c, out _) || CurrentRoom != roomId) return;
        CurrentRoom = -1;
        PhotonNetwork.SetInterestGroups(new[] { Group }, new byte[0]);
        VoiceGroup.Switch(0);
        if (hallSnapshot) hallSnapshot.TransitionTo(fade);
        RoomChanged?.Invoke(-1);
    }
}
