from h import *
import re
ONLY = sys.argv[1] if len(sys.argv)>1 else ''
ENTER = """(async()=>{ const S=NC.Motel, n=%s; window._k=n; n.aff=100; S.n=n; S.hotel={name:'테스트',k:1,id:'t'}; S.cat='%s'; S.stay='night'; S.step='corr'; S.busy=false; S.on=true; S.comfort=95; await S._x.enterRoom(); })()"""
SN = """(()=>{ const S=NC.Motel, Z=S.x19.Z, p=NC.player, n=S.n||{g:{rotation:{x:0},position:{y:0},userData:{},visible:false},x:0,z:0,state:"NULL"}, X=S._x; const inR=(x,z)=>Math.abs(x-X.BX)<X.RHX+.05&&Math.abs(z-90)<X.RHZ+.05; return {lie:!!Z.lie, run:!!Z.running, busy:!!S.busy, step:S.step, pseat:!!p.seat, pS:!!p.group.userData.seated, ns:n.state, nS:!!n.g.userData.seated, prx:+p.group.rotation.x.toFixed(2), nrx:+n.g.rotation.x.toFixed(2), py:+p.group.position.y.toFixed(2), ny:+n.g.position.y.toFixed(2), pin:inR(p.x,p.z), nin:inR(n.x,n.z), nvis:n.g.visible, out:[Z.out.me,Z.out.n], wear:[Z.wear.me,Z.wear.n], modal:!!document.querySelector('#modal:not([style*="none"]) button, .modal button'), pbusy:!!p.busy, bl:!!(NC.Karaoke.BL.n), duvet:X.RV.duvet?X.RV.duvet.visible:null}; })()"""
async def main():
    async with async_playwright() as p:
        b,pg,errs = await boot(p,560,380)
        cerr=[]; pg.on('console', lambda m: cerr.append(m.text[:200]) if m.type=='error' and 'net::' not in m.text and 'Failed to load' not in m.text and 'firebase' not in m.text.lower() else None)
        await pg.evaluate(ENTER % (GIRL, 'jac'))
        await pg.wait_for_function("NC.Motel.step==='room' && !NC.Motel.busy", polling=500, timeout=300000)
        await pg.evaluate("NC.Motel.x19.Z.adult=true; NC.Wallet.add(5000,'t')")
        await pg.evaluate("""(()=>{ const n=NC.Motel.n; window._jump=[]; for(const k of ['x']){ let v=n[k]; Object.defineProperty(n,k,{configurable:true,get(){return v},set(nv){ if(Math.abs(nv-v)>30) window._jump.push([+v.toFixed(1),+nv.toFixed(1), new Error().stack.split('\\n').slice(2,6).map(l=>l.trim().replace(/https?:\\/\\/[^/]+\\/js\\//,'').slice(0,80)).join(' < ')]); v=nv; }}); } })()""")
        await pg.evaluate("document.querySelector('#mActs').click()"); await pg.wait_for_timeout(500)
        ids = await pg.evaluate("[...document.querySelectorAll('#motelPanel button[data-a]')].map(b=>[b.dataset.a,b.textContent.trim()])")
        await pg.evaluate("document.querySelector('#motelPanel').style.display='none'")
        skip = re.compile(r'^(_close|x19adult|leave|sleep|upgrade|extend)$')
        res=[]
        for aid,lab in ids:
            if skip.search(aid) or (ONLY and not re.search(ONLY, aid)): continue
            e0=len(errs); c0=len(cerr)
            await pg.evaluate("(()=>{ const S=NC.Motel; S.comfort=95; S.n.aff=100; S.lastNo=null; S.pressure=0; S.x19.Z.paused=false; })()")
            await pg.evaluate("document.querySelector('#mActs').click()"); await pg.wait_for_timeout(300)
            ok = await pg.evaluate("(a=>{ const b=document.querySelector(`#motelPanel button[data-a=\"${a}\"]`); if(!b) return false; b.click(); return true; })", aid)
            if not ok: res.append([aid,lab,'NOBTN']); print(json.dumps(res[-1],ensure_ascii=False),flush=True); continue
            mods=[]
            for i in range(60):
                await pg.wait_for_timeout(700)
                m = await pg.evaluate("(()=>{ const bs=[...document.querySelectorAll('#modal button, .modal button')].filter(b=>b.offsetParent); if(!bs.length) return null; const t=bs.map(b=>b.textContent.trim()); const pick=bs.find(b=>!/취소|아니|그만|닫기|나중|cancel/i.test(b.textContent))||bs[0]; pick.click(); return t.slice(0,4).join('|'); })()")
                if m: mods.append(m[:60])
                st = await pg.evaluate("[!!NC.Motel.x19.Z.running, !!NC.Motel.busy]")
                if not st[0] and not st[1] and i>=3: break
            s1 = await pg.evaluate(SN)
            await pg.screenshot(path=f'/tmp/v86s/a_{aid}.png')
            await pg.evaluate("document.querySelector('#mStop').click()"); await pg.wait_for_timeout(1800)
            s2 = await pg.evaluate(SN)
            bad=[]
            if not s1['pin'] or not s1['nin']: bad.append('OUT_OF_ROOM')
            if s2['lie'] or abs(s2['prx'])>.05 or abs(s2['nrx'])>.05: bad.append('STILL_LYING_AFTER_STOP')
            if s2['py']>.7 and not s2['pS']: bad.append('P_FLOAT')
            if s2['ny']>.7 and not s2['nS']: bad.append('N_FLOAT')
            if s1['run'] or s1['busy']: bad.append('TIMEOUT')
            if s2['pbusy']: bad.append('P_BUSY')
            if s2['pseat'] != s2['pS']: bad.append('SEAT_MISMATCH')
            if not s2['nvis']: bad.append('N_HIDDEN')
            r=[aid,lab,bad,errs[e0:],cerr[c0:],mods[:4],{k:s1[k] for k in ('pin','nin','py','ny')},{k:s2[k] for k in ('py','ny','pS')},await pg.evaluate('[NC.player.x-NC.Motel._x.BX,NC.player.z-90,(NC.Motel.n||{x:0}).x-NC.Motel._x.BX,(NC.Motel.n||{z:0}).z-90,NC.player.y].map(v=>+v.toFixed(2))'),{k:s1[k] for k in ('lie','ns','out','wear','bl')},{k:s2[k] for k in ('ns','pS','nS','out','duvet')}]
            res.append(r); print(json.dumps(r,ensure_ascii=False),flush=True)
            j=await pg.evaluate('window._jump.splice(0)')
            if j: print('JUMP', aid, json.dumps(j, ensure_ascii=False), flush=True)
            if s2['step']!='room': print('LEFT ROOM', s2['step']); break
        out({'n':len(res),'bad':[r[0] for r in res if len(r)>2 and (r[2] if isinstance(r[2],list) else True) or (len(r)>3 and (r[3] or r[4]))]})
        await b.close()
asyncio.run(main())
