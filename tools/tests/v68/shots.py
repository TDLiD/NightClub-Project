import asyncio, sys
from playwright.async_api import async_playwright
SESS = "localStorage.setItem('nc_session', JSON.stringify({uid:'u_test',id:'tester',nickname:'테스터',gender:'남성',characterNo:1})); localStorage.setItem('nc_adult19','1');"
ACTS = sys.argv[1].split(','); PORT = sys.argv[2] if len(sys.argv)>2 else '3100'; TAG = sys.argv[3] if len(sys.argv)>3 else 'new'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await (await b.new_context(viewport={'width':560,'height':560})).new_page(); pg.set_default_timeout(1200000)
        await pg.goto(f'http://localhost:{PORT}/?mode=demo', wait_until='domcontentloaded')
        await pg.evaluate("localStorage.clear();"+SESS); await pg.reload(wait_until='domcontentloaded'); await pg.wait_for_timeout(4000)
        await pg.evaluate("document.querySelector('#go').click()"); await pg.wait_for_function("NC.player && NC.npcs && NC.npcs.length>=6", timeout=600000)
        await pg.evaluate("""(()=>{ const L=NC.npcs.filter(n=>n.g.visible&&n.state==='wander'&&n.gender==='f'); const n=L[0]; window._n=n; const P=NC.player;
          P.x=0; P.z=4; P.group.position.set(0,0,4); n.x=.7; n.z=4; n.g.position.set(.7,0,4); NC.npcs.forEach(o=>{ if(o!==n) o.cool=999; }); })()""")
        await pg.wait_for_function("window._n.g.userData.real&&!window._n.g.userData.real.pending&&NC.player.group.userData.real&&!NC.player.group.userData.real.pending", timeout=900000, polling=2000)
        await pg.add_script_tag(content=open('vclock.js').read())
        await pg.evaluate("(()=>{ const a0=performance.now()/1000; Object.defineProperty(BaseAudioContext.prototype,'currentTime',{get(){ return performance.now()/1000-a0; }, configurable:true}); })()")
        await pg.evaluate("""(()=>{ const n=window._n, K=NC.Karaoke; n.state='wander'; n.aff=100; n.bl={kissed:true,warned:0}; NC.Dialog.open(n); K.startBlues(n);
          document.querySelectorAll('#hud,#top,#bar,#chat,#mini,.toast,#dock,#dlg,#dialog,.dlg,#guestList,#plist').forEach(e=>e&&(e.style.visibility='hidden'));
          window._cam={a:0}; NC.tickers.push(()=>{ const c=window._cam; if(!c.on) return; const BL=NC.Karaoke.BL; if(!BL.n) return; const P=NC.player; const cx=(P.x+BL.n.x)/2, cz=(P.z+BL.n.z)/2; const ax=BL.n.x-P.x, az=BL.n.z-P.z, l=Math.hypot(ax,az)||1; const px=-az/l, pz=ax/l;
            const s=c.a; NC.camera.position.set(cx+px*2.1*Math.cos(s)+ax/l*2.1*Math.sin(s), 1.3, cz+pz*2.1*Math.cos(s)+az/l*2.1*Math.sin(s)); NC.camera.lookAt(cx,1.0,cz); }); })()""")
        await pg.wait_for_function("NC.Karaoke.BL.n && NC.Karaoke.BL.t>3", polling=500)
        await pg.add_style_tag(content="body *:not(canvas){visibility:hidden !important} canvas{visibility:visible !important}")
        for act in ACTS:
            if act != 'hold':
                await pg.evaluate(f"NC.Karaoke.bluesAct('{act}')")
                await pg.wait_for_function("NC.Karaoke.BL.act && (performance.now()-NC.Karaoke.BL.act.t0)/1000 > (NC.Karaoke.BL.act.k==='spin'? NC.Karaoke.BL.act.hit-.35 : NC.Karaoke.BL.act.hit+.55)", polling=100)
            await pg.evaluate("window._vpause=true; window._cam.on=1; window._cam.a=0"); await pg.wait_for_timeout(400)
            await pg.evaluate("window._vpause=false"); await pg.wait_for_timeout(250); await pg.evaluate("window._vpause=true")
            await pg.screenshot(path=f'/tmp/v68s/{TAG}_{act}_side.png')
            await pg.evaluate("window._cam.a=1.1; window._vpause=false"); await pg.wait_for_timeout(250); await pg.evaluate("window._vpause=true"); await pg.screenshot(path=f'/tmp/v68s/{TAG}_{act}_q.png')
            await pg.evaluate("window._cam.on=0; window._vpause=false")
            if act != 'hold': await pg.wait_for_function("!NC.Karaoke.BL.busy", polling=500)
            await pg.wait_for_timeout(1500)
        await b.close()
asyncio.run(main())
