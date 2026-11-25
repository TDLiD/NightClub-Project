import asyncio, json, sys
from playwright.async_api import async_playwright
SESS = "localStorage.setItem('nc_session', JSON.stringify({uid:'u_test',id:'tester',nickname:'테스터',gender:'남성',characterNo:1,role:'admin'})); localStorage.setItem('nc_adult19','1');"
CAM = "window._cam=null; NC.tickers.push(()=>{ const c=window._cam; if(c){ NC.camera.position.set(c[0],c[1],c[2]); NC.camera.lookAt(c[3],c[4],c[5]); } });"
FEET = """(()=>{ const T=NC.THREE, g=NC.player.group, r=g.userData.real; r.model.updateMatrixWorld(true); const yaw=r.root.rotation.y, fw=new T.Vector3(Math.sin(yaw),0,Math.cos(yaw)), hp=r.Bn.hips.getWorldPosition(new T.Vector3()); const F=g.userData.footPlant||{}; const o={fpW:+(r.fpW||0).toFixed(2), drag:+(r.fpDrag||0).toFixed(3), drop:+(F.drop||0).toFixed(3), toe:+(F.toe||0).toFixed(3), st:g.userData.bSt&&g.userData.bSt.style}; r.fpDrag=0;
  for (const sd of ['L','R']) { const a=r.Bn['ul'+sd].getWorldPosition(new T.Vector3()), b=r.Bn['ll'+sd].getWorldPosition(new T.Vector3()), c=r.Bn['foot'+sd].getWorldPosition(new T.Vector3()); o[sd]={fwd:+(c.clone().sub(hp).dot(fw)).toFixed(3), bend:+(Math.PI-a.clone().sub(b).angleTo(c.clone().sub(b))).toFixed(2)}; } return o; })()"""
async def run(pg, tag, setup):
    await pg.evaluate(setup)
    # 블루스 중 플레이어 몸을 0.25m 상대 쪽으로 천천히 밀기(카라오케 배치·충돌 밀림·스타일 이동과 같은 상황)
    await pg.evaluate("""(async()=>{ const P=NC.player, n=NC.Karaoke.BL.n; const dx=n.x-P.x, dz=n.z-P.z, l=Math.hypot(dx,dz)||1; for(let i=0;i<20;i++){ P.x+=dx/l*.0125; P.z+=dz/l*.0125; P.group.position.x=P.x; P.group.position.z=P.z; await new Promise(r=>setTimeout(r,60)); } })()""")
    await pg.wait_for_timeout(2500)
    s=[await pg.evaluate(FEET)]; await pg.screenshot(path=f'/tmp/v80s/slide_{tag}.png'); await pg.wait_for_timeout(1500); s.append(await pg.evaluate(FEET)); return s
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await (await b.new_context(viewport={'width':900,'height':620})).new_page(); pg.set_default_timeout(900000)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto('http://localhost:3100/?mode=demo', wait_until='domcontentloaded')
        await pg.evaluate("localStorage.clear();"+SESS); await pg.reload(wait_until='domcontentloaded'); await pg.wait_for_timeout(4000)
        await pg.evaluate("document.querySelector('#go').click()"); await pg.wait_for_function("NC.player && NC.npcs && NC.npcs.length>10 && NC.started && NC.player.group.userData.real", polling=1000)
        await pg.evaluate(CAM); await pg.evaluate("NC.Events.next=1e12")
        await pg.wait_for_function("NC.npcs.filter(n=>n.gender==='f'&&n.state==='wander'&&n.g.visible&&n.g.userData.real&&!n.g.userData.real.pending&&!n.g.userData.wardrobe).length>=1", polling=2000, timeout=600000)
        await pg.evaluate("(()=>{ const P=NC.player; P.x=3; P.z=-6; P.group.position.set(3,0,-6); const n=NC.npcs.find(n=>n.gender==='f'&&n.role!=='staff'&&n.state==='wander'&&n.g.visible&&n.g.userData.real&&!n.g.userData.real.pending&&!n.g.userData.wardrobe); n.x=3.6; n.z=-6; n.g.position.set(3.6,0,-6); n.aff=90; window._bn=n; })()")
        await pg.wait_for_function("window._bn.g.userData.real && !window._bn.g.userData.real.pending", polling=1000, timeout=300000)
        await pg.evaluate("NC.Karaoke.startBlues(window._bn); NC.Dialog.cur && NC.Dialog.close('bye')")
        await pg.wait_for_timeout(9000)
        await pg.evaluate("NC.tickers.push(()=>{ const P=NC.player,n=window._bn; if(!n) return; const mx=(P.x+n.x)/2, mz=(P.z+n.z)/2, dx=n.x-P.x, dz=n.z-P.z, l=Math.hypot(dx,dz)||1; window._cam=[mx+(-dz/l)*2.1,.85,mz+(dx/l)*2.1,mx,.6,mz]; })")
        R={}
        R['old']=await run(pg,'old',"NC.RealHuman.slideV=99; NC.RealHuman.replant=.3; NC.RealHuman.oldAnk=true")
        await pg.wait_for_timeout(3000)
        R['new']=await run(pg,'new',"NC.RealHuman.slideV=.12; NC.RealHuman.replant=.2; NC.RealHuman.oldAnk=false")
        await pg.wait_for_timeout(2000)
        R['noFoot']=await run(pg,'nofoot',"NC.RealHuman.noFoot=true")
        R['bl']=await pg.evaluate("!!(NC.Karaoke.BL&&NC.Karaoke.BL.n)"); R['errors']=errs[:5]; print(json.dumps(R, ensure_ascii=False)); await b.close()
asyncio.run(main())
