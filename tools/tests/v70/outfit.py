"""v70 시험: 의상 세트(OUT_<세트>_…) 갈아입기 · manifest no19 → 블루스 19+ 칩/모텔 19+ 패널 숨김 — 실제 앱에서 확인"""
import asyncio, json
from playwright.async_api import async_playwright
SESS = "localStorage.setItem('nc_session', JSON.stringify({uid:'u_test',id:'tester',nickname:'테스터',gender:'남성',characterNo:1})); localStorage.setItem('nc_adult19','1');"
CHIPS = "(()=>[...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(t=>/엉덩이|가슴 주물|팬티|19\\+ 스킨십/.test(t)))()"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await (await b.new_context(viewport={'width':560,'height':560})).new_page(); pg.set_default_timeout(1200000)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto('http://localhost:3100/?mode=demo', wait_until='domcontentloaded')
        await pg.evaluate("localStorage.clear();"+SESS); await pg.reload(wait_until='domcontentloaded'); await pg.wait_for_timeout(4000)
        await pg.evaluate("document.querySelector('#go').click()"); await pg.wait_for_function("NC.player && NC.npcs && NC.npcs.length>=6", timeout=600000)
        R = {'version': await pg.evaluate("NC.VERSION || (NC.cfg&&NC.cfg.VERSION) || document.title")}
        await pg.evaluate("""(()=>{ const L=NC.npcs.filter(n=>n.g.visible&&n.state==='wander'&&n.gender==='f'); const n=L[0]; window._n=n; const P=NC.player; P.x=0; P.z=4; P.group.position.set(0,0,4); n.x=.7; n.z=4; n.g.position.set(.7,0,4); })()""")
        await pg.wait_for_function("window._n.g.userData.real&&!window._n.g.userData.real.pending", timeout=900000, polling=2000)
        R['model'] = await pg.evaluate("(()=>{ const RH=NC.RealHuman, m=RH.modelOfRoot(window._n.g); return m&&m.id })()")
        # 1) 의상: 실제 모델에 두 벌 더미 메시(몸 뼈에 붙인 상자)를 OUT_ 이름으로 붙여 갈아입기 확인 — 다중 재질(그룹 이름) 경우도 포함
        R['outfit'] = await pg.evaluate("""(()=>{ const T=NC.THREE, RH=NC.RealHuman, g=window._n.g, r=g.userData.real, B=r.Bn;
          const mk=(nm,col,y)=>{ const m=new T.Mesh(new T.BoxGeometry(.42,.34,.3), new T.MeshBasicMaterial({color:col})); m.name=nm; return m; };
          const a=mk('OUT_concert_tank',0xffffff), bb=new T.Group(); bb.name='OUT_casual_hoodie'; const b1=mk('', 0x1b2a55), b2=mk('',0xd8c6a0); b2.scale.set(1.05,.5,1.05); b2.position.y=-.1; bb.add(b1,b2);
          window._oa=a; window._ob=b1; const host=(B.chest||B.spine), ws=host.getWorldScale(new T.Vector3()); for (const o of [a,bb]) { o.scale.multiply(new T.Vector3(1/ws.x,1/ws.y,1/ws.z)); host.add(o); }
          const vis=()=>({concert:a.visible, casual:[b1.visible,b2.visible]}); const out={sets:RH.outfits(g)};
          out.toConcert=RH.setOutfit(g,'concert'); out.afterConcert=vis(); out.toCasual=RH.setOutfit(g,'casual'); out.afterCasual=vis();
          out.bad=RH.setOutfit(g,'nonexistent'); out.afterBad=vis(); out.uOutfit=g.userData.outfit; return out; })()""")
        # 2) 화면으로 확인 — 두 벌 각각 스크린샷
        await pg.evaluate("(()=>{ const n=window._n; NC.camera.position.set(n.x, 1.3, n.z+2.2); NC.camera.lookAt(n.x,1.1,n.z); window._camLock=NC.tickers.push(()=>{ NC.camera.position.set(window._n.x, 1.3, window._n.z+2.2); NC.camera.lookAt(window._n.x,1.1,window._n.z); }); })()")
        await pg.add_style_tag(content="body *:not(canvas){visibility:hidden !important} canvas{visibility:visible !important}")
        for k in ('concert','casual'):
            await pg.evaluate(f"NC.RealHuman.setOutfit(window._n.g,'{k}')"); await pg.wait_for_timeout(600); await pg.screenshot(path=f'/tmp/v70s/outfit_{k}.png'); print(k, await pg.evaluate("(()=>{ const r=window._n.g.userData.real; let inModel=false; r.model.traverse(o=>{ if(o===window._oa) inModel=true; }); return {a:window._oa.visible, b:window._ob.visible, inModel, url:r.url, outfit:window._n.g.userData.outfit}; })()"), flush=True)
        await pg.add_style_tag(content="body *:not(canvas){visibility:visible !important}")
        # 3) no19: 블루스 시작 → 19+ 칩 보임 → 그 모델에 no19 → 칩 사라짐 + 버튼 경로 차단
        await pg.evaluate("(()=>{ const n=window._n, K=NC.Karaoke; n.state='wander'; n.aff=100; n.bl={kissed:true,warned:0}; NC.Dialog.open(n); K.startBlues(n); })()")
        await pg.wait_for_function("NC.Karaoke.BL.n && NC.Karaoke.BL.t>2", polling=500)
        await pg.evaluate("NC.Dialog.chips()"); await pg.wait_for_timeout(300); R['chips19_before'] = await pg.evaluate(CHIPS)
        await pg.evaluate("(()=>{ const m=NC.RealHuman.modelOfRoot(window._n.g); m.no19=true; NC.Dialog.chips(); })()"); await pg.wait_for_timeout(300)
        R['no19'] = await pg.evaluate("NC.RealHuman.no19(window._n.g)"); R['chips19_after'] = await pg.evaluate(CHIPS)
        R['normal_chips_after'] = await pg.evaluate("[...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(t=>/귓속말|키스하기|브루스 그만/.test(t))")
        # 다른 여성 NPC(no19 아님)는 영향 없음
        R['other_no19'] = await pg.evaluate("(()=>{ const RH=NC.RealHuman, me=RH.modelOfRoot(window._n.g); const o=NC.npcs.find(x=>x!==window._n&&x.gender==='f'&&x.g.userData.real&&!x.g.userData.real.pending&&RH.modelOfRoot(x.g)!==me); return o? RH.no19(o.g) : 'none-loaded'; })()")
        # 4) 모텔 19+ 패널: 같은 상대를 객실 상대로 두고 패널 HTML 확인
        R['motel'] = await pg.evaluate("""(()=>{ const S=NC.Motel; if(!S||!S.extPanel) return 'no motel'; const s0=S.step, n0=S.n; S.step='room'; S.n=window._n; const on=S.extPanel(); const m=NC.RealHuman.modelOfRoot(window._n.g); m.no19=false; const off=S.extPanel(); m.no19=true; S.step=s0; S.n=n0; return {no19_panelLen:on.length, normal_panelHas19: /19\\+/.test(off)}; })()""")
        R['errors']=errs[:5]; print(json.dumps(R, ensure_ascii=False, indent=1)); json.dump(R, open('/home/claude/tests/v70/outfit.json','w'), ensure_ascii=False); await b.close()
asyncio.run(main())
