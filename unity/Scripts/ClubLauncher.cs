// ClubLauncher.cs — Photon 접속 · 클럽 룸 입장 · 아바타 스폰
// 요구: PUN 2 (PhotonServerSettings 에 AppId 설정), Resources/PlayerAvatar.prefab (PhotonView 포함)
using ExitGames.Client.Photon;
using Photon.Pun;
using Photon.Realtime;
using UnityEngine;
using Hashtable = ExitGames.Client.Photon.Hashtable;

public class ClubLauncher : MonoBehaviourPunCallbacks
{
    public const int VipRoomCount = 3;

    [SerializeField] string roomName = "nostalgia-night-01";
    [SerializeField] byte maxPlayers = 20;
    [SerializeField] string avatarPrefab = "PlayerAvatar";
    [SerializeField] Transform[] spawnPoints;

    void Start()
    {
        PhotonNetwork.SendRate = 20;              // 초당 전송
        PhotonNetwork.SerializationRate = 10;     // OnPhotonSerializeView 10Hz (웹 버전과 동일)
        PhotonNetwork.NickName = PlayerPrefs.GetString("nick", "Guest" + Random.Range(1000, 9999));
        PhotonNetwork.ConnectUsingSettings();
    }

    public override void OnConnectedToMaster()
    {
        var props = new Hashtable();
        for (int i = 0; i < VipRoomCount; i++) props["vip" + i] = 0;   // 0 = 비어 있음, 그 외 = 주인 ActorNumber
        var options = new RoomOptions
        {
            MaxPlayers = maxPlayers,
            CleanupCacheOnLeave = true,
            PublishUserId = true,
            CustomRoomProperties = props,
        };
        PhotonNetwork.JoinOrCreateRoom(roomName, options, TypedLobby.Default);
    }

    public override void OnJoinedRoom()
    {
        Transform sp = spawnPoints != null && spawnPoints.Length > 0 ? spawnPoints[Random.Range(0, spawnPoints.Length)] : transform;
        PhotonNetwork.Instantiate(avatarPrefab, sp.position, sp.rotation);
    }

    public override void OnJoinRoomFailed(short returnCode, string message) => Debug.LogWarning($"[Club] 입장 실패 {returnCode}: {message}");
    public override void OnDisconnected(DisconnectCause cause) => Debug.LogWarning($"[Club] 연결 끊김: {cause}");
}
