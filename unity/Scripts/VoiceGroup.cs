// VoiceGroup.cs — Photon Voice 2 Interest Group 어댑터
// 말하기: Recorder.InterestGroup = g  /  듣기: 음성 클라이언트의 수신 그룹을 g 로 교체
// Photon Voice 2.53 이상은 PunVoiceClient, 이전 버전은 PhotonVoiceNetwork. 프로젝트 Scripting Define 에 PHOTON_VOICE_LEGACY 를 넣으면 구버전 경로 사용.
using Photon.Voice.Unity;
using UnityEngine;
#if PHOTON_VOICE_LEGACY
using VoiceClientHost = Photon.Voice.PUN.PhotonVoiceNetwork;
#else
using VoiceClientHost = Photon.Voice.PUN.PunVoiceClient;
#endif

public static class VoiceGroup
{
    static byte current;

    public static void Switch(byte group)
    {
        var host = VoiceClientHost.Instance;
        if (host == null) { Debug.LogWarning("[Voice] 음성 클라이언트가 없습니다"); return; }
        var rec = host.PrimaryRecorder;
        if (rec != null) rec.InterestGroup = group;                                   // 내 목소리는 이 그룹으로만
        if (host.Client != null && host.Client.InRoom)
            host.Client.OpChangeGroups(current != 0 ? new[] { current } : null,        // 이전 그룹 수신 해제
                                       group != 0 ? new[] { group } : null);           // 새 그룹 수신
        current = group;
    }
}
