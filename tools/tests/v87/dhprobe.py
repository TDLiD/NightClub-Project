from h import *
async def main():
    async with async_playwright() as p:
        b,pg,errs = await boot(p,400,400)
        await pg.wait_for_timeout(8000)
        R={}
        R['pick']=await pg.evaluate("(()=>{ const c=NC.npcs.filter(n=>n.g.visible&&n.g.userData.real&&!n.g.userData.real.pending&&/_lod/.test(n.g.userData.real.url)&&/[fm]_(0|1|2[0-7])/.test(n.g.userData.real.url)); window._m=c[0]; const P=NC.player; window._m.x=P.x+1; window._m.z=P.z; window._m.g.position.set(P.x+1,0,P.z); window._m.state='idle'; return window._m.g.userData.real.url; })()")
        await pg.wait_for_timeout(2000)
        PROBE="(()=>{ const r=window._m.g.userData.real, V=NC.THREE.Vector3; const f=n=>{ let b=null; r.model.traverse(o=>{ if(!b&&o.name&&o.name.replace(/[\\s_]/g,'').toLowerCase()===n) b=o; }); return b; }; const e=f('bip01leye').getWorldPosition(new V()); const t=f('bip01leyeblinktop'), bl=f('bip01mbottomlip'), j=f('bip01mjaw'), mc=f('bip01lmouthcorner'); return {top:+(t.getWorldPosition(new V()).distanceTo(e)*1000).toFixed(1), lip:+(bl.getWorldPosition(new V()).distanceTo(e)*1000).toFixed(1), mc:+(mc.getWorldPosition(new V()).distanceTo(e)*1000).toFixed(1)}; })()"
        u="window._m.g.userData"
        await pg.evaluate(u+".blinkT=999; "+u+".blink=false; "+u+".expr='neutral'; "+u+".talkUntil=0"); await pg.wait_for_timeout(1200); R['n']=await pg.evaluate(PROBE)
        await pg.evaluate(u+".blink=true; "+u+".blinkT=999; "+u+".blinkEnd=999"); await pg.wait_for_timeout(800); await pg.evaluate(u+".blink=true"); R['blink']=await pg.evaluate(PROBE); R['bst']=await pg.evaluate("(()=>{ const st=NC.DigitalHuman.rigOf(window._m.g); const b=st.B.tL, bs=st.base.get(b); const r=window._m.g.userData.real; r.model.updateMatrixWorld(true); const V=NC.THREE.Vector3; const same=(()=>{ let x=null; r.model.traverse(o=>{ if(!x&&o.name&&o.name.replace(/[\\s_]/g,'').toLowerCase()==='bip01leyeblinktop') x=o; }); return x===b; })(); return {same, d:+(b.getWorldPosition(new V()).distanceTo(st.eL.getWorldPosition(new V()))*1000).toFixed(1), eye:st.eL.name,par:b.parent.name, pos:b.position.toArray().map(v=>+v.toFixed(4)), base:bs&&bs.p.toArray().map(v=>+v.toFixed(4)), frameU:st.frame&&st.frame.ipd, blink:st.blink, lod:!st.morph, keys:Object.keys(st.B), ub:window._m.g.userData.blink}; })()")
        await pg.evaluate(u+".blink=false; "+u+".talkUntil=performance.now()+60000"); await pg.wait_for_timeout(1200); R['talk']=await pg.evaluate(PROBE)
        await pg.evaluate(u+".talkUntil=0; "+u+".expr='laugh'"); await pg.wait_for_timeout(1200); R['laugh']=await pg.evaluate(PROBE)
        await pg.evaluate(HIDE)
        CAMF="window._cam=()=>{ const st=NC.DigitalHuman.rigOf(window._m.g); const V=NC.THREE.Vector3, q=st.head.getWorldQuaternion(new NC.THREE.Quaternion()); const F=st.frame.F.clone().applyQuaternion(q), e=st.eL.getWorldPosition(new V()).add(st.eR.getWorldPosition(new V())).multiplyScalar(.5); const c=e.clone().addScaledVector(F,.32); return [c.x,c.y,c.z,e.x,e.y-.03,e.z]; }"
        await pg.evaluate(CAMF)
        for nm,js in [('o',u+".blink=false; "+u+".expr='neutral'; "+u+".talkUntil=0"),('b',u+".blink=true; "+u+".blinkEnd=999"),('t',u+".blink=false; "+u+".talkUntil=performance.now()+60000"),('s',u+".talkUntil=0; "+u+".expr='smile'")]:
            await pg.evaluate(u+".blinkT=999; "+js); await pg.wait_for_timeout(900); await pg.screenshot(path=f'/tmp/v87s/lf_{nm}.png')
        R['dh']=await pg.evaluate("JSON.parse(JSON.stringify(NC.DigitalHuman.stats))")
        R['errs']=errs; out(R); await b.close()
asyncio.run(main())
