// SecretRoomChat.cs — 홀 채팅 / VIP 룸 비밀 채팅 (RaiseEvent + Interest Group)
// 룸 안(VipRoomZone.CurrentRoom >= 0)이면 해당 그룹 구독자에게만 전송 → 룸 밖 사람은 수신하지 않음
// ⚠ 그룹 구독은 클라이언트 결정이므로, 변조 클라이언트 대응은 서버 플러그인/웹훅 검증이 필요(문서 11 참고)
using System.Text.RegularExpressions;
using ExitGames.Client.Photon;
using Photon.Pun;
using Photon.Realtime;
using UnityEngine;

public class SecretRoomChat : MonoBehaviour, IOnEventCallback
{
    public const byte EvChat = 41;
    public event System.Action<string, string, bool> OnMessage;   // (보낸 사람, 내용, 룸 채팅 여부)

    static readonly Regex Phone = new Regex(@"01[016789][\s.\-]*\d{3,4}[\s.\-]*\d{4}");
    static readonly Regex Link = new Regex(@"https?://\S+|www\.\S+", RegexOptions.IgnoreCase);
    float windowStart; int sentInWindow;

    void OnEnable() => PhotonNetwork.AddCallbackTarget(this);
    void OnDisable() => PhotonNetwork.RemoveCallbackTarget(this);

    public static string Clean(string s)
    {
        s = (s ?? "").Trim(); if (s.Length > 120) s = s.Substring(0, 120);
        s = Phone.Replace(s, "[연락처 가림]");
        return Link.Replace(s, "[링크 가림]");
    }

    public void Send(string text)
    {
        text = Clean(text); if (text.Length == 0) return;
        if (Time.time - windowStart > 10f) { windowStart = Time.time; sentInWindow = 0; }
        if (++sentInWindow > 6) { Debug.Log("메시지를 너무 빠르게 보내고 있어요."); return; }   // 웹 서버와 같은 도배 제한

        int room = VipRoomZone.CurrentRoom;
        var opt = new RaiseEventOptions { Receivers = ReceiverGroup.Others };
        if (room >= 0) opt.InterestGroup = (byte)(10 + room);
        PhotonNetwork.RaiseEvent(EvChat, new object[] { PhotonNetwork.LocalPlayer.NickName, text, room }, opt, SendOptions.SendReliable);
        OnMessage?.Invoke(PhotonNetwork.LocalPlayer.NickName, text, room >= 0);      // 로컬 에코
    }

    public void OnEvent(EventData e)
    {
        if (e.Code != EvChat || !(e.CustomData is object[] d) || d.Length < 3) return;
        int room = d[2] is int r ? r : -1;
        if (room >= 0 && room != VipRoomZone.CurrentRoom) return;                      // 이중 확인
        OnMessage?.Invoke(d[0] as string, Clean(d[1] as string), room >= 0);
    }
}
