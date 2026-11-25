import asyncio, json, sys
from playwright.async_api import async_playwright
Q = sys.argv[1] if len(sys.argv)>1 else ''
TAG = 'off' if 'nocrowd' in Q else 'on'
SESS = "localStorage.setItem('nc_session', JSON.stringify({uid:'u_test',id:'tester',nickname:'테스터',gender:'남성',characterNo:1,role:'admin'})); localStorage.setItem('nc_adult19','1');"
CAM = "window._cam=null; NC.tickers.push(()=>{ const c=window._cam; if(c){ NC.camera.position.set(c[0],c[1],c[2]); NC.camera.lookAt(c[3],c[4],c[5]); } });"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await (await b.new_context(viewport={'width':1000,'height':600})).new_page(); pg.set_default_timeout(900000)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto('http://localhost:3100/?mode=demo'+Q, wait_until='domcontentloaded')
        await pg.evaluate("localStorage.clear();"+SESS); await pg.reload(wait_until='domcontentloaded'); await pg.wait_for_timeout(4000)
        await pg.evaluate("document.querySelector('#go').click()"); await pg.wait_for_function("NC.player && NC.npcs && NC.npcs.length>10 && NC.started", polling=1000)
        await pg.evaluate(CAM); await pg.evaluate("NC.Events && (NC.Events.next=1e12)")
        await pg.wait_for_timeout(20000)
        R={'tag':TAG,'ov':[]}
        # 정면으로 마주 걷기: 두 손님을 6m 떨어뜨려 서로의 자리로 걷게 함
        await pg.evaluate("""(()=>{ const ns=NC.npcs.filter(n=>n.state==='wander'&&n.g.visible&&!n._dk).slice(0,2); const [a,b]=ns; window._ab=ns;
          a.x=-3; a.z=-6.5; b.x=3; b.z=-6.5; a.g.position.set(-3,0,-6.5); b.g.position.set(3,0,-6.5);
          NC.NPC.goTo(a,{x:3,z:-6.5},()=>{a.state='wander'},1.4); NC.NPC.goTo(b,{x:-3,z:-6.5},()=>{b.state='wander'},1.4);
          window._md=99; window._maxLat=0; NC.tickers.push(()=>{ const d=Math.hypot(a.x-b.x,a.z-b.z); if(d<window._md) window._md=d; window._maxLat=Math.max(window._maxLat,Math.abs(a.z+6.5),Math.abs(b.z+6.5)); });
          window._cam=[0,3.2,-1.5, 0,.8,-6.5]; return [a.name,b.name]; })()""")
        await pg.wait_for_timeout(6000); await pg.screenshot(path=f'/tmp/v79s/crowd_{TAG}_cross.png')
        await pg.wait_for_function("window._ab.every(n=>n.state!=='path') || false", polling=1000, timeout=240000)
        R['cross']=await pg.evaluate("({minDist:+window._md.toFixed(2), maxLateral:+window._maxLat.toFixed(2)})")
        await pg.evaluate("window._cam=null")
        for k in range(12):
            await pg.wait_for_timeout(2500); R['ov'].append(await pg.evaluate("NC.Crowd ? NC.Crowd.overlaps(.4) : -1"))
        R['stats']=await pg.evaluate("NC.Crowd && NC.Crowd.stats")
        # 플레이어가 손님을 향해 걸어 들어가기(키보드처럼 직선) — 통과하는지
        R['player']=await pg.evaluate("""(async()=>{ const P=NC.player; const n=NC.npcs.find(n=>n.state==='wander'&&n.g.visible); n.state='hold'; n.x=1; n.z=-4; n.g.position.set(1,0,-4); P.x=1; P.z=-1.5; P.group.position.set(1,0,-1.5); P.ry=Math.PI;
          let md=9; for(let i=0;i<60;i++){ P.target={x:1,z:-6.5}; await new Promise(r=>setTimeout(r,100)); md=Math.min(md,Math.hypot(P.x-n.x,P.z-n.z)); } n.state='wander'; return {minDist:+md.toFixed(2), pz:+P.z.toFixed(2)}; })()""")
        R['errors']=errs[:5]; print(json.dumps(R, ensure_ascii=False)); await b.close()
asyncio.run(main())
