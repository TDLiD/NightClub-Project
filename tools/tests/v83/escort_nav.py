import asyncio, json
from playwright.async_api import async_playwright
SESS = "localStorage.setItem('nc_session', JSON.stringify({uid:'u_test',id:'tester',nickname:'테스터',gender:'남성',characterNo:1,role:'admin'})); localStorage.setItem('nc_adult19','1');"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await (await b.new_context(viewport={'width':700,'height':450})).new_page(); pg.set_default_timeout(900000)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto('http://localhost:3100/?mode=demo', wait_until='domcontentloaded')
        await pg.evaluate("localStorage.clear();"+SESS); await pg.reload(wait_until='domcontentloaded'); await pg.wait_for_timeout(4000)
        await pg.evaluate("document.querySelector('#go').click()"); await pg.wait_for_function("NC.player && NC.npcs && NC.npcs.length>10 && NC.started && NC.Escort.list.length", polling=1000)
        await pg.evaluate("NC.Events.next=1e12; NC.Escort.list.forEach(o=>{ o.wait=0; })")
        # 웨이터가 걷는데 거의 못 나아가는 시간(헛걸음) 측정
        await pg.evaluate("""window._es={}; NC.tickers.push(dt=>{ for(const o of NC.Escort.list){ const s=window._es[o.title]||(window._es[o.title]={walk:0,stuck:0,lx:o.x,lz:o.z,acc:0,states:{}}); s.states[o.state]=(s.states[o.state]||0)+1; if(o.g.userData.moving){ s.walk+=dt; s.acc+=dt; if(s.acc>1){ const m=Math.hypot(o.x-s.lx,o.z-s.lz); if(m<.15) s.stuck+=s.acc; s.acc=0; s.lx=o.x; s.lz=o.z; } } } });""")
        await pg.wait_for_timeout(240000)
        R=await pg.evaluate("({es:Object.fromEntries(Object.entries(window._es).map(([k,v])=>[k,{walk:+v.walk.toFixed(1),stuck:+v.stuck.toFixed(1),states:v.states}])), log:NC.Escort.log.slice(-6), nav:NC.Nav.stats})")
        R['errors']=errs[:5]; print(json.dumps(R, ensure_ascii=False)); await b.close()
asyncio.run(main())
