import numpy as np, subprocess, sys
def pcm(path, sr=44100):
    raw = subprocess.run(['ffmpeg','-v','quiet','-i',path,'-t','90','-ac','1','-ar',str(sr),'-f','f32le','-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32), sr
def analyser_bytes(frame, prev_db=None):
    N=1024; w=np.blackman(N); X=np.fft.rfft(frame*w)[:N//2]; mag=np.abs(X)/N
    db=20*np.log10(np.maximum(mag,1e-12)); b=np.clip((db-(-100))/((-30)-(-100))*255,0,255).astype(np.uint8); return b
def fold(v):
    while v<.4: v*=2
    while v>.8: v/=2
    return v
def ref(path):
    x,sr=pcm(path); hop=int(sr*0.01); env=[]; prev=None
    for k in range(0,len(x)-1024,hop):
        fq=analyser_bytes(x[k:k+1024])/255.0; seg=fq[1:6]
        env.append(0 if prev is None else np.maximum(seg-prev,0).sum()); prev=seg
    e=np.array(env); e=e-e.mean(); ac=np.correlate(e,e,'full')[len(e)-1:]; lags=np.arange(len(ac))*0.01
    m=(lags>=60/150)&(lags<=60/75); best=lags[m][np.argmax(ac[m])]; return round(60/best,1)
def run(path):
    x,sr=pcm(path); hop=int(sr*0.02); hz=sr/1024; lo=max(1,int(40/hz)); hi=max(lo+2,int(np.ceil(180/hz)))
    prev=np.zeros(512); T=dict(avg=0,last=0,iois=[],fAvg=0,fVar=0); bpm=128.0; t0=0.0; hist=[]
    for k in range(0,len(x)-1024,hop):
        now=k/sr; fq=analyser_bytes(x[k:k+1024])/255.0
        seg=fq[lo:hi+1]; e=seg.mean(); d=seg-prev[lo:hi+1]; flux=d[d>0].sum()/(hi-lo+1); prev[lo:hi+1]=seg
        dF=flux-T['fAvg']; T['fAvg']+=dF*.05; T['fVar']=T['fVar']*.95+dF*dF*.05; thr=T['fAvg']+1.6*np.sqrt(T['fVar'])
        if flux>thr and flux>.015 and now-T['last']>.27:
            ioi=now-T['last']; T['last']=now
            if .27<ioi<1.6: T['iois'].append(ioi); T['iois']=T['iois'][-40:]
            if len(T['iois'])>=8:
                H={}
                for v in T['iois']:
                    while v<.4: v*=2
                    while v>.8: v/=2
                    kk=round(v*50); H[kk]=H.get(kk,0)+1; H[kk-1]=H.get(kk-1,0)+.5; H[kk+1]=H.get(kk+1,0)+.5
                bk=max(H,key=H.get); F=[v for v in [fold(z) for z in T['iois']] if abs(v*50-bk)<=1.01]; b=max(75,min(150,60/(sum(F)/len(F)))) if F else 120
                if abs(b-bpm)>.5: pos=max(0,now-t0)*bpm/60; bpm+=(b-bpm)*.25; t0=now-pos*60/bpm
            L=60/bpm; ph=((now-t0)/L)%1; err=ph-1 if ph>.5 else ph; t0+=err*L*.15
        if k%(hop*250)==0: hist.append(round(bpm,1))
    return hist
for f in sys.argv[1:]:
    h=run(f); print(f.split('/')[-1], 'tracker:', h, '| reference(autocorr):', ref(f))
