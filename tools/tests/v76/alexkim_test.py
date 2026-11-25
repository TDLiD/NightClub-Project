"""v71 조여사 옷 입히기 — 실제 앱: 생성·모델·조각 수·두 벌 전환·정면/측면/근접 캡처·애니메이션 중 따라오는지"""
import asyncio, json, sys
from playwright.async_api import async_playwright
SESS = "localStorage.setItem('nc_session', JSON.stringify({uid:'u_test',id:'tester',nickname:'테스터',gender:'남성',characterNo:1})); localStorage.setItem('nc_adult19','1');"
TAG = sys.argv[1] if len(sys.argv) > 1 else 'a'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await (await b.new_context(viewport={'width':520,'height':640})).new_page(); pg.set_default_timeout(900000)
        errs=[]; logs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:300])); pg.on('console', lambda m: ('wardrobe' in m.text or 'unique' in m.text) and logs.append(m.text[:200]))
        await pg.goto('http://localhost:3100/?mode=demo', wait_until='domcontentloaded')
        await pg.evaluate("localStorage.clear();"+SESS); await pg.reload(wait_until='domcontentloaded'); await pg.wait_for_timeout(4000)
        await pg.evaluate("document.querySelector('#go').click()"); await pg.wait_for_function("NC.player && NC.NPC && NC.NPC.byId && NC.NPC.byId('alexkim')", timeout=600000, polling=1000)
        await pg.evaluate("""(()=>{ const n=NC.NPC.byId('alexkim'); window._n=n; n.state='talk'; n.wp=null; const P=NC.player; P.x=0; P.z=9; P.group.position.set(0,0,9); n.x=0; n.z=4; n.g.position.set(0,0,4); n.g.rotation.y=0; window._ry=0; try{ NC.Dialog.open(n); }catch(e){}
           NC.tickers.push(()=>{ const n=window._n; n.x=0; n.z=4; n.g.position.x=0; n.g.position.z=4; n.g.rotation.y=window._ry; n.state='talk'; const c=window._cam; if(c){ NC.camera.position.set(c[0],c[1],c[2]); NC.camera.lookAt(c[3],c[4],c[5]); } }); })()""")
        await pg.wait_for_function("window._n.g.userData.real&&!window._n.g.userData.real.pending&&window._n.g.userData.real._wr", timeout=900000, polling=1000)
        await pg.wait_for_function("!/_lod/.test(window._n.g.userData.real.url) && window._n.g.userData.real._wr", timeout=300000, polling=1000)
        R={'info': await pg.evaluate("(()=>{ const u=window._n.g.userData, r=u.real; return {url:r.url, outfit:u.outfit, ms:r._wrMs, tuck:(()=>{let t=0; r.model.traverse(o=>{ if(o._wrTuck) t=o._wrTuck; }); return t;})(), parts:(r._wrMeshes||[]).map(m=>m.name+':'+((m.geometry.index?m.geometry.index.count:m.geometry.attributes.position.count)/3)), outfits:NC.RealHuman.outfits(window._n.g), no19:NC.RealHuman.no19(window._n.g), holder:[r.holder.scale.x,r.holder.scale.y].map(x=>+x.toFixed(4)), hyejung:(NC.NPC.byId('hyejung').g.userData._uid||null), grp:(()=>{ const A=NC.Wardrobe.analyze(r.model,r.Bn); const c={}; A.BV.forEach(v=>{ const k=Object.entries(v.W).sort((a,b)=>b[1]-a[1])[0][0]; c[k]=(c[k]||0)+1; }); return {c, nBV:A.BV.length, hips:A.H(A.P(r.Bn.hips)), neck:A.H(A.P(r.Bn.neck)), foot:A.H(A.P(r.Bn.footL))}; })()} })()")}
        print(json.dumps(R, ensure_ascii=False), flush=True)
        await pg.add_style_tag(content="body *:not(canvas){visibility:hidden !important} canvas{visibility:visible !important}")
        shots=[]
        for outfit in ['main']:
            await pg.evaluate(f"NC.RealHuman.setOutfit(window._n.g,'{outfit}')")
            for nm,cam,ry in [('front',[0,1.05,6.0,0,.95,4],0),('side',[2.0,1.1,4.2,0,.95,4],0),('back',[0,1.2,1.9,0,1.0,4],0),('face',[0,1.5,4.75,0,1.47,4],0)]:
                await pg.evaluate(f"window._cam={json.dumps(cam)}; window._ry={ry}"); await pg.wait_for_timeout(1500); f=f'/tmp/v76s/{TAG}_{outfit}_{nm}.png'; await pg.screenshot(path=f); shots.append(f)
        await pg.evaluate("NC.RealHuman.setOutfit(window._n.g,'main')")
        await pg.evaluate("(()=>{ const T=NC.THREE; const m=new T.Mesh(new T.PlaneGeometry(6,6), new T.MeshBasicMaterial({color:0x3b2a52})); m.position.set(0,1.4,3.35); NC.scene.add(m); window._bg=m; })()")
        await pg.evaluate("window._cam=[0,1.45,5.05,0,1.40,4]; window._ry=0"); await pg.wait_for_timeout(1800); await pg.screenshot(path='/tmp/v76s/portrait_raw.png')
        R['neck']=await pg.evaluate("(()=>{ const r=window._n.g.userData.real, V=()=>new NC.THREE.Vector3(); const m=r._wrMeshes.find(x=>x.name==='OUT_main_strap'); const v=V().fromBufferAttribute(m.geometry.attributes.position,0); m.boneTransform(0,v); v.applyMatrix4(m.matrixWorld); return [v.toArray().map(x=>+x.toFixed(3)), r.Bn.neck.getWorldPosition(V()).toArray().map(x=>+x.toFixed(3))]; })()")
        R['errors']=errs[:5]; R['logs']=logs[-6:]; print(json.dumps(R, ensure_ascii=False)); await b.close()
asyncio.run(main())
