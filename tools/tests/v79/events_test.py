import asyncio, json
from playwright.async_api import async_playwright
SESS = "localStorage.setItem('nc_session', JSON.stringify({uid:'u_test',id:'tester',nickname:'테스터',gender:'남성',characterNo:1,role:'admin'})); localStorage.setItem('nc_adult19','1');"
CAM = "window._cam=null; NC.tickers.push(()=>{ const c=window._cam; if(c){ NC.camera.position.set(c[0],c[1],c[2]); NC.camera.lookAt(c[3],c[4],c[5]); } });"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await (await b.new_context(viewport={'width':1200,'height':650})).new_page(); pg.set_default_timeout(900000)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        logs=[]; pg.on('console', lambda m: logs.append(m.text[:200]) if ('[events]' in m.text or '[dance]' in m.text or 'rror' in m.text) else None)
        await pg.goto('http://localhost:3100/?mode=demo', wait_until='domcontentloaded')
        await pg.evaluate("localStorage.clear();"+SESS); await pg.reload(wait_until='domcontentloaded'); await pg.wait_for_timeout(4000)
        await pg.evaluate("document.querySelector('#go').click()"); await pg.wait_for_function("NC.player && NC.npcs && NC.npcs.length>10 && NC.started", polling=1000)
        await pg.evaluate(CAM); await pg.evaluate("NC.Events.next=1e12; NC.account=NC.account||{}; ")
        await pg.wait_for_function("NC.npcs.filter(n=>n.state==='seated').length>=4", polling=2000, timeout=400000)
        await pg.wait_for_timeout(8000)
        R={}
        R['btns']=await pg.evaluate("[...document.querySelectorAll('#topbtns button')].map(b=>b.id+':'+b.textContent.trim())")
        # 🎂 생일
        await pg.evaluate("NC.Events.ts=3")
        R['bday']=await pg.evaluate("NC.Events.start('bday',true)")
        await pg.evaluate("(()=>{ const E=NC.Events.cur; const t=E.t; window._cam=[t.x+2.4,2.3,t.z+2.8, t.x,.9,t.z]; return E.n.name; })()")
        await pg.wait_for_timeout(5000); await pg.screenshot(path='/tmp/v79s/ev_bday.png')
        await pg.wait_for_function("!NC.Events.cur", polling=500, timeout=400000)
        await pg.screenshot(path='/tmp/v79s/ev_bday_end.png')
        # 🍾 샴페인
        await pg.evaluate("NC.Events.ts=10")
        R['champ']=await pg.evaluate("NC.Events.start('champ',true)")
        if R['champ']:
            await pg.evaluate("(()=>{ const E=NC.Events.cur; const t=E.t; window._cam=[t.x+3.2,2.6,t.z+3.6, t.x,.9,t.z]; })()")
            await pg.wait_for_function("!NC.Events.cur || NC.Events.cur.ph==='show'", polling=500, timeout=400000)
            await pg.evaluate("NC.Events.ts=1")
            await pg.wait_for_timeout(2500); await pg.screenshot(path='/tmp/v79s/ev_champ.png')
            await pg.evaluate("NC.Events.ts=6")
            R['champPh']=await pg.evaluate("NC.Events.cur && NC.Events.cur.ph")
            await pg.wait_for_function("!NC.Events.cur", polling=500, timeout=400000)
            await pg.wait_for_timeout(1500); await pg.screenshot(path='/tmp/v79s/ev_champ_end.png')
            R['waiters']=await pg.evaluate("NC.Escort.list.map(o=>o.title+':'+o.state)")
        # 🎁 럭키
        await pg.evaluate("window._cam=null")
        await pg.evaluate("NC.Events.ts=1")
        R['lucky']=await pg.evaluate("NC.Events.start('lucky',true)")
        await pg.wait_for_timeout(1500); await pg.screenshot(path='/tmp/v79s/ev_lucky_roll.png')
        await pg.wait_for_function("NC.Events.cur && NC.Events.cur.done", polling=300, timeout=400000)
        await pg.wait_for_timeout(1200); await pg.screenshot(path='/tmp/v79s/ev_lucky_win.png')
        await pg.wait_for_function("!NC.Events.cur", polling=500, timeout=400000)
        # 패널
        await pg.evaluate("document.querySelector('#pbEvents').click()"); await pg.wait_for_timeout(1500); await pg.screenshot(path='/tmp/v79s/ev_panel.png')
        R['panel']=await pg.evaluate("document.querySelector('#evPane').innerText.slice(0,300)")
        await pg.evaluate("document.querySelector('#evPane [data-a=x]').click()")
        # 📸
        await pg.evaluate("document.querySelector('#pbPhoto').click()"); await pg.wait_for_timeout(1500)
        R['photo']=await pg.evaluate("({modal:!!document.querySelector('#photoModal'), info:NC.Events.lastPhoto, dl:document.querySelector('#photoModal a').download})")
        await pg.screenshot(path='/tmp/v79s/ev_photo.png')
        R['photoBlank']=await pg.evaluate("""(async()=>{ const img=document.querySelector('#photoModal img'); await img.decode(); const c=document.createElement('canvas'); c.width=80; c.height=50; const x=c.getContext('2d'); x.drawImage(img,0,0,80,50); const d=x.getImageData(0,0,80,50).data; let s=0; for(let i=0;i<d.length;i+=4) s+=d[i]+d[i+1]+d[i+2]; return +(s/(d.length/4)/3).toFixed(1); })()""")
        await pg.evaluate("document.querySelector('#photoModal').remove()")
        # 👑 댄싱 킹/퀸 끝나면 버튼 숨김
        await pg.evaluate("NC.DanceKing.ts=40")
        R['dk']=await pg.evaluate("NC.Events.start('dk',true)")
        await pg.wait_for_timeout(3000); R['dkBarDuring']=await pg.evaluate("document.querySelector('#dkBar').style.display")
        await pg.wait_for_function("!NC.DanceKing.phase", polling=500, timeout=600000)
        await pg.wait_for_timeout(1500)
        R['dkBarAfter']=await pg.evaluate("document.querySelector('#dkBar').style.display"); R['evCur']=await pg.evaluate("!!NC.Events.cur")
        R['winners']=await pg.evaluate("NC.DanceKing.winners")
        R['errors']=errs[:6]; R['logs']=logs[:12]; print(json.dumps(R, ensure_ascii=False, indent=1)); await b.close()
asyncio.run(main())
