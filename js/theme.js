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
  // Tile artwork is generated only on resize; scrolling uses two cached edge strips.
  class OrbitalPort {
    constructor(w,h) { this.offset=0; this.resize(w,h); }
    resize(w,h) {
      this.width=w; this.height=h; this.edge=Math.ceil(w*.175); this.tileHeight=640;
      this.tiles=[0,1].map(side=>{
        const a=document.createElement('canvas'); a.width=this.edge; a.height=this.tileHeight;
        const c=a.getContext('2d');
        for(let i=0;i<4;i++) {
          const y=i*160+12, span=this.edge*(.65+(i%2)*.25), x=side?this.edge-span:0;
          c.fillStyle='#101C2C'; c.fillRect(x,y,span,132);
          c.strokeStyle='#29394B'; c.strokeRect(x+4,y+5,span-8,120);
          c.fillStyle='#18293B'; c.fillRect(x+12,y+22,span-24,75);
          // Layered roof silhouettes seen from overhead.
          for(let k=0;k<3;k++) T.poly(c,[[x+8,y+30+k*18],[x+span/2,y+20+k*18],[x+span-8,y+30+k*18],[x+span-16,y+38+k*18],[x+16,y+38+k*18]],'#26374A','#34475B');
          c.fillStyle='#477B86'; for(let j=0;j<5;j++) c.fillRect(x+14+j*8,y+110,3,2);
          c.fillStyle= i%2?'#805274':'#427C86'; c.fillRect(x+span*.68,y+45,10,39);
          c.fillStyle='#152131'; for(let j=0;j<4;j++) c.fillRect(x+span*.68+2,y+49+j*8,6,3);
          c.strokeStyle='#30475C'; c.beginPath(); c.moveTo(x+span*.3,y); c.lineTo(x+span*.3,y-12); c.stroke();
        }
        return a;
      });
    }
    update(dt,speed) { if(!T.reducedMotion.matches) this.offset=(this.offset+dt*18*speed)%this.tileHeight; }
    draw(c) { c.save(); c.globalAlpha=.8; this.tiles.forEach((tile,s)=>{ for(let y=this.offset-this.tileHeight;y<this.height;y+=this.tileHeight) c.drawImage(tile,s?this.width-this.edge:0,y); }); c.restore(); }
  }
  Starfall.OrbitalPort=OrbitalPort;
})();
