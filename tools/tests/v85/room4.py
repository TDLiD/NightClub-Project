from h import *
REC = """(()=>{ const V=NC.THREE.Vector3, Q=NC.THREE.Quaternion; window._rec=[]; const f=g=>{ const r=g.userData.real, B=r.Bn; const wq=r.root.getWorldQuaternion(new Q()); const fw=new V(0,0,1).applyQuaternion(wq); fw.y=0; fw.normalize(); const lf=new V(fw.z,0,-fw.x); const h=B.hips.getWorldPosition(new V()); const o={}; for(const s of ['L','R']){ const a=B['ul'+s].getWorldPosition(new V()), k=B['ll'+s].getWorldPosition(new V()), c=B['foot'+s].getWorldPosition(new V()); const ax=c.clone().sub(a).normalize(), kd=k.clone().sub(a); kd.addScaledVector(ax,-kd.dot(ax)); o[s]={lat:+c.clone().sub(h).dot(lf).toFixed(3), fwd:+c.clone().sub(h).dot(fw).toFixed(3), kx:kd.length()>.01?+Math.atan2(kd.dot(lf),kd.dot(fw)).toFixed(2):0, bend:+(180-a.clone().sub(k).angleTo(c.clone().sub(k))*180/Math.PI).toFixed(0)}; } return o; };
 NC.tickers.push(dt=>{ if(window._rec.length<600 && NC.Karaoke.BL.n) window._rec.push({t:+performance.now().toFixed(0), me:f(NC.player.group), her:f(window._k.g), fp:+(NC.player.group.userData.real.fpW||0).toFixed(2)}); }); return 1; })()"""
async def main():
    async with async_playwright() as p:
        b,pg,errs = await boot(p,240,160)
        R={}
        await pg.evaluate(f"(()=>{{ const n={GIRL}; n.aff=100; window._k=n; NC.Karaoke.enter({{comp:n}}); }})()")
        await pg.wait_for_function("NC.Karaoke.inRoom", polling=500, timeout=120000); await pg.wait_for_timeout(3000)
        R['fps']=await pg.evaluate("new Promise(r=>{let c=0;const t0=performance.now();const f=()=>{c++; if(performance.now()-t0<3000) requestAnimationFrame(f); else r(c/3);}; requestAnimationFrame(f);})")
        await pg.evaluate("NC.Karaoke.startBlues(window._k)")
        await pg.wait_for_timeout(3000)
        await pg.evaluate(REC)
        await pg.wait_for_timeout(15000)
        rec=await pg.evaluate("window._rec")
        R['n']=len(rec)
        cross=[];kflip=[]
        for e in rec:
            for w in ('me','her'):
                L,Rr=e[w]['L'],e[w]['R']
                if L['lat']<Rr['lat']+0.02: cross.append((e['t'],w,L['lat'],Rr['lat']))
                for s,q in (('L',L),('R',Rr)):
                    if abs(q['kx'])>0.6: kflip.append((e['t'],w+s,q['kx'],q['bend']))
        R['cross']=cross[:10]; R['ncross']=len(cross); R['kflip']=kflip[:10]; R['nk']=len(kflip)
        R['sample']=rec[::60]
        json.dump(rec,open('/tmp/v85s/rec.json','w'))
        R['errs']=errs; out(R); await b.close()
asyncio.run(main())
