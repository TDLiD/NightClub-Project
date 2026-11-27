from h import *
TAG = sys.argv[1] if len(sys.argv)>1 else 'base'
FACECAM = """(g,d,side)=>{ const r=g.userData.real; if(!r||r.pending) return null; const V=NC.THREE.Vector3; const h=r.Bn.head.getWorldPosition(new V()); const q=r.root.getWorldQuaternion(new NC.THREE.Quaternion()); const f=new V(0,0,1).applyQuaternion(q); f.y=0; f.normalize(); const s=new V(f.z,0,-f.x); const c=h.clone().addScaledVector(f,d).addScaledVector(s,side*d*.35); c.y+=.03; return [c.x,c.y,c.z,h.x,h.y+.02,h.z]; }"""
async def main():
    async with async_playwright() as p:
        b,pg,errs = await boot(p,700,500)
        await pg.evaluate(HIDE)
        await pg.evaluate("(()=>{ window._FC="+FACECAM+"; return 1; })()")
        R={}
        # 플레이어: 홀 가운데, 멈춤
        await pg.evaluate(f"(()=>{{ const P=NC.player; P.x=-2; P.z=2; P.group.position.set(-2,0,2); P.ry=Math.PI; P.group.rotation.y=Math.PI; const n={GIRL}; window._k=n; n.state='idle'; n.x=-1.2; n.z=1.4; n.g.position.set(-1.2,0,1.4); n.g.rotation.y=-Math.PI/2; }})()")
        await pg.wait_for_timeout(5000)
        print("A", await pg.evaluate("[!!window._k, !!NC.player.group]"), flush=True)
        R['info']=await pg.evaluate("(()=>{ const f=g=>{ const r=g.userData.real; return r&&{url:r.url, lod:/_lod/.test(r.url), morphs:!!(r.F&&r.F.M&&r.F.M.length)}; }; return {me:f(NC.player.group), her:f(window._k.g), stats:NC.RealHuman.stats}; })()")
        for nm,who,d,s in [('me_front','NC.player.group',.42,0),('me_34','NC.player.group',.5,1),('her_front','window._k.g',.42,0),('her_34','window._k.g',.5,-1)]:
            await pg.evaluate(f"window._cam=window._FC({who},{d},{s})"); await pg.wait_for_timeout(1500)
            await pg.screenshot(path=f'/tmp/v87s/{TAG}_{nm}.png')
        # LOD 사람(먼 NPC)을 가까이서
        await pg.evaluate("(()=>{ const cand=NC.npcs.filter(n=>n.g.visible&&n.g.userData.real&&!n.g.userData.real.pending&&/_lod/.test(n.g.userData.real.url)&&n!==window._k); window._m=cand[0]; window._m2=cand.find(n=>n.gender!==cand[0].gender); })()")
        R['lodInfo']=await pg.evaluate("[window._m&&window._m.g.userData.real.url, window._m2&&window._m2.g.userData.real.url]")
        for nm,who in [('lod1','window._m.g'),('lod2','window._m2.g')]:
            await pg.evaluate(f"window._cam=window._FC({who},.55,.5)"); await pg.wait_for_timeout(1500)
            await pg.screenshot(path=f'/tmp/v87s/{TAG}_{nm}.png')
        R['dh']=await pg.evaluate("NC.DigitalHuman&&JSON.parse(JSON.stringify(NC.DigitalHuman.stats))")
        # LOD 얼굴 연기: 눈 감기·말하기·웃음
        for nm,js in [('lod_blink',"window._m.g.userData.blink=true"),('lod_talk',"window._m.g.userData.blink=false; window._m.g.userData.talkUntil=performance.now()+60000"),('lod_smile',"window._m.g.userData.talkUntil=0; window._m.g.userData.expr='laugh'")]:
            await pg.evaluate("(()=>{ const u=window._m.g.userData; u.blinkT=999; "+js+"; window._m.state='idle'; })()")
            await pg.evaluate("window._cam=window._FC(window._m.g,.42,0)"); await pg.wait_for_timeout(1500)
            await pg.evaluate("(()=>{ const u=window._m.g.userData; u.blinkT=999; "+js+"; })()")
            await pg.screenshot(path=f'/tmp/v87s/{TAG}_{nm}.png')
        R['fps']=await pg.evaluate("new Promise(r=>{let c=0;const t0=performance.now();const f=()=>{c++; if(performance.now()-t0<3000) requestAnimationFrame(f); else r(c/3);}; requestAnimationFrame(f);})")
        R['errs']=errs; out(R); await b.close()
asyncio.run(main())
