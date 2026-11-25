import asyncio, json
from playwright.async_api import async_playwright
SESS = "localStorage.setItem('nc_session', JSON.stringify({uid:'u_test',id:'tester',nickname:'테스터',gender:'남성',characterNo:1,role:'admin'})); localStorage.setItem('nc_adult19','1');"
CAM = "window._cam=null; NC.tickers.push(()=>{ const c=window._cam; if(c){ NC.camera.position.set(c[0],c[1],c[2]); NC.camera.lookAt(c[3],c[4],c[5]); } });"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await (await b.new_context(viewport={'width':1100,'height':620})).new_page(); pg.set_default_timeout(900000)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto('http://localhost:3100/?mode=demo', wait_until='domcontentloaded')
        await pg.evaluate("localStorage.clear();"+SESS); await pg.reload(wait_until='domcontentloaded'); await pg.wait_for_timeout(4000)
        await pg.evaluate("document.querySelector('#go').click()"); await pg.wait_for_function("NC.player && NC.npcs && NC.npcs.length>10", polling=1000)
        await pg.evaluate(CAM)
        await pg.wait_for_function("NC.npcs.filter(n=>n.g&&n.g.userData.real).length>=16", polling=2000, timeout=600000)
        await pg.evaluate("(()=>{ const P=NC.player; P.x=1.5; P.z=-4.2; P.group.position.set(1.5,0,-4.2); P.ry=Math.PI; NC.DanceKing.DUR=30; NC.DanceKing.ts=1; NC.tickers.push(()=>{ const D=NC.DanceKing; if(D.phase==='gather'||D.phase==='dance'||D.phase==='enter'||D.phase==='score'||D.phase==='next') D.ts=40; else if(D.phase==='result'||D.phase==='toss') D.ts=4; else D.ts=1; }); })()")
        print(await pg.evaluate("NC.DanceKing.start()"), flush=True)
        await pg.evaluate("window._cam=[1.2,2.6,-3.2, 0,1.0,-9.4]")
        await pg.wait_for_function("NC.DanceKing.phase==='dance'", polling=300, timeout=600000)
        await pg.wait_for_timeout(4000); await pg.screenshot(path='/tmp/v78s/dkC_dance.png')
        await pg.wait_for_timeout(4000); await pg.screenshot(path='/tmp/v78s/dkC_dance2.png')
        await pg.wait_for_function("NC.DanceKing.phase==='score'", polling=300, timeout=600000)
        await pg.wait_for_timeout(1800); await pg.screenshot(path='/tmp/v78s/dkC_score.png')
        await pg.wait_for_timeout(1500); await pg.screenshot(path='/tmp/v78s/dkC_score2.png')
        await pg.wait_for_function("NC.DanceKing.phase==='result'", polling=300, timeout=900000)
        print(json.dumps(await pg.evaluate("NC.DanceKing.log"), ensure_ascii=False), flush=True)
        await pg.wait_for_timeout(1500); await pg.screenshot(path='/tmp/v78s/dkC_result.png')
        await pg.wait_for_function("NC.DanceKing.phase==='toss' && NC.DanceKing.S.lift", polling=200, timeout=300000)
        await pg.evaluate("(()=>{ const S=NC.DanceKing.S; const g=S.win.me?NC.player.group:S.win.n.g; window._cam=[g.position.x+2.4,2.0,g.position.z+3.0, g.position.x,1.5,g.position.z]; })()")
        shots=[]
        for k in range(5):
            await pg.wait_for_timeout(5000)
            shots.append(await pg.evaluate("(()=>{ const S=NC.DanceKing.S; if(!S) return null; const g=S.win.me?NC.player.group:S.win.n.g; return {ph:NC.DanceKing.phase, phT:+S.phT.toFixed(1), y:+g.position.y.toFixed(2), rx:+g.rotation.x.toFixed(2), win:S.win.me?'me':S.win.n.name, lifters:S.lift&&S.lift.length}; })()"))
            await pg.screenshot(path=f'/tmp/v78s/dkC_toss{k}.png')
        print(json.dumps(shots, ensure_ascii=False), flush=True)
        await pg.wait_for_function("!NC.DanceKing.phase", polling=500, timeout=300000)
        print(json.dumps(await pg.evaluate("(()=>({left:NC.npcs.filter(n=>n._dk).length, dkStates:NC.npcs.filter(n=>n.state==='dk').length, busy:NC.player.busy}))()"), ensure_ascii=False), errs[:6], flush=True)
        await b.close()
asyncio.run(main())
