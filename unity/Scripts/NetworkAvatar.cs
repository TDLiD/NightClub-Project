// NetworkAvatar.cs — 로컬 이동 · 이모트 RPC · 구역별 베이스 댄스
// 프리팹: CharacterController + Animator + PhotonView + PhotonTransformView(위치/회전) + PhotonAnimatorView(Speed, Base 파라미터)
// Animator 파라미터: float Speed, int Base(0 idle/walk · 1 groove · 2 stageDance · 3 sit), trigger Emote_{Name}
using Photon.Pun;
using UnityEngine;

[RequireComponent(typeof(CharacterController))]
public class NetworkAvatar : MonoBehaviourPun
{
    static readonly string[] Emotes = { "Wave", "Bow", "Cheers", "Drink", "Clap", "Cheer", "Shy", "Laugh" };

    [SerializeField] float speed = 4.5f;
    [SerializeField] Animator animator;
    CharacterController cc;
    Transform cam;
    float lastEmote;

    void Awake()
    {
        cc = GetComponent<CharacterController>();
        if (!animator) animator = GetComponentInChildren<Animator>();
        if (photonView.IsMine) { cam = Camera.main ? Camera.main.transform : null; gameObject.tag = "Player"; }
    }

    void Update()
    {
        if (!photonView.IsMine) return;
        // 카메라 기준 이동
        Vector3 input = new Vector3(Input.GetAxisRaw("Horizontal"), 0, Input.GetAxisRaw("Vertical"));
        Vector3 move = cam ? Quaternion.Euler(0, cam.eulerAngles.y, 0) * input : input;
        if (move.sqrMagnitude > 1) move.Normalize();
        cc.SimpleMove(move * speed);
        if (move.sqrMagnitude > .01f) transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(move), Time.deltaTime * 12f);
        animator.SetFloat("Speed", move.magnitude);

        // 이모트 단축키 (웹 버전과 동일 배치)
        if (Input.GetKeyDown(KeyCode.B)) Emote("Wave");
        if (Input.GetKeyDown(KeyCode.C)) Emote("Cheers");
        if (Input.GetKeyDown(KeyCode.V)) Emote("Drink");
        if (Input.GetKeyDown(KeyCode.N)) Emote("Clap");
        if (Input.GetKeyDown(KeyCode.M)) Emote("Bow");
    }

    public void Emote(string name)
    {
        if (Time.time - lastEmote < .8f || System.Array.IndexOf(Emotes, name) < 0) return;   // 연타 방지 · 화이트리스트
        lastEmote = Time.time;
        photonView.RPC(nameof(RpcEmote), RpcTarget.All, name);
    }

    [PunRPC]
    void RpcEmote(string name, PhotonMessageInfo info)
    {
        if (info.Sender != photonView.Owner) return;                                    // 남의 아바타 조작 방지
        if (System.Array.IndexOf(Emotes, name) < 0) return;
        animator.SetTrigger("Emote_" + name);
    }

    /// 구역 트리거(Stage/DanceFloor)에서 호출: 0 idle · 1 groove · 2 stageDance · 3 sit
    public void SetBase(int value) { if (photonView.IsMine) animator.SetInteger("Base", value); }
}
