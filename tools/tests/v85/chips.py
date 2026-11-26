from h import *
import re, time
CTX = sys.argv[1] if len(sys.argv)>1 else 'club_talk'
RESET = r"""(async ()=>{ const K=NC.Karaoke, D=NC.Dialog, P=NC.player, n=window._k;
  document.querySelectorAll('.modal,.ncModal,#modal').forEach(m=>{ const b=m.querySelector('button'); if(b) b.click(); });
  try{ NC.ui.hideDlg && NC.ui.hideDlg(); }catch(e){}
  if(K.BL.n) K.endBlues('stop'); if(D.cur) D.close('bye'); if(NC.PairWalk.n) NC.PairWalk.stop(false); K.BL.lead=null;
  if(NC.Motel && NC.Motel.on && NC.Motel.end) try{ NC.Motel.end(); }catch(e){}
  if(NC.Outside && NC.Outside.KS && NC.Outside.KS.on && NC.Outside.stop) try{ NC.Outside.stop(); }catch(e){}
  const wantRoom = window._ctx.startsWith('room');
  if(K.inRoom && !wantRoom) { K.leave(); await new Promise(r=>setTimeout(r,2500)); }
  if(!K.inRoom && wantRoom) { K.enter({comp:n}); await new Promise(r=>setTimeout(r,3500)); }
  P.busy=false; P.target=null; P.autoPath=null; if(P.seat) NC.requestStand();
  n.aff=100; n.bl=n.bl||{kissed:true,warned:0}; n.bl.kissed=true; n.bl.warned=0; n.leftRoom=false; n.ended=false;
  if(!wantRoom){ const x=window._ctx==='club_blues'?0:-14, z=window._ctx==='club_blues'?-7:0; P.x=x; P.z=z; P.group.position.set(x,0,z); P.y=0; n.state='wander'; n.x=x+.6; n.z=z+.2; n.g.position.set(n.x,0,n.z); n.g.visible=true; }
  await new Promise(r=>setTimeout(r,600));
  D.open(n); await new Promise(r=>setTimeout(r,500));
  if(window._ctx.endsWith('blues')){ K.startBlues(n,{here:true}); await new Promise(r=>setTimeout(r,2500)); if(!D.cur) D.open(n); D.chips(); }
  return [...document.querySelectorAll('#tChips button')].map(b=>b.textContent.trim()); })()"""
SNAP = """(()=>{ const K=NC.Karaoke; return {log:document.querySelectorAll('#tLog > *').length, dlg:!!NC.Dialog.cur, bl:!!K.BL.n, busy:!!K.BL.busy, act:K.BL.act&&K.BL.act.btn, disp:K.dispatchLog.length?K.dispatchLog[K.dispatchLog.length-1]:null, room:!!K.inRoom, pw:!!NC.PairWalk.n, zone:NC.player.zone, toast:(document.querySelector('#toast,.toast')||{}).textContent||'', modal:!!document.querySelector('.modal:not([style*=\"none\"]),#modal:not([style*=\"none\"])'), coins:NC.Wallet.get(), aff:window._k.aff, nstate:window._k.state, motel:!!(NC.Motel&&NC.Motel.on)}; })()"""
async def main():
    async with async_playwright() as p:
        b,pg,errs = await boot(p,640,420)
        cerr=[]; pg.on('console', lambda m: cerr.append(m.text[:200]) if m.type=='error' and 'firebase' not in m.text.lower() and 'net::' not in m.text and 'Failed to load' not in m.text else None)
        await pg.evaluate(f"(()=>{{ const n={GIRL}; window._k=n; window._ctx='{CTX}'; NC.account=NC.account||{{uid:'u_test'}}; NC.Wallet.add(5000,'test'); }})()")
        labels = await pg.evaluate(RESET)
        res=[]; skip=re.compile(r'조명|👋 일어날게요|브루스 그만|동작 멈추기')
        done=set()
        for lab in labels:
            if skip.search(lab) or lab in done: continue
            done.add(lab)
            cur = await pg.evaluate(RESET)
            if lab not in cur:
                res.append([lab,'MISSING']); continue
            e0=len(errs); c0=len(cerr); s0=await pg.evaluate(SNAP)
            await pg.evaluate("(l=>{ const b=[...document.querySelectorAll('#tChips button')].find(b=>b.textContent.trim()===l); b&&b.click(); })", lab)
            await pg.wait_for_timeout(2800)
            # 모달 자동 확인
            await pg.evaluate("document.querySelectorAll('.modal button, #modal button').forEach((b,i)=>{ if(i===0) b.click(); })")
            await pg.wait_for_timeout(600)
            s1=await pg.evaluate(SNAP)
            diff={k:[s0[k],s1[k]] for k in s0 if s0[k]!=s1[k] and k not in ('log',)}
            r=[lab, s1['log']-s0['log'], diff, errs[e0:], cerr[c0:]]
            res.append(r); print(json.dumps(r, ensure_ascii=False), flush=True)
        out({'ctx':CTX,'n':len(res),'errs':errs})
        await b.close()
asyncio.run(main())
