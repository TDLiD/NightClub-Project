"""v69 동작별 시험: 실제 UI 버튼 클릭 → 디스패치된 동작 ID 확인 → 접촉 순간 두 사람 자세(실루엣) 기록 → 종료 후 복귀 확인 → 동작끼리 자세 차이(구별 가능성) 계산"""
import asyncio, json, sys, itertools
from playwright.async_api import async_playwright
SESS = "localStorage.setItem('nc_session', JSON.stringify({uid:'u_test',id:'tester',nickname:'테스터',gender:'남성',characterNo:1})); localStorage.setItem('nc_adult19','1');"
PORT = sys.argv[1] if len(sys.argv) > 1 else '3100'; TAG = sys.argv[2] if len(sys.argv) > 2 else 'new'; PIDX = int(sys.argv[3]) if len(sys.argv) > 3 else 0
BTNS0 = [('👂 귓속말','whisper','WHISPER'),('🤲 허리 끌어당기기','waist','WAIST_PULL'),('💫 한 바퀴 돌리기','spin','PARTNER_SPIN'),('💃 뒤로 눕히기(딥)','dip','DANCE_DIP'),('💗 이마 맞대기','forehead','FOREHEAD_TOUCH'),('😚 볼 뽀뽀','cheek','CHEEK_KISS'),('🤗 꼭 안아 주기','hug','FULL_HUG'),('🫂 백허그','backhug','BACK_HUG'),('💋 키스하기','kiss','ROMANTIC_KISS'),('🍑 엉덩이 만지기','butt','AFFECTIONATE_TOUCH'),('🫳 가슴 주물럭거리기','chest','CHEST_TOUCH_OVER_CLOTHING'),('🩲 팬티 내리기','panty','CLOTHING_ADJUSTMENT')]
BTNS = [b for b in BTNS0 if b[1] in (sys.argv[4].split(',') if len(sys.argv)>4 else [x[1] for x in BTNS0])]
DESC = r"""(()=>{ const K=NC.Karaoke, BL=K.BL, P=NC.player, n=window._n, V=()=>new NC.THREE.Vector3(); const ry=BL.baseRy!=null?BL.baseRy:Math.atan2(BL.c.x-P.x+ (n.x-BL.c.x)*0, n.z-P.z); const ax=Math.sin(ry), az=Math.cos(ry), mx=(P.x+n.x)/2, mz=(P.z+n.z)/2;
  const loc=p=>{ const dx=p.x-mx, dz=p.z-mz; return [+(dx*ax+dz*az).toFixed(3), +p.y.toFixed(3), +(-dx*az+dz*ax).toFixed(3)]; }; const out={};
  for (const [nm,g] of [['P',P.group],['N',n.g]]) { const B=g.userData.real.Bn; for (const k of ['head','handL','handR','hips','laL','laR']) out[nm+'.'+k]=loc(B[k].getWorldPosition(V())); const f=new NC.THREE.Vector3(0,0,1).applyQuaternion(g.quaternion); out[nm+'.fwd']=[+(f.x*ax+f.z*az).toFixed(2), +f.y.toFixed(2), +(-f.x*az+f.z*ax).toFixed(2)]; }
  { const ad=P.group.userData.armDbg||{}; for (const sd of ['L','R']) if (ad[sd]) { out['P.tgt'+sd]=loc(ad[sd].tgt); out['P.w'+sd]=[+ad[sd].w.toFixed(2),0,0]; } const ad2=n.g.userData.armDbg||{}; for (const sd of ['L','R']) if (ad2[sd]) out['N.tgt'+sd]=loc(ad2[sd].tgt); }
  out.dist=+Math.hypot(P.x-n.x,P.z-n.z).toFixed(3); return out; })()"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await (await b.new_context(viewport={'width':560,'height':560})).new_page(); pg.set_default_timeout(1200000)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto(f'http://localhost:{PORT}/?mode=demo', wait_until='domcontentloaded')
        await pg.evaluate("localStorage.clear();"+SESS); await pg.reload(wait_until='domcontentloaded'); await pg.wait_for_timeout(4000)
        await pg.evaluate("document.querySelector('#go').click()"); await pg.wait_for_function("NC.player && NC.npcs && NC.npcs.length>=6", timeout=600000)
        await pg.evaluate("""(()=>{ const L=NC.npcs.filter(n=>n.g.visible&&n.state==='wander'&&n.gender==='f'); const n=L[%d]; window._n=n; const P=NC.player; P.x=0; P.z=4; P.group.position.set(0,0,4); n.x=.7; n.z=4; n.g.position.set(.7,0,4); NC.npcs.forEach(o=>{ if(o!==n) o.cool=999; }); })()""" % PIDX)
        await pg.wait_for_function("window._n.g.userData.real&&!window._n.g.userData.real.pending&&NC.player.group.userData.real&&!NC.player.group.userData.real.pending", timeout=900000, polling=2000)
        await pg.add_script_tag(content=open('../v68/vclock.js').read())
        await pg.evaluate("(()=>{ const a0=performance.now()/1000; Object.defineProperty(BaseAudioContext.prototype,'currentTime',{get(){ return performance.now()/1000-a0; }, configurable:true}); })()")
        await pg.evaluate("""(()=>{ const n=window._n, K=NC.Karaoke; n.state='wander'; n.aff=100; n.bl={kissed:true,warned:0}; NC.Dialog.open(n); K.startBlues(n);
          window._tr=[]; NC.tickers.push(()=>{ const BL=NC.Karaoke.BL; if(!BL.act||!BL.n) return; const P=NC.player, g=BL.n.g; const e=new NC.THREE.Euler().setFromQuaternion(g.quaternion,'YXZ'); window._tr.push([+((performance.now()-BL.act.t0)/1000).toFixed(2), +Math.hypot(P.x-BL.n.x,P.z-BL.n.z).toFixed(3), +e.y.toFixed(3), +e.x.toFixed(3), BL.act.k]); });
          window._cam={on:0,a:0}; NC.tickers.push(()=>{ const c=window._cam; if(!c.on) return; const BL=NC.Karaoke.BL; if(!BL.n) return; const P=NC.player; const cx=(P.x+BL.n.x)/2, cz=(P.z+BL.n.z)/2; const ry=BL.baseRy||0, ax=Math.sin(ry), az=Math.cos(ry), px=-az, pz=ax; const s=c.a;
            NC.camera.position.set(cx+px*2.9*Math.cos(s)+ax*2.9*Math.sin(s), 1.25, cz+pz*2.9*Math.cos(s)+az*2.9*Math.sin(s)); NC.camera.lookAt(cx,.92,cz); }); })()""")
        await pg.wait_for_function("NC.Karaoke.BL.n && NC.Karaoke.BL.t>3", polling=500)
        await pg.add_style_tag(content="body *:not(canvas){visibility:hidden !important} canvas{visibility:visible !important}")
        res = {'hold': {'desc': await pg.evaluate(DESC)}}
        for label, kind, wantId in BTNS:
            await pg.wait_for_function("!NC.Karaoke.BL.busy", polling=300)
            clicked = await pg.evaluate(f"""(()=>{{ const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==={json.dumps(label)}); if(!b) return 'NO BUTTON'; b.click(); return 'clicked'; }})()""")
            r = {'click': clicked}
            if clicked != 'clicked': res[kind]=r; print(kind, r, flush=True); continue
            r['dispatch'] = await pg.evaluate("(()=>{ const K=NC.Karaoke, DL=K.dispatchLog||[], L=DL[DL.length-1]||null, BL=K.BL; return {log:L, actK:BL.act&&BL.act.k, actId:BL.act&&BL.act.id, Pk:NC.player.group.userData.bAct&&NC.player.group.userData.bAct.k, Nk:window._n.g.userData.bAct&&window._n.g.userData.bAct.k, out:window._n.g.userData.bAct&&window._n.g.userData.bAct.out}; })()")
            await pg.wait_for_function("NC.Karaoke.BL.act && (performance.now()-NC.Karaoke.BL.act.t0)/1000 > (NC.Karaoke.BL.act.k==='spin'? NC.Karaoke.BL.act.hit-.3 : NC.Karaoke.BL.act.hit+.6)", polling=100)
            await pg.evaluate("window._vpause=true"); r['desc'] = await pg.evaluate(DESC)
            await pg.evaluate("window._cam.on=1; window._cam.a=0; window._vpause=false"); await pg.wait_for_timeout(200); await pg.evaluate("window._vpause=true")
            await pg.screenshot(path=f'./shots_{TAG}_{kind}_side.png')
            await pg.evaluate("window._cam.a=1.15; window._vpause=false"); await pg.wait_for_timeout(200); await pg.evaluate("window._vpause=true"); await pg.screenshot(path=f'./shots_{TAG}_{kind}_q.png')
            await pg.evaluate("window._cam.on=0; window._vpause=false")
            await pg.wait_for_function("!NC.Karaoke.BL.busy", polling=300)
            await pg.evaluate("window._wt=performance.now()+1200"); await pg.wait_for_function("performance.now()>window._wt", polling=300)
            r['after'] = await pg.evaluate("(()=>{ const P=NC.player.group, n=window._n.g; return {Pb:!!P.userData.bAct, Nb:!!n.userData.bAct, Ptilt:+Math.hypot(P.rotation.x,P.rotation.z).toFixed(3), Ntilt:+Math.hypot(n.rotation.x,n.rotation.z).toFixed(3), blues:!!NC.Karaoke.BL.n, dist:+Math.hypot(NC.player.x-window._n.x,NC.player.z-window._n.z).toFixed(3)}; })()")
            tr = await pg.evaluate("window._tr.splice(0)"); import math
            ys=[t[2] for t in tr]; tot=0
            for i in range(1,len(ys)):
                dy=(ys[i]-ys[i-1]+math.pi)%(2*math.pi)-math.pi; tot+=dy
            r['traj']={'dmin':min(t[1] for t in tr) if tr else None,'dmax':max(t[1] for t in tr) if tr else None,'yawTotalDeg':round(math.degrees(tot)),'yawMaxDevDeg':round(math.degrees(max(abs((y-ys[0]+math.pi)%(2*math.pi)-math.pi) for y in ys))) if ys else None,'pitchMinDeg':round(math.degrees(min(t[3] for t in tr))) if tr else None}
            r['ok_dispatch'] = r['dispatch']['actId'] == wantId or r['dispatch']['actK'] in (kind, 'undress'); res[kind] = r
            print(kind, json.dumps({k:v for k,v in r.items() if k!='desc'}, ensure_ascii=False), flush=True)
        json.dump(res, open(f'./actions_{TAG}_{PIDX}.json','w'), ensure_ascii=False)
        print('errors', errs[:5]); await b.close()
asyncio.run(main())
