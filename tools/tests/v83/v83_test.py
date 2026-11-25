import asyncio, json
from playwright.async_api import async_playwright
SESS = "localStorage.setItem('nc_session', JSON.stringify({uid:'u_test',id:'tester',nickname:'테스터',gender:'남성',characterNo:1,role:'admin'})); localStorage.setItem('nc_adult19','1');"
CAM = "window._cam=null; NC.tickers.push(()=>{ const c=window._cam; if(c){ NC.camera.position.set(c[0],c[1],c[2]); NC.camera.lookAt(c[3],c[4],c[5]); } });"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await (await b.new_context(viewport={'width':1280,'height':680})).new_page(); pg.set_default_timeout(900000)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto('http://localhost:3100/?mode=demo', wait_until='domcontentloaded')
        await pg.evaluate("localStorage.clear();"+SESS); await pg.reload(wait_until='domcontentloaded'); await pg.wait_for_timeout(4000)
        await pg.evaluate("document.querySelector('#go').click()"); await pg.wait_for_function("NC.player && NC.npcs && NC.npcs.length>10 && NC.started", polling=1000)
        await pg.evaluate(CAM); await pg.evaluate("NC.Events.next=1e12")
        await pg.wait_for_function("NC.npcs.filter(n=>n.g&&n.g.userData.real).length>=16 && NC.Stage.dancers.every(d=>d.g.userData.real)", polling=2000, timeout=700000)
        R={}
        # 4) 원형 무대 댄서
        R['dancers']=await pg.evaluate("NC.Stage.dancers.map(d=>{const u=d.g.userData,r=u.real; return u.name+':'+(r&&r.url&&r.url.split('/').pop())+':'+(r&&r._ly||'-')+':'+u.dance;})")
        pd=await pg.evaluate("NC.world.podiums.map(p=>[p.x,p.y,p.z])")
        await pg.evaluate(f"window._cam=[{pd[1][0]}-3.2, 2.6, {pd[1][2]}+3.8, {pd[1][0]}, {pd[1][1]}+.9, {pd[1][2]}]"); await pg.wait_for_timeout(3000); await pg.screenshot(path='/tmp/v83s/podium_R.png')
        await pg.evaluate(f"window._cam=[{pd[0][0]}+3.2, 2.6, {pd[0][2]}+3.8, {pd[0][0]}, {pd[0][1]}+.9, {pd[0][2]}]"); await pg.wait_for_timeout(3000); await pg.screenshot(path='/tmp/v83s/podium_L.png')
        # 3) 의자 골반 위치
        R['seat']=await pg.evaluate("""(()=>{ const out=[]; for (const n of NC.npcs) { const u=n.g.userData, r=u.real; if(!u.seated||!r||!r.Bn||!r.Bn.hips) continue; const h=r.Bn.hips.getWorldPosition(new NC.THREE.Vector3()); out.push([n.name, +Math.hypot(h.x-n.g.position.x, h.z-n.g.position.z).toFixed(3), +h.y.toFixed(2)]); } return out.slice(0,8); })()""")
        await pg.evaluate("(()=>{ const n=NC.npcs.find(n=>n.g.userData.seated&&n.g.userData.real); window._sn=n; const y=n.g.rotation.y; window._cam=[n.x+Math.cos(y)*1.8, 1.1, n.z-Math.sin(y)*1.8, n.x, .6, n.z]; })()"); await pg.wait_for_timeout(3000); await pg.screenshot(path='/tmp/v83s/seat.png')
        await pg.evaluate("window._cam=null")
        # 1) 에스코트·길찾기: 손님을 탁자 건너편으로 보내 도착 여부
        R['goto']=await pg.evaluate("""(async()=>{ const T=NC.tables; const res=[]; const ns=NC.npcs.filter(n=>n.state==='wander'&&n.g.visible&&!n._dk).slice(0,5);
          for (let i=0;i<ns.length;i++){ const n=ns[i], t=T[i%T.length]; n.x=t.x-2.4; n.z=t.z; n.g.position.set(n.x,0,n.z); const to={x:t.x+2.4,z:t.z+.2}; n._arr=false; NC.NPC.goTo(n,to,()=>{n._arr=true; n.state='wander';},2.4); res.push([n,to]); }
          const t0=performance.now(); while(performance.now()-t0<90000 && res.some(([n])=>!n._arr)) await new Promise(r=>setTimeout(r,500));
          return {arrived:res.filter(([n])=>n._arr).length, total:res.length, sec:Math.round((performance.now()-t0)/1000), nav:NC.Nav.stats}; })()""")
        R['escort']=await pg.evaluate("NC.Escort.list.map(o=>o.title+':'+o.state)")
        # 2) 블루스 커플 겹침
        await pg.evaluate("NC.Party.start('blues')")
        await pg.wait_for_function("NC.Party.pairs.filter(p=>p.on).length>=4", polling=1000, timeout=500000)
        await pg.wait_for_timeout(6000)
        R['bluesOverlap']=await pg.evaluate("""(async()=>{ let worst=9, cnt=0; for(let s=0;s<10;s++){ const on=NC.Party.pairs.filter(p=>p.on); for(let i=0;i<on.length;i++) for(let j=i+1;j<on.length;j++) for(const a of [on[i].m,on[i].f]) for(const b of [on[j].m,on[j].f]) { const d=Math.hypot(a.x-b.x,a.z-b.z); worst=Math.min(worst,d); if(d<.45) cnt++; } await new Promise(r=>setTimeout(r,700)); } return {minOtherCouple:+worst.toFixed(2), under45:cnt}; })()""")
        await pg.evaluate("(()=>{ const ps=NC.Party.pairs.filter(p=>p.on); const xs=ps.map(p=>p.m.x), zs=ps.map(p=>p.m.z); const cx=xs.reduce((a,b)=>a+b)/xs.length, cz=zs.reduce((a,b)=>a+b)/zs.length; window._cam=[cx,3.4,cz+6,cx,.8,cz]; })()"); await pg.wait_for_timeout(2500); await pg.screenshot(path='/tmp/v83s/blues.png')
        await pg.evaluate("NC.Party.stop('user'); window._cam=null"); await pg.wait_for_timeout(1500)
        # 5) 대화창 프레이밍
        await pg.evaluate("(()=>{ const P=NC.player; P.x=0; P.z=-3; P.group.position.set(0,0,-3); const n=NC.npcs.find(n=>n.gender==='f'&&n.state==='wander'&&n.g.visible&&n.g.userData.real); n.x=.7; n.z=-3.2; n.g.position.set(.7,0,-3.2); window._dn=n; NC.Dialog.open(n); })()")
        await pg.wait_for_timeout(5000)
        R['frame']=await pg.evaluate("""(()=>{ const P=NC.player, n=window._dn, v=new NC.THREE.Vector3((P.x+n.x)/2, 1.3, (P.z+n.z)/2).project(NC.camera); const gl=document.getElementById('guestList'), dl=document.getElementById('dlg'); return {pairNdcX:+v.x.toFixed(2), freeCenter:+NC.freeCenterX().toFixed(2), guestRight:gl?Math.round(gl.getBoundingClientRect().right):null, dlgLeft:dl?Math.round(dl.getBoundingClientRect().left):null, W:innerWidth}; })()""")
        await pg.screenshot(path='/tmp/v83s/dialog.png')
        R['errors']=errs[:6]; print(json.dumps(R, ensure_ascii=False)); await b.close()
asyncio.run(main())
