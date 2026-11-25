import asyncio, json
from playwright.async_api import async_playwright
SESS = "localStorage.setItem('nc_session', JSON.stringify({uid:'u_test',id:'tester',nickname:'테스터',gender:'남성',characterNo:1,role:'admin'})); localStorage.setItem('nc_adult19','1');"
CAM = "window._cam=null; NC.tickers.push(()=>{ const c=window._cam; if(c){ NC.camera.position.set(c[0],c[1],c[2]); NC.camera.lookAt(c[3],c[4],c[5]); } });"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await (await b.new_context(viewport={'width':1300,'height':660})).new_page(); pg.set_default_timeout(600000)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        logs=[]; pg.on('console', lambda m: logs.append(m.text[:160]) if ('[dance]' in m.text or 'rror' in m.text) else None)
        await pg.goto('http://localhost:3100/?mode=demo', wait_until='domcontentloaded')
        await pg.evaluate("localStorage.clear();"+SESS); await pg.reload(wait_until='domcontentloaded'); await pg.wait_for_timeout(4000)
        await pg.evaluate("document.querySelector('#go').click()"); await pg.wait_for_function("NC.player && NC.npcs && NC.npcs.length>10", polling=1000)
        await pg.evaluate(CAM)
        await pg.wait_for_function("NC.npcs.filter(n=>n.g&&n.g.userData.real&&n.g.userData.real._bt).length>=16", polling=2000, timeout=600000)
        R={}
        # 1) 체형 줄 세우기 (플레이어 숨김)
        R['line']=await pg.evaluate("""(()=>{ NC.player.group.visible=false; const want=['fat:1','fat:0.8','fat:0.75','muscle:1','muscle:0.8','slim:1']; const pick=[]; const used=new Set();
          for (const g of ['f','m']) { const norm=NC.npcs.find(n=>n.g&&n.g.userData.real&&!n.g.userData.real._bt&&n.g.userData.gender===g&&n.state==='wander'); if(norm){pick.push([norm,'보통']);used.add(norm);}
            for (const w of want) { const n=NC.npcs.find(n=>n.g&&n.g.userData.real&&n.g.userData.real._bt===w&&n.g.userData.gender===g&&!used.has(n)&&n.state==='wander'); if(n){pick.push([n,w]);used.add(n);} } }
          window._line=pick; pick.forEach(([n])=>{n.state='hold'; n.g.userData.dance=null; n.g.userData.moving=false;});
          window._lt=NC.tickers.length; NC.tickers.push(()=>{ (window._line||[]).forEach(([n,w],i)=>{ const x=-5+i*1.0, z=-6; n.x=x; n.z=z; n.g.position.set(x,0,z); n.g.rotation.y=0; }); });
          const mid=-5+(pick.length-1)/2; window._cam=[mid,1.35,-6+7.2, mid,.95,-6]; return pick.map(([n,w])=>n.name+':'+w); })()""")
        await pg.wait_for_timeout(2500); await pg.screenshot(path='/tmp/v78s/line2.png')
        await pg.evaluate("window._line.forEach(([n])=>{n.state='wander'; n.pause=1;}); window._line=null; window._cam=null; NC.player.group.visible=true;")
        # 2) 같이 걷기 해제 버튼
        R['pw']=await pg.evaluate("""(async()=>{ const P=NC.player; P.x=2; P.z=-2; P.group.position.set(2,0,-2); const n=NC.npcs.find(n=>n.gender==='f'&&n.state==='wander'&&n.g.visible&&!n._dk); n.x=2.6; n.z=-2; n.aff=70; NC.PairWalk.start(n);
          await new Promise(r=>setTimeout(r,800)); const b=document.querySelector('#pwStop'); const vis=b.style.display, txt=b.textContent;
          document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyQ',bubbles:true})); window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyQ'}));
          await new Promise(r=>setTimeout(r,500)); return {vis, txt, after: !!NC.PairWalk.n, btnAfter: b.style.display}; })()""")
        # 3) 둘이 신나게 춤추기 (대화 칩 경유)
        R['duo']=await pg.evaluate("""(async()=>{ const P=NC.player; const n=NC.npcs.find(n=>n.gender==='f'&&n.state==='wander'&&n.g.visible&&n.g.userData.real&&!n._dk); n.aff=60; n.x=P.x+.5; n.z=P.z+.8; NC.Dialog.open(n);
          await new Promise(r=>setTimeout(r,600)); const chips=[...document.querySelectorAll('button')].map(b=>b.textContent).filter(t=>/신나게/.test(t)); const c=[...document.querySelectorAll('button')].find(b=>/둘이 신나게/.test(b.textContent)); c&&c.click();
          await new Promise(r=>setTimeout(r,2500)); const u=n.g.userData, pu=P.group.userData; window._duoN=n; return {chips, on:!!NC.DanceShow.on, npcBase:u.mBase, plBase:pu.mBase, gap:+Math.hypot(n.x-P.x,n.z-P.z).toFixed(2), name:n.name}; })()""")
        await pg.evaluate("(()=>{ const P=NC.player, n=window._duoN; const mx=(P.x+n.x)/2, mz=(P.z+n.z)/2, dx=n.x-P.x, dz=n.z-P.z, l=Math.hypot(dx,dz)||1; window._cam=[mx+(-dz/l)*2.8, 1.5, mz+(dx/l)*2.8, mx, 1.0, mz]; })()")
        await pg.wait_for_timeout(3000); await pg.screenshot(path='/tmp/v78s/duo1.png')
        await pg.wait_for_timeout(2600); await pg.screenshot(path='/tmp/v78s/duo2.png')
        R['duoMid']=await pg.evaluate("(()=>{ const n=window._duoN; const mc=n.g.userData.mc||n.g.userData.real&&n.g.userData.real.mc; return {base:n.g.userData.mBase, clip: mc&&mc.layers&&mc.layers.length?mc.layers[mc.layers.length-1].name:null}; })()")
        await pg.evaluate("NC.DanceShow.stop()"); await pg.wait_for_timeout(800)
        R['duoAfter']=await pg.evaluate("(()=>{ const n=window._duoN; return {state:n.state, sd:n._sd, aff:n.aff}; })()")
        await pg.evaluate("window._cam=null")
        # 4) 댄싱 킹/퀸 (30초 → 7초로 단축)
        await pg.evaluate("(()=>{ const P=NC.player; P.x=0; P.z=-3.6; P.group.position.set(0,0,-3.6); P.ry=Math.PI; NC.DanceKing.DUR=30; NC.DanceKing.ts=6; })()")
        R['dkStart']=await pg.evaluate("NC.DanceKing.start()")
        await pg.evaluate("window._cam=[0,3.6,-1.2, 0,0.9,-9.4]")
        print(json.dumps(R, ensure_ascii=False), flush=True)
        await pg.wait_for_timeout(9000); await pg.screenshot(path='/tmp/v78s/dk_gather.png')
        await pg.evaluate("document.querySelector('#dkBar [data-a=join]').click()")
        await pg.wait_for_function("NC.DanceKing.phase==='dance'", polling=300, timeout=400000)
        await pg.wait_for_timeout(2500); await pg.screenshot(path='/tmp/v78s/dk_dance.png')
        await pg.wait_for_timeout(2500); await pg.screenshot(path='/tmp/v78s/dk_dance2.png')
        await pg.wait_for_function("NC.DanceKing.phase==='score'", polling=300, timeout=400000)
        await pg.wait_for_timeout(2600); await pg.screenshot(path='/tmp/v78s/dk_score.png')
        await pg.wait_for_function("NC.DanceKing.phase==='toss'", polling=500, timeout=240000)
        R['dkLog']=await pg.evaluate("NC.DanceKing.log")
        await pg.wait_for_timeout(2000)
        await pg.evaluate("(()=>{ const S=NC.DanceKing.S; const g=S.win.me?NC.player.group:S.win.n.g; window._cam=[g.position.x+2.6,2.2,g.position.z+3.2, g.position.x,1.4,g.position.z]; })()")
        await pg.wait_for_timeout(1400); await pg.screenshot(path='/tmp/v78s/dk_toss1.png')
        await pg.wait_for_timeout(800); await pg.screenshot(path='/tmp/v78s/dk_toss2.png')
        R['tossY']=await pg.evaluate("(()=>{ const S=NC.DanceKing.S; if(!S) return null; const g=S.win.me?NC.player.group:S.win.n.g; return {y:+g.position.y.toFixed(2), rx:+g.rotation.x.toFixed(2), win:S.win.me?'me':S.win.n.name, lifters:S.lift&&S.lift.length}; })()")
        await pg.wait_for_function("!NC.DanceKing.phase", polling=500, timeout=400000)
        R['dkEnd']=await pg.evaluate("(()=>({left:NC.npcs.filter(n=>n._dk).length, states:[...new Set(NC.npcs.map(n=>n.state))], busy:NC.player.busy}))()")
        R['errors']=errs[:8]; R['logs']=logs[:10]; print(json.dumps(R, ensure_ascii=False, indent=1)); await b.close()
asyncio.run(main())
