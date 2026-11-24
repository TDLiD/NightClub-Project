"""v73 접촉 3동작(🍑 엉덩이 · 🫳 가슴 위 · 🩲 허리춤) — 실제 버튼 클릭 → 접촉 순간 일시정지 → 옷감 변형 켬/끔 비교 캡처 + 손-몸 거리·변형량 기록"""
import asyncio, json, sys
from playwright.async_api import async_playwright
SESS = "localStorage.setItem('nc_session', JSON.stringify({uid:'u_test',id:'tester',nickname:'테스터',gender:'남성',characterNo:1})); localStorage.setItem('nc_adult19','1');"
BTNS = [('🍑 엉덩이 만지기','butt'),('🫳 가슴 주물럭거리기','chest'),('🩲 허리춤 매만지기','panty')]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await (await b.new_context(viewport={'width':520,'height':520})).new_page(); pg.set_default_timeout(900000)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto('http://localhost:3100/?mode=demo', wait_until='domcontentloaded')
        await pg.evaluate("localStorage.clear();"+SESS); await pg.reload(wait_until='domcontentloaded'); await pg.wait_for_timeout(4000)
        await pg.evaluate("document.querySelector('#go').click()"); await pg.wait_for_function("NC.player && NC.npcs && NC.npcs.length>=6", timeout=600000)
        await pg.evaluate("""(()=>{ const n=NC.NPC.byId('harin')||NC.npcs.find(n=>n.gender==='f'&&n.g.visible); window._n=n; const P=NC.player; P.x=0; P.z=4; P.group.position.set(0,0,4); n.x=.7; n.z=4; n.g.position.set(.7,0,4); })()""")
        await pg.wait_for_function("window._n.g.userData.real&&!window._n.g.userData.real.pending&&NC.player.group.userData.real&&!NC.player.group.userData.real.pending", polling=2000)
        await pg.add_script_tag(content=open('/home/claude/tests/vclock.js').read())
        await pg.evaluate("(()=>{ const a0=performance.now()/1000; Object.defineProperty(BaseAudioContext.prototype,'currentTime',{get(){ return performance.now()/1000-a0; }, configurable:true}); })()")
        await pg.evaluate("""(()=>{ const n=window._n, K=NC.Karaoke; n.state='wander'; n.aff=100; n.bl={kissed:true,warned:0}; NC.Dialog.open(n); K.startBlues(n);
          window._cam=null; NC.tickers.push(()=>{ const c=window._cam; if(!c) return; const g=window._n.g, r=g.userData.real; if(!r||!r.Bn) return; const h=r.Bn.hips.getWorldPosition(new NC.THREE.Vector3()); const P=NC.player; const ax=h.x-P.x, az=h.z-P.z, L=Math.hypot(ax,az)||1; const sx=-az/L, sz=ax/L;
            NC.camera.position.set(h.x + sx*c[0] + ax/L*c[1], h.y + c[2], h.z + sz*c[0] + az/L*c[1]); NC.camera.lookAt(h.x, h.y + c[3], h.z); }); })()""")
        await pg.wait_for_function("NC.Karaoke.BL.n && NC.Karaoke.BL.t>3", polling=500)
        await pg.add_style_tag(content="body *:not(canvas){visibility:hidden !important} canvas{visibility:visible !important}")
        res={}
        for label,kind in BTNS:
            await pg.wait_for_function("!NC.Karaoke.BL.busy", polling=300)
            await pg.add_style_tag(content="body *:not(canvas){visibility:visible !important}")
            clicked = await pg.evaluate(f"""(()=>{{ NC.Dialog.chips && NC.Dialog.chips(); const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==={json.dumps(label)}); if(!b) return 'NO BUTTON'; b.click(); return 'clicked'; }})()""")
            await pg.add_style_tag(content="body *:not(canvas){visibility:hidden !important} canvas{visibility:visible !important}")
            r={'click':clicked}
            if clicked!='clicked': res[kind]=r; print(kind,r,flush=True); continue
            await pg.wait_for_function("NC.Karaoke.BL.act && (performance.now()-NC.Karaoke.BL.act.t0)/1000 > NC.Karaoke.BL.act.hit+.55", polling=100)
            await pg.evaluate("window._vpause=true")
            cam = {'butt':[.0,1.0,.05,0],'chest':[.55,-.5,.36,.3],'panty':[.5,-.55,.1,.06]}[kind]
            await pg.evaluate(f"window._cam={json.dumps(cam)}; window._vpause=false"); await pg.wait_for_timeout(150); await pg.evaluate("window._vpause=true"); await pg.wait_for_timeout(700)
            r['m']=await pg.evaluate("""(()=>{ const n=window._n, u=n.g.userData, cu=(u._contact||[])[0], K=NC.Karaoke, ad=NC.player.group.userData.armDbg||{}; const RH=NC.RealHuman; const o={id:K.BL.act&&K.ACTIONS&&K.BL.act.k, out:u.bAct&&u.bAct.out, ctW:NC.ClothTouch.ST.w.slice(), err:NC.ClothTouch.ST.err||null};
               if(cu&&cu.uCt){ o.uR=cu.uCt.value.map(v=>+v.w.toFixed(4)); o.uV=cu.uCv.value.map(v=>+v.length().toFixed(5)); }
               for (const sd of ['L','R']) { const d=ad[sd]; if(d&&d.w>.05){ o['w'+sd]=+d.w.toFixed(2); try{ o['norm'+sd]=+RH.norm(n.g, d.tgt).toFixed(3); }catch(e){} } }
               return o; })()""")
            await pg.screenshot(path=f'/tmp/v73s/{kind}_on.png')
            await pg.evaluate("NC.ClothTouch.disabled=true"); await pg.wait_for_timeout(900)
            await pg.screenshot(path=f'/tmp/v73s/{kind}_off.png')
            await pg.evaluate("NC.ClothTouch.disabled=false; window._cam=null; window._vpause=false")
            await pg.wait_for_function("!NC.Karaoke.BL.busy", polling=300)
            r['after']=await pg.evaluate("(()=>{ const cu=(window._n.g.userData._contact||[])[0]; return cu&&cu.uCt? cu.uCt.value.map(v=>v.w):null; })()")
            res[kind]=r; print(kind, json.dumps(r, ensure_ascii=False), flush=True)
        print('errors', errs[:5]); await b.close()
asyncio.run(main())
