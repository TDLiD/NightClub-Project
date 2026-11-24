import asyncio, json
from playwright.async_api import async_playwright
SESS = "localStorage.setItem('nc_session', JSON.stringify({uid:'u_test',id:'tester',nickname:'테스터',gender:'남성',characterNo:1})); localStorage.setItem('nc_adult19','1');"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await (await b.new_context(viewport={'width':400,'height':300})).new_page(); pg.set_default_timeout(1200000)
        await pg.goto('http://localhost:3100/?mode=demo', wait_until='domcontentloaded')
        await pg.evaluate("localStorage.clear();"+SESS); await pg.reload(wait_until='domcontentloaded'); await pg.wait_for_timeout(4000)
        await pg.evaluate("document.querySelector('#go').click()"); await pg.wait_for_function("NC.player && NC.npcs && NC.npcs.length>=6", timeout=600000)
        await pg.evaluate("""(()=>{ const L=NC.npcs.filter(n=>n.g.visible&&n.state==='wander'&&n.gender==='f'); const n=L[0]; window._n=n; const P=NC.player; P.x=0; P.z=4; P.group.position.set(0,0,4); n.x=.7; n.z=4; n.g.position.set(.7,0,4); })()""")
        await pg.add_script_tag(content=open('vclock.js').read())
        await pg.evaluate("""(()=>{ const n=window._n, K=NC.Karaoke; n.state='wander'; n.aff=100; n.bl={kissed:true,warned:0}; NC.Dialog.open(n); K.startBlues(n); window._md=[]; })()""")
        await pg.wait_for_function("NC.Karaoke.BL.n && NC.Karaoke.BL.t>2.6", polling=400)
        r = await pg.evaluate("""(()=>{ const P=NC.player, n=window._n; const cx=(P.x+n.x)/2, cz=(P.z+n.z)/2; const others=NC.npcs.filter(o=>o!==n&&o.g.visible&&o.state==='wander').slice(0,4);
          others.forEach((o,i)=>{ o.x=cx-3; o.z=cz+(i-1.5)*.15; o.g.position.set(o.x,0,o.z); NC.NPC.goTo(o,{x:cx+3,z:cz-(i-1.5)*.1},()=>{},2.6); o.cool=999; }); window._oth=others;
          NC.tickers.push(()=>{ if(!window._oth) return; let m=9; for(const o of window._oth) for(const c of [P,n]) m=Math.min(m, Math.hypot(o.x-c.x,o.z-c.z)); window._md.push(+m.toFixed(3)); }); return others.map(o=>o.name); })()""")
        print('crossers', r)
        await pg.evaluate("window._wt=performance.now()+6000"); await pg.wait_for_function("performance.now()>window._wt", polling=300)
        md = await pg.evaluate("window._md"); md2=sorted(md)
        print('min dist to couple', md2[0], 'frames<0.45', sum(1 for x in md if x<.45), 'of', len(md), 'paths', await pg.evaluate("window._oth.map(o=>[o.state,+o.x.toFixed(1),+o.z.toFixed(1)])"))
        await b.close()
asyncio.run(main())
