(function () {
  'use strict';
  const T = Starfall.THEME = {
    navy: '#070B18', steel: '#24334A', ivory: '#E8EDF2', cyan: '#56E7F2',
    coral: '#FF625A', amber: '#FFC66D', muted: '#456078',
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)')
  };
  T.poly = function (c, points, fill, stroke) {
    c.beginPath(); points.forEach(([x,y],i) => i ? c.lineTo(x,y) : c.moveTo(x,y));
    c.closePath(); c.fillStyle = fill; c.fill();
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke(); }
  };
  T.disc = function(c,x,y,r,color) { c.fillStyle=color; c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill(); };
  T.ship = function(c,kind,time,weak) {
    const p=T.poly, metal=T.steel, edge=T.muted;
    if (kind === 'player') {
      for (const s of [-1,1]) {
        p(c,[[s*5,-12],[s*23,-20],[s*21,-5],[s*8,7]],T.ivory,edge);
        p(c,[[s*7,3],[s*24,9],[s*22,18],[s*7,13]],'#9BAFBF',edge);
        c.fillStyle=T.ivory; c.fillRect(s*19-2,-24,4,29);
        c.fillStyle=T.coral; c.fillRect(s*19-2,-7,4,4);
        c.fillStyle=T.cyan; c.fillRect(s*9-2,15,4,T.reducedMotion.matches?10:10+Math.sin(time*24)*3);
      }
      p(c,[[0,-27],[6,-9],[7,18],[0,21],[-7,18],[-6,-9]],T.ivory,edge);
      p(c,[[0,-16],[3,-6],[3,4],[-3,4],[-3,-6]],T.navy,T.cyan);
      c.fillStyle=edge; c.fillRect(-3,9,6,2);
    } else if (kind === 'scout') {
      for(const s of [-1,1]) p(c,[[s*10,-14],[s*17,-12],[s*17,13],[s*10,15]],metal,T.coral);
      c.fillStyle=edge; c.fillRect(-12,-3,24,5); T.disc(c,0,1,7,metal); T.disc(c,0,2,3,T.coral);
    } else if (kind === 'zigzag') {
      p(c,[[-21,-12],[-13,-7],[0,8],[13,-7],[21,-12],[18,10],[0,20],[-18,10]],metal,edge);
      p(c,[[-10,5],[0,13],[10,5],[0,18]],T.coral); T.disc(c,0,0,3,T.amber);
    } else if (kind === 'heavy') {
      p(c,[[-19,-22],[19,-22],[26,-9],[25,16],[10,23],[-10,23],[-25,16],[-26,-9]],metal,edge);
      c.fillStyle='#35465A'; c.fillRect(-15,-15,30,23);
      for(const s of [-1,1]) { c.fillStyle=T.ivory; c.fillRect(s*19-3,-1,6,20); c.fillStyle=T.coral; c.fillRect(s*19-3,17,6,4); }
      c.fillStyle=T.amber; c.fillRect(-8,-7,16,4);
      c.fillStyle=T.navy; for(let i=0;i<3;i++) c.fillRect(-9,3+i*4,18,2);
    } else if (kind === 'hunter') {
      p(c,[[0,23],[-8,7],[-24,-5],[-14,-16],[-7,-2],[0,-13],[7,-2],[14,-16],[24,-5],[8,7]],metal,edge);
      p(c,[[0,-7],[4,5],[0,16],[-4,5]],T.coral);
      c.fillStyle=T.amber; c.fillRect(-18,-5,5,3); c.fillRect(13,-5,5,3);
    } else if (kind === 'boss') {
      p(c,[[-87,-7],[-62,-29],[-39,-18],[-22,-30],[0,-47],[22,-30],[39,-18],[62,-29],[87,-7],[66,29],[25,34],[0,65],[-25,34],[-66,29]],metal,edge);
      for(const s of [-1,1]) {
        p(c,[[s*16,-20],[s*44,-11],[s*68,-20],[s*54,6],[s*22,13]],'#435064',T.coral);
        p(c,[[s*25,17],[s*65,10],[s*59,25],[s*27,29]],'#131F30',edge);
        p(c,[[s*20,-27],[s*37,-40],[s*32,-14]],T.ivory);
        c.fillStyle=T.coral; c.fillRect(s*48-5,24,10,8);
      }
      p(c,[[-16,24],[0,43],[16,24],[0,55]],T.ivory);
      T.disc(c,0,5,18,T.navy); T.disc(c,0,5,weak?13:9,weak?T.amber:T.coral);
      T.disc(c,0,5,4,T.ivory);
      if(weak) { c.strokeStyle=T.amber; c.lineWidth=2; c.strokeRect(-21,-16,42,42); }
    } else {
      c.fillStyle=T.ivory; c.fillRect(-8,-8,16,16); c.fillStyle=metal; c.fillRect(-11,-2,22,6);
      T.disc(c,0,-2,4,T.cyan); c.fillStyle=T.cyan; c.fillRect(-5,9,3,4); c.fillRect(2,9,3,4);
    }
  };
  T.icon = function(c,type,color) {
    c.strokeStyle=color; c.fillStyle=color; c.lineWidth=2; c.lineCap='round'; c.lineJoin='round';
    c.beginPath();
    if(type==='shield') { c.moveTo(-7,-7); c.lineTo(7,-7); c.lineTo(6,3); c.lineTo(0,9); c.lineTo(-6,3); c.closePath(); }
    if(type==='rapid') { c.moveTo(2,-9); c.lineTo(-5,1); c.lineTo(1,1); c.lineTo(-2,9); c.lineTo(6,-2); c.lineTo(0,-2); }
    if(type==='triple') for(const x of [-7,0,7]) { c.moveTo(x,8); c.lineTo(x,-7); c.lineTo(x-2,-4); c.moveTo(x,-7); c.lineTo(x+2,-4); }
    if(type==='repair') { c.moveTo(-8,0); c.lineTo(8,0); c.moveTo(0,-8); c.lineTo(0,8); }
    if(type==='invincible') { for(let i=0;i<10;i++) { const a=i*Math.PI/5-Math.PI/2,r=i%2?4:9; i?c.lineTo(Math.cos(a)*r,Math.sin(a)*r):c.moveTo(0,-9); } c.closePath(); }
    if(type==='drone') { c.rect(-7,-6,14,12); c.moveTo(-10,0); c.lineTo(10,0); }
    c.stroke();
  };
  // Deterministic artwork is baked on resize. Animation only composites cached layers.
  class OrbitalPort {
    constructor(w,h) { this.time=0; this.resize(w,h); }
    canvas(w,h,paint) {
      const a=document.createElement('canvas'); a.width=Math.ceil(w); a.height=Math.ceil(h);
      paint(a.getContext('2d'),a.width,a.height); return a;
    }
    resize(w,h) {
      this.width=w; this.height=h; this.edge=Math.ceil(w*.19); this.tileHeight=1200;
      let seed=713;
      const rng=()=>{ seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; };
      this.haze=this.canvas(640,640,(c)=>{
        const g=c.createRadialGradient(320,320,5,320,320,320);
        g.addColorStop(0,'#569eae');g.addColorStop(.35,'#30587988');g.addColorStop(1,'#14243c00');
        c.fillStyle=g;c.fillRect(0,0,640,640);
      });
      this.moon=this.canvas(380,380,(c)=>{
        const g=c.createRadialGradient(150,120,5,200,190,165);
        g.addColorStop(0,'#97b8bc');g.addColorStop(.5,'#526d80');g.addColorStop(1,'#111e34');
        c.save();c.beginPath();c.arc(190,190,150,0,Math.PI*2);c.clip();c.fillStyle=g;c.fillRect(0,0,380,380);
        for(let i=0;i<90;i++){T.disc(c,40+rng()*300,40+rng()*300,2+rng()*17,'#12233718');}
        c.restore();c.strokeStyle='#b2e2df55';c.lineWidth=2;c.beginPath();c.arc(190,190,151,Math.PI*.95,Math.PI*1.8);c.stroke();
      });
      this.layers=[0,1,2].map(depth=>[0,1].map(side=>this.canvas(this.edge,1200,(c,ew)=>{
        c.save(); if(side){c.translate(ew,0);c.scale(-1,1);}
        const count=depth===0?16:depth===1?8:4;
        for(let i=0;i<count;i++) {
          const y=i*1200/count+18, bw=ew*(.4+rng()*.58), bh=depth===0?45+rng()*70:85+rng()*100;
          const x=depth===2?-ew*.20:rng()*ew*.1;
          c.fillStyle='#02071388';c.fillRect(x+12,y+15,bw,bh);
          const g=c.createLinearGradient(x,y,x+bw,y+bh);
          g.addColorStop(0,depth===0?'#17273b':'#253b4d');g.addColorStop(1,'#0c1627');
          c.fillStyle=g;c.fillRect(x,y,bw,bh);c.strokeStyle='#53708555';c.strokeRect(x+.5,y+.5,bw-1,bh-1);
          c.fillStyle='#091322';c.fillRect(x+8,y+8,bw-16,bh-16);
          if((i+depth)%3===0) {
            // Copper-green temple roofs nested inside orbital docking platforms.
            for(let k=0;k<3;k++){
              const yy=y+20+k*22;
              T.poly(c,[[x+5,yy+12],[x+bw*.5,yy-6],[x+bw-5,yy+12],[x+bw-13,yy+21],[x+13,yy+21]],'#284451','#65848266');
              c.strokeStyle='#99b9a044';c.beginPath();c.moveTo(x+18,yy+14);c.lineTo(x+bw-18,yy+14);c.stroke();
            }
          }else{
            c.fillStyle='#203448';c.fillRect(x+16,y+14,bw-32,bh-28);
            for(let k=0;k<4;k++){c.fillStyle='#071221';c.fillRect(x+22,y+25+k*14,Math.max(4,bw-50),5);}
            c.strokeStyle='#77a6b533';c.beginPath();c.arc(x+bw*.52,y+bh*.5,Math.min(bw,bh)*.29,0,Math.PI*2);c.stroke();
          }
          c.fillStyle='#71b8b277'; for(let yy=0;yy<5;yy++)for(let xx=0;xx<3;xx++)if(rng()>.3)c.fillRect(x+bw-18+xx*4,y+20+yy*9,2,3);
          const neon=(i%2)?'#c5868c':'#6bc8c7';
          c.shadowColor=neon;c.shadowBlur=9;c.fillStyle=neon;c.globalAlpha=.6;c.fillRect(x+bw-7,y+15,2,bh-30);c.globalAlpha=1;c.shadowBlur=0;
          // Tiny abstract wayfinding glyphs (decorative, never gameplay text).
          c.fillStyle='#0a1725';c.fillRect(x+18,y+bh-27,43,15);
          c.strokeStyle=neon;c.lineWidth=1;
          for(let k=0;k<4;k++){const xx=x+22+k*9;c.strokeRect(xx,y+bh-24,5,7);c.beginPath();c.moveTo(xx,y+bh-21);c.lineTo(xx+6,y+bh-21);c.stroke();}
          c.strokeStyle='#446578';c.beginPath();c.moveTo(x+bw*.35,y);c.lineTo(x+bw*.35,y-13);c.stroke();
        }
        c.restore();
      })));
      this.vignette=this.canvas(w,h,c=>{
        const g=c.createRadialGradient(w*.5,h*.46,w*.08,w*.5,h*.46,Math.max(w,h)*.7);
        g.addColorStop(0,'#03081000');g.addColorStop(.65,'#03081008');g.addColorStop(1,'#01040be6');c.fillStyle=g;c.fillRect(0,0,w,h);
      });
    }
    update(dt,speed) { if(!T.reducedMotion.matches)this.time+=dt*speed; }
    draw(c) {
      const w=this.width,h=this.height,t=this.time;
      // 3 slow, seamless lighting phases: jade port -> lantern district -> blue orbit.
      const phase=t/48, mix=(1-Math.cos((phase%1)*Math.PI))/2;
      const colors=[[40,117,124],[123,57,98],[52,78,140]],a=colors[Math.floor(phase)%3],b=colors[(Math.floor(phase)+1)%3];
      const rgb=a.map((v,i)=>Math.round(v+(b[i]-v)*mix)).join(',');
      c.save();
      c.globalAlpha=.16;c.drawImage(this.haze,-w*.22+Math.sin(t*.035)*w*.08,-h*.1,w*.95,h*1.1);
      c.globalAlpha=.12;c.drawImage(this.haze,w*.47,-h*.2+Math.sin(t*.027)*30,w*.8,h*1.2);
      c.globalAlpha=.30;c.drawImage(this.moon,w*.68,h*.08,Math.min(w*.32,380),Math.min(w*.32,380));
      // Distant orbital arcs give scale without adding bright central obstacles.
      c.strokeStyle='#688eab';c.lineWidth=1;c.globalAlpha=.09;
      for(let i=0;i<3;i++){c.beginPath();c.ellipse(w*.77,h*.29,w*.28+i*13,h*.28+i*12,-.3,0,Math.PI*2);c.stroke();}
      this.layers.forEach((pair,depth)=>{
        const speed=[5,13,24][depth],offset=(t*speed)%1200;
        c.globalAlpha=[.18,.38,.92][depth];
        pair.forEach((tile,side)=>{for(let y=offset-1200;y<h;y+=1200)c.drawImage(tile,side?w-this.edge:0,y);});
      });
      const light=c.createLinearGradient(0,0,w,0);
      light.addColorStop(0,`rgba(${rgb},.20)`);light.addColorStop(.22,`rgba(${rgb},.02)`);
      light.addColorStop(.5,'rgba(0,0,0,0)');light.addColorStop(.78,`rgba(${rgb},.02)`);light.addColorStop(1,`rgba(${rgb},.20)`);
      c.globalAlpha=1;c.fillStyle=light;c.fillRect(0,0,w,h);
      // Soft searchlights, passing traffic and lanterns stay at the outer margins.
      for(let side=0;side<2;side++) {
        c.save();if(side){c.translate(w,0);c.scale(-1,1);}
        for(let i=0;i<3;i++){
          const y=(i*h*.43+t*9)%(h+160)-80;
          c.globalAlpha=.055;c.fillStyle='#7bb8c9';
          T.poly(c,[[w*.06,y],[w*.17,y+100+Math.sin(t*.13+i)*40],[w*.09,y+180]],'#7bb8c9');
        }
        for(let i=0;i<9;i++){
          const x=w*(.025+(i%4)*.035),y=(i*173+t*(10+i%3*4))%(h+70)-35;
          c.globalAlpha=.25; c.fillStyle='#72b9c2';c.fillRect(x,y,1,12);c.fillRect(x-2,y+10,5,2);
        }
        for(let i=0;i<5;i++){
          const x=w*(.05+(i%3)*.04)+Math.sin(t*.18+i)*3,y=(i*241+t*18)%(h+60)-30;
          c.globalAlpha=.35;T.disc(c,x,y,3,'#efad89');c.globalAlpha=.06;T.disc(c,x,y,12,'#efad89');
        }
        c.restore();
      }
      c.globalAlpha=1;c.drawImage(this.vignette,0,0);c.restore();
    }
  }

  Starfall.OrbitalPort=OrbitalPort;
})();
