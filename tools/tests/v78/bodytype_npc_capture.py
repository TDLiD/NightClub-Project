import asyncio, json
from playwright.async_api import async_playwright
SESS = "localStorage.setItem('nc_session', JSON.stringify({uid:'u_test',id:'tester',nickname:'테스터',gender:'남성',characterNo:1,role:'admin'})); localStorage.setItem('nc_adult19','1');"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await (await b.new_context(viewport={'width':1300,'height':640})).new_page(); pg.set_default_timeout(600000)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto('http://localhost:3100/?mode=demo', wait_until='domcontentloaded')
        await pg.evaluate("localStorage.clear();"+SESS); await pg.reload(wait_until='domcontentloaded'); await pg.wait_for_timeout(4000)
        await pg.evaluate("document.querySelector('#go').click()"); await pg.wait_for_function("NC.player && NC.npcs && NC.npcs.length>10", polling=1000)
        await pg.wait_for_function("NC.npcs.filter(n=>n.g&&n.g.userData.real&&n.g.userData.real._bt).length>=22", polling=2000, timeout=300000)
        R={}
        R['stat']=await pg.evaluate("NC.BodyType.stat()")
        # 체형별로 골라 한 줄로 세우기(촬영용)
        R['line']=await pg.evaluate("""(()=>{ const want=['fat:1','fat:0.8','fat:0.75','muscle:1','muscle:0.8','slim:1']; const pick=[]; const used=new Set();
          for (const g of ['f','m']) { const norm=NC.npcs.find(n=>n.g&&n.g.userData.real&&!n.g.userData.real._bt&&n.g.userData.gender===g&&!used.has(n)); if(norm){pick.push([norm,'보통']);used.add(norm);}
            for (const w of want) { const n=NC.npcs.find(n=>n.g&&n.g.userData.real&&n.g.userData.real._bt===w&&n.g.userData.gender===g&&!used.has(n)); if(n){pick.push([n,w]);used.add(n);} } }
          window._line=pick; const out=[]; pick.forEach(([n,w],i)=>{ n._frozen=true; out.push(n.name+':'+w); });
          NC.tickers.push(()=>{ (window._line||[]).forEach(([n,w],i)=>{ const x=-4+i*1.0, z=-5; n.x=x; n.z=z; n.g.position.set(x,0,z); n.g.rotation.y=0; if(n.target) n.target=null; }); NC.camera.position.set(-4+(window._line.length-1)/2, 1.5, -5+6.4); NC.camera.lookAt(-4+(window._line.length-1)/2, 0.95, -5); });
          return out; })()""")
        await pg.wait_for_timeout(2500)
        await pg.screenshot(path='/tmp/v78s/line.png')
        R['errors']=errs[:6]; print(json.dumps(R, ensure_ascii=False, indent=1)); await b.close()
asyncio.run(main())
