import asyncio, sys, json, collections
from playwright.async_api import async_playwright
Q = sys.argv[1] if len(sys.argv) > 1 else ''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':640,'height':360}); pg.set_default_timeout(1800000); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
        await pg.goto('http://localhost:3100/?mode=demo'+Q, wait_until='domcontentloaded')
        await pg.evaluate("localStorage.clear(); localStorage.setItem('nc_quality', JSON.stringify('mid')); localStorage.setItem('nc_session', JSON.stringify({uid:'u_t',id:'tester',nickname:'테스터',gender:'남성',characterNo:2}))"); await pg.reload(wait_until='domcontentloaded')
        await pg.wait_for_function("NC.dataReady && document.querySelector('#go')", timeout=900000); await pg.wait_for_timeout(15000)
        print('preloaded', await pg.evaluate("NC.RealHuman.stats && NC.RealHuman.stats.preloaded"), 'cache', await pg.evaluate("NC.RealHuman.cache.size"), flush=True)
        await pg.evaluate("""window._ovOff=null; window._snap=null; new MutationObserver(()=>{ if(!document.getElementById('enterOv') && NC.player.group && _ovOff==null){ _ovOff=performance.now(); const all=[...NC.npcs.filter(n=>n.g.visible&&n.g.parent)]; _snap={vis:all.length, real:all.filter(n=>n.g.userData.real&&!n.g.userData.real.pending).length, me: !!(NC.player.group.userData.real&&!NC.player.group.userData.real.pending), meId: NC.player.group.userData.real&&NC.player.group.userData.real.url}; } }).observe(document.body,{childList:true});""")
        t0 = await pg.evaluate("performance.now()")
        await pg.evaluate("document.querySelector('#go').click()")
        await pg.wait_for_function("window._ovOff!=null", timeout=900000)
        off = await pg.evaluate("_ovOff"); print('overlay ms', round(off - t0), 'snap', await pg.evaluate("_snap"), flush=True)
        await pg.wait_for_timeout(5000)
        await pg.evaluate("window._F=[]; (function f(t){ _F.push(t); requestAnimationFrame(f); })(performance.now());")
        cdp = await pg.context.new_cdp_session(pg); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', {'interval': 2000}); await cdp.send('Profiler.start')
        await pg.wait_for_timeout(30000)
        prof = (await cdp.send('Profiler.stop'))['profile']; F = await pg.evaluate("_F")
        fr=[F[i+1]-F[i] for i in range(len(F)-1)]; print('frames', len(fr), 'avg ms', round(sum(fr)/max(1,len(fr)),1), flush=True)
        nodes = {n['id']: n for n in prof['nodes']}; byurl = collections.Counter(); idle=0
        for s, d in zip(prof['samples'], prof['timeDeltas']):
            cf=nodes[s]['callFrame']; u=cf['url'].split('/')[-1].split('?')[0] or cf['functionName']; byurl[u]+=d
        tot=sum(byurl.values()); print('JS by file (ms over 30s)', [(k, round(v/1000)) for k, v in byurl.most_common(12)])
        print('stats', await pg.evaluate("JSON.stringify(NC.RealHuman.stats)"), 'real now', await pg.evaluate("NC.npcs.filter(n=>n.g.visible&&n.g.userData.real&&!n.g.userData.real.pending).length+'/'+NC.npcs.filter(n=>n.g.visible).length"))
        # dialog chips with logged-in
        r = await pg.evaluate("""(()=>{ let s=NC.npcs.find(n=>n.state==='seated' && !n.booked && n.g.visible); const P=NC.player; P.x=s.x+1.5; P.z=s.z+1.0; P.group.position.set(P.x,0,P.z); const acts=[]; NC.interactProviders.forEach(f=>{ try{(f()||[]).forEach(a=>acts.push(a.label))}catch(e){} }); s.bluesDanced=true; s._seatTalk=true; NC.Dialog.open(s); return s.name+' | '+acts.filter(a=>a.includes('부킹')).join(',')+' || '+[...document.querySelectorAll('#tChips button')].slice(0,3).map(b=>b.textContent).join(' / ') })()""")
        print('seated/chips', r)
        await pg.evaluate("document.querySelector('#tChips button').click()"); await pg.wait_for_timeout(300)
        print('open', await pg.evaluate("[...document.querySelectorAll('#tChips button')].slice(0,4).map(b=>b.textContent).join(' / ')"))
        await pg.evaluate("[...document.querySelectorAll('#tChips button')][3].click()"); await pg.wait_for_timeout(300)
        print('theme', await pg.evaluate("NC.world.themeId"))
        await pg.screenshot(path='/home/claude/tests/v48b_talk.png')
        await pg.evaluate("NC.Dialog.close('bye')"); await pg.wait_for_timeout(300)
        print('after close', await pg.evaluate("NC.npcs.find(n=>n.bluesDanced).state"), 'player seat', await pg.evaluate("!!NC.player.seat"))
        print('guest names', await pg.evaluate("NC.npcs.filter(n=>n.guest).map(n=>n.name+':'+(n.photo||'').replace('real/','').replace('.jpg','')).join(' ')"))
        print('errs', errs[:5]); await b.close()
asyncio.run(main())
