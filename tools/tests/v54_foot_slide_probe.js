((v, style) => { const T=NC.THREE, RH=NC.RealHuman; const r = RH.list.filter(r=>r.mc&&!r.mc.dead&&r.u.mBase==='walk'&&r.mc.w>.9)[0]; if(!r) return 'none';
  const u=r.u, keep=r.root.position.clone(), ws=u.walkStyle; if (style!==undefined) u.walkStyle=style; r.mcForce=null; const dt=1/30, ry=r.root.rotation.y, dir=new T.Vector3(Math.sin(ry),0,Math.cos(ry));
  const toeL=r.mc.B.get('Bip01_L_Toe0'), toeR=r.mc.B.get('Bip01_R_Toe0'); const a=new T.Vector3(), b=new T.Vector3(), ta=new T.Vector3(), tb=new T.Vector3(); let last=null, n=0, slide=0, tslide=0, warm=45;
  for (let i=0;i<warm+150;i++){ u.moving=true; u.mBase='walk'; r.root.position.addScaledVector(dir, v*dt); r.root.updateMatrixWorld(true); RH._apply(r, dt);
    r.Bn.footL.getWorldPosition(a); r.Bn.footR.getWorldPosition(b); toeL.getWorldPosition(ta); toeR.getWorldPosition(tb);
    const side=Math.min(a.y,ta.y)<Math.min(b.y,tb.y)?'L':'R', p=(side==='L'?a:b).clone(), t=(side==='L'?ta:tb).clone();
    const gy=r.root.position.y, cont=Math.min(p.y,t.y)-gy<.14*r.mc.L; if (i>=warm && last && last.side===side && cont) { slide+=Math.hypot(p.x-last.p.x,p.z-last.p.z)/dt; tslide+=Math.min(Math.hypot(t.x-last.t.x,t.z-last.t.z), Math.hypot(p.x-last.p.x,p.z-last.p.z))/dt; n++; } last={side,p,t}; }
  const top=r.mc.layers[r.mc.layers.length-1]; const out={who:u.name, v, clip:top.name, rate:+(v/((RH.MC.meta.clips[top.name].speed)*r.mc.L)).toFixed(2), ankleStance:+(slide/n).toFixed(3), contactPointStance:+(tslide/n).toFixed(3)};
  r.root.position.copy(keep); u.walkStyle=ws; return out; })
