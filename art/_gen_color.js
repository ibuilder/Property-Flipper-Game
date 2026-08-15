// Property Flipper — coloured flat-shaded isometric houses (reference-matched set)
const S=54, K=0.7071*S, J=0.3748*S;
const P=(x,y,z)=>[K*(x+y), J*(y-x)-z];
const f=n=>Math.round(n*10)/10;
const mk=()=>[];
function sh(hex,k){
  let r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  const t=v=>Math.max(0,Math.min(255,Math.round(k<1? v*k : v+(255-v)*(k-1))));
  return '#'+[t(r),t(g),t(b)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
function fp(o,pts,fill,stroke,sw){ o.push({pts,fill:fill||'none',stroke:stroke||'none',sw:sw||0.8,closed:true}); }
function ln(o,pts,stroke,sw){ o.push({pts,fill:'none',stroke,sw:sw||0.7,closed:false}); }
function render(o,tx,ty){
  return o.map(s=>{
    const d=s.pts.map((p,i)=>(i?'L':'M')+f(p[0]+tx)+' '+f(p[1]+ty)).join(' ')+(s.closed?' Z':'');
    return `<path d="${d}" fill="${s.fill}"${s.stroke!=='none'?` stroke="${s.stroke}" stroke-width="${s.sw}" stroke-linejoin="round" stroke-linecap="round"`:''}/>`;
  }).join('');
}
const svg=(b,n)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${n}" height="${n}">${b}</svg>`;

const C={
  kerb:'#cdc4b1', kerbSide:'#b0a693', lawn:'#8b9d63', lawnDark:'#71854f',
  path:'#ddd4c1', pathLine:'#c6bca7',
  trim:'#f0e9db', glass:'#f6c97c', glassDim:'#5d6a72', frame:'#cfa557',
  leaf:'#6f8a52', leafDark:'#54693d', leaf2:'#7f9a5c', blossom:'#d6a0b2',
  brick:'#8e5a45', stone:'#a4998a', line:'#3a352e'
};
const MAT={
  sage:{w:'#93a08a', r:'#414855'},
  cream:{w:'#e0d7c2', r:'#4a4036'},
  greyblue:{w:'#7e8b9a', r:'#3c424d'},
  brick:{w:'#8e5a45', r:'#33383f'},
  green:{w:'#6f8073', r:'#3d434f'},
  clap:{w:'#cfc4ae', r:'#5b4a3c'},
  white:{w:'#e8e3d6', r:'#33373d'}
};
// face light factors: roof-left brightest, roof-right mid, left wall lit, right wall shade
const FL={rl:1.14, rr:0.86, wl:1.08, wr:0.80, top:1.2};

const PLh=7;
function plinth(o,pathY){
  fp(o,[P(0,0,0),P(1,0,0),P(1,1,0),P(0,1,0)],C.kerb,sh(C.kerb,0.82),0.9);
  fp(o,[P(0,0,0),P(0,1,0),P(0,1,-PLh),P(0,0,-PLh)],C.kerbSide,sh(C.kerbSide,0.8),0.9);
  fp(o,[P(0,1,0),P(1,1,0),P(1,1,-PLh),P(0,1,-PLh)],sh(C.kerbSide,0.9),sh(C.kerbSide,0.75),0.9);
  const i=0.075;
  fp(o,[P(i,i,0),P(1-i,i,0),P(1-i,1-i,0),P(i,1-i,0)],C.lawn,C.lawnDark,0.8);
  if(pathY!=null){
    fp(o,[P(i,pathY-0.10,0),P(i,pathY+0.10,0),P(0.999,pathY+0.10,0),P(0.999,pathY-0.10,0)],C.path,C.pathLine,0.7);
    for(let t=0.2;t<1;t+=0.22) ln(o,[P(i+t*(1-i),pathY-0.10,0),P(i+t*(1-i),pathY+0.10,0)],C.pathLine,0.6);
  }
}
const PL=(s,u,v)=>P(s.x0,s.y0+u*(s.y1-s.y0),v);
const PR=(s,u,v)=>P(s.x0+u*(s.x1-s.x0),s.y1,v);

function wallFaces(s,o){
  const {x0,y0,x1,y1,h}=s, m=MAT[s.mat], xm=(x0+x1)/2;
  const L=sh(m.w,FL.wl), R=sh(m.w,FL.wr);
  fp(o,[P(x0,y0,0),P(x0,y1,0),P(x0,y1,h),P(x0,y0,h)],L,sh(m.w,0.6),0.9);
  let rp;
  if(s.roof==='gable') rp=[P(x0,y1,0),P(x1,y1,0),P(x1,y1,h),P(xm,y1,h+s.rh),P(x0,y1,h)];
  else if(s.roof==='mono') rp=[P(x0,y1,0),P(x1,y1,0),P(x1,y1,h+s.rh),P(x0,y1,h)];
  else rp=[P(x0,y1,0),P(x1,y1,0),P(x1,y1,h),P(x0,y1,h)];
  fp(o,rp,R,sh(m.w,0.55),0.9);
  if(s.siding!=='brick'){
    for(let z=3;z<h-1;z+=3.4){
      ln(o,[P(x0,y0,z),P(x0,y1,z)],sh(m.w,0.90),0.5);
      ln(o,[P(x0,y1,z),P(x1,y1,z)],sh(m.w,0.68),0.5);
    }
  } else {
    for(let z=4;z<h-1;z+=4.6){
      ln(o,[P(x0,y0,z),P(x0,y1,z)],sh(m.w,0.86),0.5);
      ln(o,[P(x0,y1,z),P(x1,y1,z)],sh(m.w,0.7),0.5);
    }
    for(let u=0.14;u<1;u+=0.18){
      ln(o,[PL(s,u,0),PL(s,u,h)],sh(m.w,0.86),0.5);
      ln(o,[PR(s,u,0),PR(s,u,h)],sh(m.w,0.7),0.5);
    }
  }
}
function roofFaces(s,o){
  const ov=s.ov??0.06, {x0,y0,x1,y1,h}=s, m=MAT[s.mat], xm=(x0+x1)/2;
  const a0=x0-ov,a1=x1+ov,b0=y0-ov,b1=y1+ov;
  const A=sh(m.r,FL.rl), B=sh(m.r,FL.rr), E=sh(m.r,0.62);
  if(s.roof==='gable'){
    const zr=h+s.rh, bb=y0-0.012, fd=2.6;
    fp(o,[P(a0,bb,h),P(a0,b1,h),P(xm,b1,zr),P(xm,bb,zr)],A,E,0.9);
    fp(o,[P(xm,bb,zr),P(xm,b1,zr),P(a1,b1,h),P(a1,bb,h)],B,E,0.9);
    fp(o,[P(a0,bb,h),P(a0,b1,h),P(a0,b1,h-fd),P(a0,bb,h-fd)],C.trim,sh(C.trim,0.68),0.7);
    fp(o,[P(a0,b1,h),P(xm,b1,zr),P(xm,b1,zr-fd),P(a0,b1,h-fd)],C.trim,sh(C.trim,0.68),0.7);
    fp(o,[P(xm,b1,zr),P(a1,b1,h),P(a1,b1,h-fd),P(xm,b1,zr-fd)],sh(C.trim,0.9),sh(C.trim,0.62),0.7);
    fp(o,[P(a1,bb,h),P(a1,b1,h),P(a1,b1,h-fd),P(a1,bb,h-fd)],sh(C.trim,0.8),sh(C.trim,0.6),0.7);
    for(let t=0.18;t<1;t+=0.2){
      ln(o,[P(a0+t*(xm-a0),y0,h+t*s.rh),P(a0+t*(xm-a0),b1,h+t*s.rh)],sh(m.r,1.06),0.5);
      ln(o,[P(xm+t*(a1-xm),y0,zr-t*s.rh),P(xm+t*(a1-xm),b1,zr-t*s.rh)],sh(m.r,0.94),0.5);
    }
    ln(o,[P(xm,y0-0.012,zr),P(xm,b1,zr)],sh(m.r,1.2),1.1);
  } else if(s.roof==='hip'){
    const zr=h+s.rh, d=(b1-b0)*0.24;
    fp(o,[P(a0,b0,h),P(a0,b1,h),P(xm,b1-d,zr),P(xm,b0+d,zr)],A,E,0.9);
    fp(o,[P(xm,b0+d,zr),P(xm,b1-d,zr),P(a1,b1,h),P(a1,b0,h)],B,E,0.9);
    fp(o,[P(a0,b1,h),P(a1,b1,h),P(xm,b1-d,zr)],sh(m.r,0.94),E,0.9);
    fp(o,[P(a0,b0,h),P(a0,b1,h),P(a0,b1,h-2.6),P(a0,b0,h-2.6)],C.trim,sh(C.trim,0.68),0.7);
    fp(o,[P(a0,b1,h),P(a1,b1,h),P(a1,b1,h-2.6),P(a0,b1,h-2.6)],sh(C.trim,0.9),sh(C.trim,0.62),0.7);
    ln(o,[P(xm,b0+d,zr),P(xm,b1-d,zr)],sh(m.r,1.2),1.1);
  } else if(s.roof==='mono'){
    fp(o,[P(a0,b0,h),P(a0,b1,h),P(a1,b1,h+s.rh),P(a1,b0,h+s.rh)],A,E,0.9);
    for(let t=0.2;t<1;t+=0.25) ln(o,[P(a0+t*(a1-a0),b0,h+t*s.rh),P(a0+t*(a1-a0),b1,h+t*s.rh)],sh(m.r,1.05),0.5);
    fp(o,[P(a0,b0,h),P(a0,b1,h),P(a0,b1,h-2.6),P(a0,b0,h-2.6)],C.trim,sh(C.trim,0.68),0.7);
    fp(o,[P(a0,b1,h),P(a1,b1,h+s.rh),P(a1,b1,h+s.rh-2.6),P(a0,b1,h-2.6)],sh(C.trim,0.9),sh(C.trim,0.62),0.7);
  } else {
    const pz=h+(s.parapet??5);
    fp(o,[P(a0,b0,pz),P(a1,b0,pz),P(a1,b1,pz),P(a0,b1,pz)],sh(m.r,1.02),E,0.9);
    fp(o,[P(a0,b1,h),P(a0,b1,pz),P(a1,b1,pz),P(a1,b1,h)],sh(m.r,0.8),E,0.9);
    fp(o,[P(a0,b0,h),P(a0,b0,pz),P(a0,b1,pz),P(a0,b1,h)],sh(m.r,0.95),E,0.9);
  }
}
function window(s,o,w){
  const F=w.face==='L'?PL:PR, lit=w.lit!==false;
  const c=[F(s,w.u,w.v),F(s,w.u+w.w,w.v),F(s,w.u+w.w,w.v+w.h),F(s,w.u,w.v+w.h)];
  fp(o,c,C.trim,sh(C.trim,0.7),0.7);
  const i=0.16, iv=w.h*0.13;
  const g=[F(s,w.u+w.w*i,w.v+iv),F(s,w.u+w.w*(1-i),w.v+iv),F(s,w.u+w.w*(1-i),w.v+w.h-iv),F(s,w.u+w.w*i,w.v+w.h-iv)];
  fp(o,g,lit?C.glass:C.glassDim,lit?C.frame:sh(C.glassDim,0.8),0.6);
  ln(o,[F(s,w.u+w.w*0.5,w.v+iv),F(s,w.u+w.w*0.5,w.v+w.h-iv)],lit?sh(C.glass,0.82):sh(C.glassDim,0.85),0.6);
  ln(o,[F(s,w.u+w.w*i,w.v+w.h*0.52),F(s,w.u+w.w*(1-i),w.v+w.h*0.52)],lit?sh(C.glass,0.82):sh(C.glassDim,0.85),0.6);
}
function door(s,o,w){
  const F=w.face==='L'?PL:PR;
  fp(o,[F(s,w.u,w.v),F(s,w.u+w.w,w.v),F(s,w.u+w.w,w.v+w.h),F(s,w.u,w.v+w.h)],C.trim,sh(C.trim,0.7),0.7);
  const i=0.14;
  fp(o,[F(s,w.u+w.w*i,w.v),F(s,w.u+w.w*(1-i),w.v),F(s,w.u+w.w*(1-i),w.v+w.h*0.94),F(s,w.u+w.w*i,w.v+w.h*0.94)],w.col||'#6b4b34',sh(w.col||'#6b4b34',0.7),0.6);
  const k=F(s,w.u+w.w*0.72,w.v+w.h*0.48);
  fp(o,[[k[0]-1,k[1]],[k[0],k[1]-1],[k[0]+1,k[1]],[k[0],k[1]+1]],C.frame,'none');
}
function chimney(s,o,gx,gy,z0,z1,wd){
  const m=MAT[s.mat];
  const a=gx-wd,b=gx+wd,c=gy-wd,d=gy+wd;
  fp(o,[P(a,c,z1),P(b,c,z1),P(b,d,z1),P(a,d,z1)],sh(C.brick,1.15),sh(C.brick,0.7),0.8);
  fp(o,[P(a,c,z0),P(a,d,z0),P(a,d,z1),P(a,c,z1)],sh(C.brick,1.02),sh(C.brick,0.65),0.8);
  fp(o,[P(a,d,z0),P(b,d,z0),P(b,d,z1),P(a,d,z1)],sh(C.brick,0.82),sh(C.brick,0.6),0.8);
}
function porch(s,o,ya,yb,depth,z){
  const m=MAT[s.mat], x=s.x0, xa=x-depth;
  fp(o,[P(xa,ya,0.6),P(xa,yb,0.6),P(x,yb,0.6),P(x,ya,0.6)],'#b89a76','#8d7355',0.8);
  fp(o,[P(xa,ya,0.6),P(xa,yb,0.6),P(xa,yb,-1.6),P(xa,ya,-1.6)],'#a4886a','#83694e',0.8);
  fp(o,[P(xa-0.03,ya-0.03,z),P(xa-0.03,yb+0.03,z),P(x,yb+0.03,z+2.4),P(x,ya-0.03,z+2.4)],sh(MAT[s.mat].r,1.06),sh(MAT[s.mat].r,0.62),0.9);
  [ya+0.02,(ya+yb)/2,yb-0.02].forEach(y=>{
    fp(o,[P(xa-0.012,y-0.012,0.6),P(xa+0.012,y+0.012,0.6),P(xa+0.012,y+0.012,z),P(xa-0.012,y-0.012,z)],C.trim,sh(C.trim,0.72),0.6);
  });
  ln(o,[P(xa,ya,z*0.42),P(xa,yb,z*0.42)],C.trim,1.4);
  for(let t=0.06;t<1;t+=0.09) ln(o,[P(xa,ya+t*(yb-ya),0.8),P(xa,ya+t*(yb-ya),z*0.42)],C.trim,0.6);
}
function bush(o,gx,gy,r,hh,col){
  const c=P(gx,gy,hh), pts=[];
  for(let i=0;i<9;i++){const a=Math.PI*2*i/9, j=1+0.12*Math.sin(i*2.7);
    pts.push([c[0]+r*j*Math.cos(a), c[1]+r*0.72*j*Math.sin(a)]);}
  fp(o,pts,col||C.leaf,sh(col||C.leaf,0.72),0.7);
}
function flowers(o,gx,gy,n,spread){
  for(let i=0;i<n;i++){
    const a=P(gx+(Math.random()-0.5)*spread, gy+(Math.random()-0.5)*spread, 1+Math.random()*2);
    fp(o,[[a[0]-1.3,a[1]],[a[0],a[1]-1.3],[a[0]+1.3,a[1]],[a[0],a[1]+1.3]],
      [C.blossom,'#e0c473','#c9d3a0','#b98fb0'][i%4],'none');
  }
}
function tree(o,gx,gy,th,r,col){
  const b=P(gx,gy,0), t=P(gx,gy,th);
  fp(o,[[b[0]-2,b[1]],[b[0]+2,b[1]],[t[0]+1.6,t[1]],[t[0]-1.6,t[1]]],'#6b5340','#4c3b2c',0.7);
  bush(o,gx,gy,r,th+r*0.55,col||C.leaf2);
  bush(o,gx-0.03,gy-0.02,r*0.68,th+r*1.0,sh(col||C.leaf2,1.08));
}
function shadow(o){
  const c=P(0.5,0.5,-PLh);
  const pts=[]; for(let i=0;i<16;i++){const a=Math.PI*2*i/16; pts.push([c[0]+K*1.02*Math.cos(a), c[1]+J*1.02*Math.sin(a)]);}
  fp(o,pts,'rgba(60,50,40,0.10)','none');
}

const H={};
H.bungalow={x0:0.40,x1:0.94,y0:0.10,y1:0.90,h:26,rh:20,roof:'gable',mat:'sage',ov:0.045,pathY:0.52,
  windows:[{face:'L',u:0.06,v:9,w:0.15,h:12},{face:'L',u:0.80,v:9,w:0.15,h:12},{face:'R',u:0.16,v:9,w:0.22,h:12},{face:'R',u:0.62,v:9,w:0.20,h:12,lit:false}],
  doors:[{face:'L',u:0.46,v:1,w:0.12,h:19}],
  extra(o,s){ porch(s,o,0.24,0.72,0.20,23); chimney(s,o,0.62,0.26,30,41,0.032);
    tree(o,0.13,0.14,15,10,'#a8ac6b'); bush(o,0.16,0.66,9,5); bush(o,0.20,0.80,7,4,C.leafDark);
    bush(o,0.62,0.96,8,5,C.leaf2); flowers(o,0.20,0.86,7,0.14); flowers(o,0.66,0.96,6,0.16); }};

H.ranch={x0:0.52,x1:0.96,y0:0.02,y1:0.98,h:22,rh:12,roof:'hip',mat:'stone',ov:0.09,pathY:0.30,
  windows:[{face:'L',u:0.04,v:8,w:0.12,h:11},{face:'L',u:0.22,v:8,w:0.12,h:11},{face:'L',u:0.40,v:8,w:0.12,h:11},{face:'L',u:0.86,v:8,w:0.11,h:11,lit:false},{face:'R',u:0.20,v:8,w:0.30,h:11}],
  doors:[{face:'L',u:0.58,v:1,w:0.10,h:17},{face:'L',u:0.72,v:1,w:0.16,h:15,col:'#3f464b'}],
  extra(o,s){ chimney(s,o,0.80,0.32,24,34,0.032);
    tree(o,0.30,0.06,16,10,'#a8ac6b');
    for(let i=0;i<5;i++) bush(o,0.42,0.10+i*0.15,7,4,i%2?C.leaf:C.leafDark);
    flowers(o,0.44,0.62,9,0.24); bush(o,0.46,0.94,8,5,C.leaf2); }};
H.ranch.mat='stone'; MAT.stone={w:'#a4998a', r:'#3f444d'};

H.duplex={x0:0.44,x1:0.94,y0:0.10,y1:0.90,h:46,rh:16,roof:'gable',mat:'greyblue',ov:0.04,pathY:0.50,
  windows:[{face:'L',u:0.06,v:28,w:0.13,h:11},{face:'L',u:0.30,v:28,w:0.13,h:11},{face:'L',u:0.56,v:28,w:0.13,h:11,lit:false},{face:'L',u:0.80,v:28,w:0.13,h:11},
           {face:'L',u:0.06,v:8,w:0.13,h:11},{face:'L',u:0.80,v:8,w:0.13,h:11,lit:false},
           {face:'R',u:0.20,v:8,w:0.24,h:11},{face:'R',u:0.20,v:28,w:0.24,h:11}],
  doors:[{face:'L',u:0.34,v:2,w:0.11,h:17},{face:'L',u:0.55,v:2,w:0.11,h:17,col:'#3f464b'}],
  extra(o,s){ ln(o,[PL(s,0.50,0),PL(s,0.50,s.h)],sh(MAT.greyblue.w,0.62),1.0);
    fp(o,[P(s.x0-0.10,0.30,20),P(s.x0-0.10,0.68,20),P(s.x0,0.68,22),P(s.x0,0.30,22)],sh(MAT.greyblue.r,1.05),sh(MAT.greyblue.r,0.62),0.8);
    fp(o,[P(s.x0-0.11,0.30,1),P(s.x0-0.11,0.70,1),P(s.x0,0.70,1),P(s.x0,0.30,1)],'#b89a76','#8d7355',0.8);
    chimney(s,o,0.70,0.50,50,60,0.030);
    tree(o,0.14,0.16,16,10,'#8fa05c'); bush(o,0.20,0.20,8,5,C.leafDark);
    bush(o,0.22,0.34,7,4,C.leaf2); flowers(o,0.22,0.26,8,0.16); }};

H.mill_loft={x0:0.30,x1:0.96,y0:0.06,y1:0.94,h:66,parapet:6,roof:'flat',mat:'brick',siding:'brick',ov:0.04,pathY:0.50,
  windows:(()=>{const w=[];
    for(let r=0;r<3;r++)for(let c=0;c<3;c++)w.push({face:'L',u:0.08+c*0.31,v:10+r*19,w:0.22,h:13,lit:!(r===1&&c===2)});
    for(let r=0;r<3;r++)for(let c=0;c<2;c++)w.push({face:'R',u:0.14+c*0.38,v:10+r*19,w:0.28,h:13,lit:!(r===2&&c===0)});
    return w;})(),
  doors:[{face:'L',u:0.42,v:1,w:0.18,h:16,col:'#3f464b'}],
  extra(o,s){
    for(let z=8;z<62;z+=19) ln(o,[P(s.x0,s.y0,z-2),P(s.x0,s.y1,z-2)],sh(MAT.brick.w,0.8),0.8);
    fp(o,[P(s.x0-0.09,0.40,20),P(s.x0-0.09,0.62,20),P(s.x0,0.62,22),P(s.x0,0.40,22)],'#3f444d','#2b3036',0.8);
    chimney(s,o,0.42,0.18,72,84,0.030);
    fp(o,[P(0.52,0.40,72),P(0.72,0.40,72),P(0.72,0.60,72),P(0.52,0.60,72)],'#4b515a','#33383f',0.8);
    tree(o,0.12,0.14,14,9,C.leafDark); tree(o,0.14,0.86,12,8,C.leaf2);
    bush(o,0.20,0.50,7,4); flowers(o,0.20,0.62,6,0.14); }};

H.victorian={x0:0.44,x1:0.92,y0:0.10,y1:0.90,h:48,rh:34,roof:'gable',mat:'green',ov:0.04,pathY:0.54,
  windows:[{face:'L',u:0.06,v:30,w:0.12,h:12},{face:'L',u:0.26,v:30,w:0.12,h:12},{face:'L',u:0.62,v:30,w:0.12,h:12,lit:false},{face:'L',u:0.84,v:30,w:0.12,h:12},
           {face:'L',u:0.62,v:8,w:0.12,h:13},{face:'L',u:0.84,v:8,w:0.12,h:13},
           {face:'R',u:0.60,v:8,w:0.20,h:13},{face:'R',u:0.60,v:30,w:0.20,h:12}],
  doors:[{face:'L',u:0.44,v:2,w:0.11,h:18,col:'#5c3b2c'}],
  extra(o,s){
    // bay tower on the front facade with its own conical roof
    const b0=0.08,b1=0.34,bx=s.x0-0.16;
    fp(o,[P(bx,b0,0),P(bx,b1,0),P(bx,b1,44),P(bx,b0,44)],sh(MAT.green.w,FL.wl*1.04),sh(MAT.green.w,0.6),0.9);
    fp(o,[P(bx,b1,0),P(s.x0,b1,0),P(s.x0,b1,44),P(bx,b1,44)],sh(MAT.green.w,FL.wr),sh(MAT.green.w,0.55),0.9);
    const ap=P((bx+s.x0)/2,(b0+b1)/2,64);
    fp(o,[P(bx,b0,44),P(bx,b1,44),ap],sh(MAT.green.r,1.12),sh(MAT.green.r,0.6),0.9);
    fp(o,[P(bx,b1,44),P(s.x0,b1,44),ap],sh(MAT.green.r,0.86),sh(MAT.green.r,0.6),0.9);
    ln(o,[ap,[ap[0],ap[1]-9]],C.frame,1.3);
    [8,24].forEach(z=>{
      fp(o,[P(bx,b0+0.05,z),P(bx,b1-0.05,z),P(bx,b1-0.05,z+12),P(bx,b0+0.05,z+12)],C.trim,sh(C.trim,0.7),0.7);
      fp(o,[P(bx,b0+0.08,z+1.5),P(bx,b1-0.08,z+1.5),P(bx,b1-0.08,z+10.5),P(bx,b0+0.08,z+10.5)],C.glass,C.frame,0.6);
    });
    porch(s,o,0.40,0.74,0.16,26);
    chimney(s,o,0.86,0.28,54,68,0.030);
    tree(o,0.11,0.10,13,8,C.blossom); bush(o,0.22,0.62,8,5,C.leafDark);
    flowers(o,0.24,0.70,10,0.18); flowers(o,0.20,0.50,8,0.16); }};

H.split_level={x0:0.50,x1:0.94,y0:0.06,y1:0.94,h:42,rh:15,roof:'gable',mat:'clap',ov:0.04,pathY:0.62,
  windows:[{face:'L',u:0.08,v:26,w:0.13,h:11},{face:'L',u:0.30,v:26,w:0.13,h:11,lit:false},{face:'L',u:0.80,v:26,w:0.13,h:11},
           {face:'R',u:0.22,v:26,w:0.26,h:11},{face:'R',u:0.22,v:6,w:0.26,h:11,lit:false}],
  doors:[],
  extra(o,s){
    const wx=0.16, wh=22, wr=30;
    fp(o,[P(s.x0,s.y0,0),P(s.x0,0.30,0),P(s.x0,0.30,wr),P(s.x0,s.y1,wr),P(s.x0,s.y1,0)],'none','none',0);
    fp(o,[P(wx,0.30,0),P(wx,s.y1,0),P(wx,s.y1,wh),P(wx,0.30,wh)],sh(MAT.clap.w,FL.wl),sh(MAT.clap.w,0.6),0.9);
    fp(o,[P(wx,s.y1,0),P(s.x0,s.y1,0),P(s.x0,s.y1,wr),P(wx,s.y1,wh)],sh(MAT.clap.w,FL.wr),sh(MAT.clap.w,0.55),0.9);
    fp(o,[P(wx-0.05,0.26,wh),P(wx-0.05,s.y1+0.05,wh),P(s.x0,s.y1+0.05,wr),P(s.x0,0.26,wr)],sh(MAT.clap.r,1.1),sh(MAT.clap.r,0.62),0.9);
    for(let z=3;z<wh-1;z+=3.4) ln(o,[P(wx,0.30,z),P(wx,s.y1,z)],sh(MAT.clap.w,0.9),0.5);
    const g={x0:wx,x1:s.x0,y0:0.30,y1:s.y1,h:wh};
    fp(o,[P(wx,0.62,1),P(wx,0.86,1),P(wx,0.86,15),P(wx,0.62,15)],'#3f464b','#2b3036',0.8);
    for(let t=0.2;t<1;t+=0.25) ln(o,[P(wx,0.62+t*0.24,2),P(wx,0.62+t*0.24,14)],sh('#3f464b',1.3),0.6);
    fp(o,[P(wx,0.36,4),P(wx,0.54,4),P(wx,0.54,14),P(wx,0.36,14)],C.trim,sh(C.trim,0.7),0.7);
    fp(o,[P(wx,0.38,5.5),P(wx,0.52,5.5),P(wx,0.52,12.5),P(wx,0.38,12.5)],C.glass,C.frame,0.6);
    // retaining wall + steps up to the raised entry
    for(let i=0;i<4;i++) fp(o,[P(0.06+i*0.03,0.06,i*4),P(0.06+i*0.03,0.26,i*4),P(0.30,0.26,i*4),P(0.30,0.06,i*4)],
      i%2?sh(C.stone,1.04):C.stone,sh(C.stone,0.75),0.7);
    fp(o,[P(s.x0,0.20,0),P(s.x0,0.30,0),P(s.x0,0.30,26),P(s.x0,0.20,26)],sh(C.stone,0.95),sh(C.stone,0.7),0.8);
    chimney(s,o,0.74,0.32,46,56,0.030);
    tree(o,0.10,0.14,13,9,C.leafDark); bush(o,0.34,0.16,8,5,C.leaf2);
    bush(o,0.12,0.86,9,5); flowers(o,0.34,0.34,8,0.16); }};

H.new_build={x0:0.44,x1:0.94,y0:0.08,y1:0.92,h:30,rh:22,roof:'mono',mat:'white',ov:0.07,pathY:0.66,
  windows:[{face:'L',u:0.05,v:8,w:0.26,h:18},{face:'L',u:0.38,v:8,w:0.12,h:18,lit:false},
           {face:'R',u:0.12,v:9,w:0.30,h:16},{face:'R',u:0.56,v:9,w:0.26,h:30}],
  doors:[{face:'L',u:0.74,v:1,w:0.11,h:18,col:'#4a3b2e'}],
  extra(o,s){
    // timber-clad recess beside the door and a flat garage box
    fp(o,[P(s.x0,0.52,0),P(s.x0,0.70,0),P(s.x0,0.70,28),P(s.x0,0.52,28)],'#a87f4f','#7d5c36',0.8);
    for(let t=0.1;t<1;t+=0.13) ln(o,[P(s.x0,0.52+t*0.18,1),P(s.x0,0.52+t*0.18,27)],sh('#a87f4f',0.82),0.5);
    fp(o,[P(s.x0-0.14,0.72,0),P(s.x0-0.14,0.92,0),P(s.x0-0.14,0.92,20),P(s.x0-0.14,0.72,20)],sh(MAT.white.w,FL.wl),sh(MAT.white.w,0.6),0.9);
    fp(o,[P(s.x0-0.14,0.92,0),P(s.x0,0.92,0),P(s.x0,0.92,20),P(s.x0-0.14,0.92,20)],sh(MAT.white.w,FL.wr),sh(MAT.white.w,0.55),0.9);
    fp(o,[P(s.x0-0.18,0.68,20),P(s.x0-0.18,0.96,20),P(s.x0+0.02,0.96,21.5),P(s.x0+0.02,0.68,21.5)],sh(MAT.white.r,1.04),sh(MAT.white.r,0.6),0.9);
    fp(o,[P(s.x0-0.14,0.76,1),P(s.x0-0.14,0.90,1),P(s.x0-0.14,0.90,15),P(s.x0-0.14,0.76,15)],'#3f464b','#2b3036',0.8);
    for(let t=0.18;t<1;t+=0.22) ln(o,[P(s.x0-0.14,0.76+t*0.14,2),P(s.x0-0.14,0.76+t*0.14,14)],sh('#3f464b',1.3),0.6);
    fp(o,[P(0.62,0.30,52),P(0.80,0.30,52),P(0.80,0.46,52),P(0.62,0.46,52)],'#4b515a','#33383f',0.8);
    bush(o,0.20,0.22,9,5,C.leafDark); bush(o,0.24,0.40,7,4,C.leaf2);
    tree(o,0.13,0.16,13,9,'#8fa05c'); flowers(o,0.22,0.32,7,0.16);
    for(let i=0;i<4;i++) fp(o,[P(0.06,0.06+i*0.05,0),P(0.06,0.10+i*0.05,0),P(0.06,0.10+i*0.05,14),P(0.06,0.06+i*0.05,14)],
      i%2?'#8d7355':'#a4886a',sh('#8d7355',0.8),0.6); }};

H.colonial={x0:0.40,x1:0.94,y0:0.08,y1:0.92,h:44,rh:16,roof:'gable',mat:'white',ov:0.055,pathY:0.50,
  windows:[{face:'L',u:0.08,v:26,w:0.12,h:11},{face:'L',u:0.44,v:26,w:0.12,h:11,lit:false},{face:'L',u:0.80,v:26,w:0.12,h:11},
           {face:'L',u:0.08,v:6,w:0.12,h:11},{face:'L',u:0.80,v:6,w:0.12,h:11},
           {face:'R',u:0.20,v:26,w:0.18,h:11},{face:'R',u:0.60,v:26,w:0.18,h:11},{face:'R',u:0.20,v:6,w:0.18,h:11,lit:false}],
  doors:[{face:'L',u:0.44,v:1,w:0.13,h:18,col:'#3d5343'}],
  extra(o,s){
    s.windows.filter(w=>w.face==='L').forEach(w=>{
      [[-0.038,-0.008],[w.w+0.008,w.w+0.038]].forEach(([p,q])=>
        fp(o,[PL(s,w.u+p,w.v),PL(s,w.u+q,w.v),PL(s,w.u+q,w.v+w.h),PL(s,w.u+p,w.v+w.h)],'#3d5343','#26362a',0.6));});
    const d=s.doors[0];
    fp(o,[PL(s,d.u-0.05,d.v+d.h),PL(s,d.u+d.w+0.05,d.v+d.h),PL(s,d.u+d.w+0.05,d.v+d.h+2.6),PL(s,d.u-0.05,d.v+d.h+2.6)],C.trim,sh(C.trim,0.66),0.7);
    [P(s.x0,d.u,0)].forEach(()=>{});
    fp(o,[P(s.x0-0.09,0.40,0.8),P(s.x0-0.09,0.62,0.8),P(s.x0,0.62,0.8),P(s.x0,0.40,0.8)],'#b89a76','#8d7355',0.8);
    chimney(s,o,0.62,0.16,44,56,0.030); chimney(s,o,0.62,0.86,44,54,0.030);
    ln(o,[PL(s,0,22),PL(s,1,22)],sh(MAT.white.w,0.7),0.8);
    ln(o,[PR(s,0,22),PR(s,1,22)],sh(MAT.white.w,0.62),0.8);
    tree(o,0.13,0.14,15,10,'#8fa05c'); tree(o,0.14,0.88,13,9,C.leafDark);
    bush(o,0.22,0.34,8,5,C.leaf2); bush(o,0.22,0.66,8,5,C.leaf2);
    flowers(o,0.24,0.50,8,0.16); }};

H.condo={x0:0.26,x1:0.98,y0:0.00,y1:1.00,h:56,parapet:5,flat:true,mat:'stone',ov:0.02,pathY:0.16,
  windows:(()=>{const w=[];
    for(let r=0;r<3;r++)for(let c=0;c<3;c++)w.push({face:'L',u:0.07+c*0.31,v:8+r*16,w:0.18,h:10,lit:!(r===2&&c===1)});
    for(let r=0;r<3;r++)w.push({face:'R',u:0.28,v:8+r*16,w:0.30,h:10,lit:r!==1});
    return w;})(),
  doors:[{face:'L',u:0.06,v:1,w:0.11,h:15,col:'#3f464b'}],
  extra(o,s){
    for(let r=1;r<3;r++) ln(o,[PL(s,0,5+r*16),PL(s,1,5+r*16)],sh(MAT.stone.w,0.72),0.9);
    [0.38,0.69].forEach(u=>ln(o,[PL(s,u,0),PL(s,u,s.h)],sh(MAT.stone.w,0.68),0.9));
    // the unit: picked out by a brighter render and its own balcony
    fp(o,[PL(s,0.02,0),PL(s,0.36,0),PL(s,0.36,21),PL(s,0.02,21)],sh(MAT.stone.w,1.16),sh(MAT.stone.w,0.6),1.1);
    fp(o,[P(s.x0-0.10,0.03,21),P(s.x0-0.10,0.31,21),P(s.x0,0.31,21),P(s.x0,0.03,21)],'#b89a76','#8d7355',0.8);
    fp(o,[P(s.x0-0.10,0.03,21),P(s.x0-0.10,0.31,21),P(s.x0-0.10,0.31,29),P(s.x0-0.10,0.03,29)],'#9aa3ab','#6e767d',0.7);
    for(let t=0.12;t<1;t+=0.15) ln(o,[P(s.x0-0.10,0.03+t*0.28,21),P(s.x0-0.10,0.03+t*0.28,29)],'#7d858c',0.6);
    ln(o,[P(s.x0-0.10,0.03,29),P(s.x0-0.10,0.31,29)],'#6e767d',1.2);
    fp(o,[P(0.44,0.30,61),P(0.62,0.30,61),P(0.62,0.48,61),P(0.44,0.48,61)],'#4b515a','#33383f',0.8);
    bush(o,0.14,0.06,8,5,C.leafDark); bush(o,0.14,0.22,7,4,C.leaf2);
    tree(o,0.12,0.60,14,9,'#8fa05c'); tree(o,0.13,0.86,12,8,C.leafDark);
    flowers(o,0.16,0.40,7,0.14); }};

H.townhouse={x0:0.42,x1:0.94,y0:0.26,y1:0.74,h:52,rh:10,roof:'gable',mat:'brick',siding:'brick',ov:0.04,pathY:0.86,
  windows:[{face:'L',u:0.10,v:36,w:0.34,h:10},{face:'L',u:0.56,v:36,w:0.34,h:10,lit:false},
           {face:'L',u:0.10,v:18,w:0.34,h:10},{face:'L',u:0.56,v:18,w:0.34,h:10},
           {face:'R',u:0.26,v:36,w:0.30,h:10},{face:'R',u:0.26,v:18,w:0.30,h:10,lit:false}],
  doors:[{face:'L',u:0.76,v:1,w:0.16,h:14,col:'#3d4a55'}],
  extra(o,s){
    fp(o,[PL(s,0.10,0),PL(s,0.66,0),PL(s,0.66,13),PL(s,0.10,13)],'#7d858c','#565d64',0.8);
    for(let t=0.14;t<1;t+=0.16) ln(o,[PL(s,0.10+t*0.56,1),PL(s,0.10+t*0.56,12)],'#9aa3ab',0.6);
    ln(o,[PL(s,0,15),PL(s,1,15)],sh(MAT.brick.w,0.7),0.9);
    ln(o,[PL(s,0,33),PL(s,1,33)],sh(MAT.brick.w,0.7),0.9);
    [[0.00,0.26,13,'#8a5a48'],[0.74,1.00,20,'#7d6a58']].forEach(([na,nb,drop,col])=>{
      const nh=s.h-drop;
      fp(o,[P(s.x0,na,0),P(s.x0,nb,0),P(s.x0,nb,nh),P(s.x0,na,nh)],sh(col,1.06),sh(col,0.62),0.9);
      fp(o,[P(s.x0,na,nh),P(s.x0,nb,nh),P(s.x0-0.05,nb,nh+2.6),P(s.x0-0.05,na,nh+2.6)],sh(col,0.8),sh(col,0.56),0.9);
      fp(o,[P(s.x0,na+0.05,20),P(s.x0,nb-0.05,20),P(s.x0,nb-0.05,30),P(s.x0,na+0.05,30)],C.trim,sh(C.trim,0.7),0.7);
      fp(o,[P(s.x0,na+0.075,22),P(s.x0,nb-0.075,22),P(s.x0,nb-0.075,28),P(s.x0,na+0.075,28)],C.glassDim,sh(C.glassDim,0.8),0.6);
    });
    chimney(s,o,0.66,0.30,56,66,0.028);
    bush(o,0.24,0.16,8,5,C.leafDark); bush(o,0.24,0.84,8,5,C.leaf2);
    tree(o,0.12,0.50,14,9,'#8fa05c'); flowers(o,0.26,0.70,7,0.14); }};

function drawHouse(id){
  const s=Object.assign({},H[id]), o=mk();
  shadow(o); plinth(o,s.pathY);
  if(s.backTrees) s.backTrees(o,s);
  wallFaces(s,o); roofFaces(s,o);
  (s.windows||[]).forEach(w=>window(s,o,w));
  (s.doors||[]).forEach(w=>door(s,o,w));
  if(s.extra) s.extra(o,s);
  return o;
}
function bounds(o){
  let mnx=1e9,mny=1e9,mxx=-1e9,mxy=-1e9;
  o.forEach(sp=>sp.pts.forEach(p=>{mnx=Math.min(mnx,p[0]);mxx=Math.max(mxx,p[0]);mny=Math.min(mny,p[1]);mxy=Math.max(mxy,p[1]);}));
  return [mnx,mny,mxx,mxy];
}

// ---- condition states (coloured overlays, same transform as the base) ----
const ANCH={
 bungalow:{lawn:[0.09,0.25,0.74,0.96]}, ranch:{lawn:[0.10,0.40,0.58,0.96]},
 duplex:{lawn:[0.10,0.30,0.62,0.96]},  mill_loft:{lawn:[0.07,0.22,0.58,0.94]},
 victorian:{lawn:[0.06,0.21,0.58,0.96]}, split_level:{lawn:[0.05,0.15,0.40,0.96]},
 new_build:{lawn:[0.07,0.25,0.42,0.66]},
 colonial:{lawn:[0.06,0.24,0.60,0.96]}, condo:{lawn:[0.05,0.18,0.30,0.62]},
 townhouse:{lawn:[0.08,0.26,0.34,0.70]}
};
function cube(o,x0,y0,x1,y1,z0,z1,col){
  fp(o,[P(x0,y0,z1),P(x1,y0,z1),P(x1,y1,z1),P(x0,y1,z1)],sh(col,1.14),sh(col,0.58),0.7);
  fp(o,[P(x0,y0,z0),P(x0,y1,z0),P(x0,y1,z1),P(x0,y0,z1)],sh(col,1.0),sh(col,0.58),0.7);
  fp(o,[P(x0,y1,z0),P(x1,y1,z0),P(x1,y1,z1),P(x0,y1,z1)],sh(col,0.8),sh(col,0.52),0.7);
}
function glassOver(s,o,w,col,edge){
  const F=w.face==='L'?PL:PR, i=0.16, iv=w.h*0.13;
  fp(o,[F(s,w.u+w.w*i,w.v+iv),F(s,w.u+w.w*(1-i),w.v+iv),F(s,w.u+w.w*(1-i),w.v+w.h-iv),F(s,w.u+w.w*i,w.v+w.h-iv)],col,edge,0.6);
}
function weeds(o,gx,gy,n,spread,col){
  for(let i=0;i<n;i++){
    const bx=gx+(Math.random()-0.5)*spread, by=gy+(Math.random()-0.5)*spread;
    const b=P(bx,by,0), t=P(bx,by,4+Math.random()*5);
    fp(o,[[b[0]-1.1,b[1]],[t[0]+(Math.random()-0.5)*3,t[1]],[b[0]+1.1,b[1]]],col||'#8a8d4e',sh(col||'#8a8d4e',0.72),0.5);
  }
}
const CSTATES={
 distressed(s,o){
  const L=ANCH[s.id].lawn;
  // dead lawn patches
  for(let i=0;i<8;i++){ const x=0.10+Math.random()*0.80, y=0.10+Math.random()*0.80, c=P(x,y,0);
    fp(o,[[c[0]-7,c[1]],[c[0],c[1]-4],[c[0]+7,c[1]],[c[0],c[1]+4]],'#9c9464','none'); }
  (s.windows||[]).forEach(w=>{
    glassOver(s,o,w,'#3b4247',sh('#3b4247',0.8));
    const F=w.face==='L'?PL:PR;
    [0.30,0.62].forEach(t=>fp(o,[F(s,w.u-0.008,w.v+w.h*t),F(s,w.u+w.w+0.008,w.v+w.h*(t+0.06)),
      F(s,w.u+w.w+0.008,w.v+w.h*(t+0.20)),F(s,w.u-0.008,w.v+w.h*(t+0.14))],'#9a7b55',sh('#9a7b55',0.68),0.6));
  });
  (s.doors||[]).forEach(w=>{const F=w.face==='L'?PL:PR;
    fp(o,[F(s,w.u-0.01,w.v+w.h*0.32),F(s,w.u+w.w+0.01,w.v+w.h*0.42),
          F(s,w.u+w.w+0.01,w.v+w.h*0.60),F(s,w.u-0.01,w.v+w.h*0.50)],'#9a7b55',sh('#9a7b55',0.68),0.6);});
  // holes in the roofline
  const ov=s.ov??0.05, a0=s.x0-ov, xm=(s.x0+s.x1)/2, zr=s.h+(s.rh||0);
  if(s.roof==='gable'||s.roof==='hip'){
    [[0.30,0.24],[0.62,0.58],[0.44,0.80]].forEach(([t,u])=>{
      const q=(tt,uu)=>P(a0+tt*(xm-a0), s.y0+uu*(s.y1-s.y0), s.h+tt*s.rh);
      fp(o,[q(t,u),q(t+0.15,u+0.05),q(t+0.11,u+0.17),q(t-0.03,u+0.13)],'#2a2b2c',sh('#2a2b2c',1.6),0.6);});
  }
  weeds(o,(L[0]+L[1])/2,(L[2]+L[3])/2,10,0.16);
  weeds(o,s.x0-0.03,0.30,7,0.22,'#7d8a4a');
  weeds(o,(s.x0+s.x1)/2,s.y1+0.03,7,0.20,'#7d8a4a');
  // fallen gutter
  const gp=P(s.x0,0.30,s.h), gq=P(s.x0-0.03,0.36,s.h-9);
  fp(o,[gp,[gp[0]+2,gp[1]+1],[gq[0]+2,gq[1]+1],gq],'#8e8b80','#6a6862',0.6);
 },
 occupied(s,o){
  (s.windows||[]).forEach(w=>{
    glassOver(s,o,w,C.glass,C.frame);
    const F=w.face==='L'?PL:PR, i=0.18;
    fp(o,[F(s,w.u+w.w*i,w.v+w.h*0.10),F(s,w.u+w.w*(i+0.16),w.v+w.h*0.10),
          F(s,w.u+w.w*(i+0.16),w.v+w.h*0.90),F(s,w.u+w.w*i,w.v+w.h*0.90)],'#e8ddc6',sh('#e8ddc6',0.72),0.5);
    fp(o,[F(s,w.u+w.w*(1-i-0.16),w.v+w.h*0.10),F(s,w.u+w.w*(1-i),w.v+w.h*0.10),
          F(s,w.u+w.w*(1-i),w.v+w.h*0.90),F(s,w.u+w.w*(1-i-0.16),w.v+w.h*0.90)],'#e8ddc6',sh('#e8ddc6',0.72),0.5);
  });
  const L=ANCH[s.id].lawn, cx0=L[0], cx1=Math.min(L[1],L[0]+0.17), cy0=L[2], cy1=Math.min(L[3],L[2]+0.30);
  cube(o,cx0,cy0,cx1,cy1,2,8,'#8a4f46');
  cube(o,cx0+0.02,cy0+0.07,cx1-0.02,cy1-0.07,8,13,'#a8635a');
  glassOverBox(o,cx0+0.02,cy0+0.09,cy1-0.09,9,12);
  [cy0+0.05,cy1-0.05].forEach(y=>{const b=P(cx0,y,1.6);
    fp(o,[[b[0]-2,b[1]],[b[0]+2,b[1]],[b[0]+2,b[1]+2],[b[0]-2,b[1]+2]],'#2f3134','none');});
  // wheelie bin and a bike by the door
  cube(o,cx1+0.02,cy1-0.10,cx1+0.10,cy1-0.02,0,9,'#4a5a4c');
  const bp=P(s.x0-0.02,0.26,0);
  fp(o,[[bp[0]-5,bp[1]-4],[bp[0]+5,bp[1]-6],[bp[0]+5,bp[1]-3],[bp[0]-5,bp[1]-1]],'#3f5766','#2a3b47',0.5);
 },
 working(s,o){
  // scaffold on the clear right facade
  const gy=s.y1+0.035, x0=s.x0, x1=s.x1, top=s.h+7, tube='#a9a48f';
  const us=[0.02,0.5,0.98];
  us.forEach(u=>{const gx=x0+u*(x1-x0);
    fp(o,[P(gx,gy,0),P(gx,gy,top)],'none',sh(tube,0.8),0);
    const a=P(gx,gy,0), b=P(gx,gy,top);
    fp(o,[[a[0]-0.9,a[1]],[a[0]+0.9,a[1]],[b[0]+0.9,b[1]],[b[0]-0.9,b[1]]],tube,sh(tube,0.7),0.5);});
  const lifts=[]; for(let z=top; z>3; z-=Math.max(11,top/4)) lifts.push(z);
  lifts.forEach(z=>{const a=P(x0,gy,z), b=P(x1,gy,z);
    fp(o,[[a[0],a[1]-0.9],[b[0],b[1]-0.9],[b[0],b[1]+0.9],[a[0],a[1]+0.9]],tube,sh(tube,0.7),0.5);});
  for(let i=0;i<lifts.length-1;i++){
    const m=i%2?[0.02,0.5]:[0.5,0.98];
    const a=P(x0+m[0]*(x1-x0),gy,lifts[i+1]), b=P(x0+m[1]*(x1-x0),gy,lifts[i]);
    fp(o,[[a[0],a[1]-1],[b[0],b[1]-1],[b[0],b[1]+1],[a[0],a[1]+1]],sh(tube,0.92),'none',0);
  }
  // a plank platform on the top lift
  const pa=P(x0,gy-0.02,lifts[0]-1), pb=P(x0+0.55*(x1-x0),gy-0.02,lifts[0]-1);
  fp(o,[[pa[0],pa[1]-1.6],[pb[0],pb[1]-1.6],[pb[0],pb[1]+1.6],[pa[0],pa[1]+1.6]],'#b99a6e',sh('#b99a6e',0.7),0.6);
  const L=ANCH[s.id].lawn;
  const sx0=L[0], sx1=Math.min(L[1],L[0]+0.15), sy0=L[2], sy1=Math.min(L[3],L[2]+0.24);
  // skip
  fp(o,[P(sx0,sy0,0),P(sx0,sy1,0),P(sx0,sy1,9),P(sx0,sy0,11)],sh('#b06a2e',1.02),sh('#b06a2e',0.6),0.7);
  fp(o,[P(sx0,sy1,0),P(sx1,sy1,0),P(sx1,sy1,9),P(sx0,sy1,9)],sh('#b06a2e',0.82),sh('#b06a2e',0.55),0.7);
  fp(o,[P(sx0,sy0,11),P(sx1,sy0,12.5),P(sx1,sy1,9),P(sx0,sy1,9)],sh('#8a5222',0.9),sh('#b06a2e',0.55),0.7);
  for(let i=0;i<5;i++){const bx=sx0+0.02+Math.random()*0.08, by=sy0+0.03+Math.random()*(sy1-sy0-0.06);
    const c=P(bx,by,10+Math.random()*4);
    fp(o,[[c[0]-3,c[1]],[c[0],c[1]-2],[c[0]+3,c[1]],[c[0],c[1]+2]],['#9a8b74','#7d6a52','#a89a84'][i%3],'none');}
  // material stack + permit board
  const mx=Math.min(L[1],L[0]+0.13);
  for(let i=0;i<3;i++) cube(o,L[0]+0.01,sy1+0.03,mx,Math.min(L[3],sy1+0.16),i*3,i*3+2.4,'#b99a6e');
  const bxp=L[1]+0.01, by0=L[2]-0.16, by1=L[2]-0.02;
  const p0=P(bxp,(by0+by1)/2,0), p1=P(bxp,(by0+by1)/2,10);
  fp(o,[[p0[0]-1.2,p0[1]],[p0[0]+1.2,p0[1]],[p1[0]+1.2,p1[1]],[p1[0]-1.2,p1[1]]],'#8a7458','none');
  fp(o,[P(bxp,by0,9),P(bxp,by1,9),P(bxp,by1,17),P(bxp,by0,17)],'#e4dcc6',sh('#e4dcc6',0.68),0.7);
  [11,13,15].forEach(z=>fp(o,[P(bxp,by0+0.015,z),P(bxp,by1-0.03,z),P(bxp,by1-0.03,z+0.9),P(bxp,by0+0.015,z+0.9)],'#8d8778','none'));
  (s.windows||[]).filter((_,i)=>i%4===0).forEach(w=>glassOver(s,o,w,'#c9cfd2',sh('#c9cfd2',0.75)));
 },
 finished(s,o){
  (s.windows||[]).forEach(w=>glassOver(s,o,w,C.glass,C.frame));
  const L=ANCH[s.id].lawn, bxp=(L[0]+L[1])/2, by0=L[2]+0.02, by1=Math.min(L[3],L[2]+0.20);
  const p0=P(bxp,(by0+by1)/2,0), p1=P(bxp,(by0+by1)/2,12);
  fp(o,[[p0[0]-1.4,p0[1]],[p0[0]+1.4,p0[1]],[p1[0]+1.4,p1[1]],[p1[0]-1.4,p1[1]]],'#8a7458','none');
  fp(o,[P(bxp,by0,11),P(bxp,by1,11),P(bxp,by1,21),P(bxp,by0,21)],'#f2ece0',sh('#f2ece0',0.66),0.8);
  fp(o,[P(bxp,by0+0.02,13),P(bxp,by1-0.02,13),P(bxp,by1-0.02,18.5),P(bxp,by0+0.02,18.5)],'#b3453a','none');
  fp(o,[P(bxp,by0+0.035,14.4),P(bxp,by1-0.06,14.4),P(bxp,by1-0.06,17),P(bxp,by0+0.035,17)],'#f7f2e6','none');
  for(let i=0;i<6;i++) bush(o,s.x0-0.035,0.10+i*0.15,6,4,i%2?C.leaf:C.leaf2);
  for(let i=0;i<4;i++) bush(o,(s.x0+s.x1)/2-0.12+i*0.11,s.y1+0.04,5.5,3.6,C.leaf);
  flowers(o,s.x0-0.035,0.44,10,0.30);
  flowers(o,bxp,by1+0.10,8,0.14);
  const t0=P(L[0]+0.02,L[3]-0.06,0), t1=P(L[1]-0.02,L[3]-0.06,0);
  fp(o,[[t0[0],t0[1]-3],[t1[0],t1[1]-3],[t1[0],t1[1]+3],[t0[0],t0[1]+3]],sh(C.path,1.02),C.pathLine,0.6);
 }
};
function glassOverBox(o,gx,y0,y1,z0,z1){
  fp(o,[P(gx,y0,z0),P(gx,y1,z0),P(gx,y1,z1),P(gx,y0,z1)],'#7fa0b4',sh('#7fa0b4',0.72),0.5);
}
function drawState(id,st){
  const s=Object.assign({id},H[id]), o=mk();
  CSTATES[st](s,o); return o;
}

const CF={};
CF.tree_oak=o=>tree(o,0.5,0.5,17,13,'#7f9a5c');
CF.tree_pine=o=>{ const b=P(0.5,0.5,0), t=P(0.5,0.5,10);
  fp(o,[[b[0]-2,b[1]],[b[0]+2,b[1]],[t[0]+1.6,t[1]],[t[0]-1.6,t[1]]],'#6b5340','#4c3b2c',0.7);
  [[10,12,6],[19,9.5,4.8],[27,6.5,3.4]].forEach(([z,rx,ry],i)=>{const c=P(0.5,0.5,z);
    fp(o,[[c[0]-rx,c[1]],[c[0],c[1]+ry],[c[0]+rx,c[1]],[c[0],c[1]-ry-8]],
      i%2?'#4f6b3c':'#5c7a45',sh('#4f6b3c',0.7),0.7);});};
CF.tree_slim=o=>{ const b=P(0.5,0.5,0), t=P(0.5,0.5,14);
  fp(o,[[b[0]-1.8,b[1]],[b[0]+1.8,b[1]],[t[0]+1.4,t[1]],[t[0]-1.4,t[1]]],'#6b5340','#4c3b2c',0.7);
  const c=P(0.5,0.5,30), pts=[];
  for(let i=0;i<11;i++){const a=Math.PI*2*i/11; pts.push([c[0]+8*Math.cos(a), c[1]+15*Math.sin(a)]);}
  fp(o,pts,'#6f8a52','#54693d',0.7);};
CF.driveway=o=>{ fp(o,[P(.06,.10,0),P(.06,.90,0),P(.94,.90,0),P(.94,.10,0)],C.path,C.pathLine,0.8);
  [0.34,0.66].forEach(t=>ln(o,[P(.06,.10+t*.80,0),P(.94,.10+t*.80,0)],C.pathLine,0.6));
  ln(o,[P(.50,.10,0),P(.50,.90,0)],C.pathLine,0.6);};
CF.fence=o=>{ const y0=.05,y1=.95, col='#b39a72';
  for(let i=0;i<=5;i++){const y=y0+(y1-y0)*i/5, a=P(.5,y,0), b=P(.5,y,13);
    fp(o,[[a[0]-1.5,a[1]],[a[0]+1.5,a[1]],[b[0]+1.5,b[1]-2],[b[0],b[1]-4],[b[0]-1.5,b[1]-2]],col,sh(col,0.68),0.6);}
  [10,4.5].forEach(z=>{const a=P(.5,y0,z), b=P(.5,y1,z);
    fp(o,[[a[0],a[1]-1.4],[b[0],b[1]-1.4],[b[0],b[1]+1.4],[a[0],a[1]+1.4]],sh(col,1.04),sh(col,0.7),0.5);});};
CF.hedge=o=>{ const y0=.05,y1=.95;
  fp(o,[P(.34,y0,10),P(.66,y0,10),P(.66,y1,10),P(.34,y1,10)],'#5f7a43','#44582f',0.7);
  fp(o,[P(.34,y0,0),P(.34,y1,0),P(.34,y1,10),P(.34,y0,10)],'#6f8a52','#44582f',0.7);
  fp(o,[P(.34,y1,0),P(.66,y1,0),P(.66,y1,10),P(.34,y1,10)],'#54693d','#3b4d29',0.7);
  for(let i=0;i<6;i++) bush(o,.34+Math.random()*0.3,y0+(y1-y0)*(i+0.5)/6,5,11,'#6f8a52');};
CF.pool=o=>{ fp(o,[P(.06,.14,0),P(.06,.86,0),P(.94,.86,0),P(.94,.14,0)],C.path,C.pathLine,0.8);
  fp(o,[P(.16,.24,0),P(.16,.76,0),P(.84,.76,0),P(.84,.24,0)],'#6fa3b8','#4b7d92',0.7);
  [0.3,0.5,0.7].forEach(t=>ln(o,[P(.24,.24+t*.52,0),P(.62,.24+t*.52,0)],'#a3ccdb',0.7));
  const a=P(.16,.34,0), b=P(.16,.44,6);
  fp(o,[[a[0]-1,a[1]],[a[0]+1,a[1]],[b[0]+1,b[1]],[b[0]-1,b[1]]],'#cfcabb','none');};
CF.skip=o=>{ const x0=.24,x1=.76,y0=.16,y1=.84, col='#b06a2e';
  fp(o,[P(x0,y0,0),P(x0,y1,0),P(x0,y1,10),P(x0,y0,12)],sh(col,1.04),sh(col,0.6),0.7);
  fp(o,[P(x0,y1,0),P(x1,y1,0),P(x1,y1,10),P(x0,y1,10)],sh(col,0.82),sh(col,0.55),0.7);
  fp(o,[P(x0,y0,12),P(x1,y0,13.5),P(x1,y1,10),P(x0,y1,10)],'#7d5a3c','#5c422b',0.7);
  for(let i=0;i<6;i++){const c=P(x0+0.04+Math.random()*0.4,y0+0.06+Math.random()*0.6,11+Math.random()*4);
    fp(o,[[c[0]-3.4,c[1]],[c[0],c[1]-2.2],[c[0]+3.4,c[1]],[c[0],c[1]+2.2]],['#9a8b74','#7d6a52','#a89a84'][i%3],'none');}};
function cboard(o,panel,lines,ph,pz0,pz1){
  const xm=.5, y0=.20,y1=.80;
  const p0=P(xm,(y0+y1)/2,0), p1=P(xm,(y0+y1)/2,ph);
  fp(o,[[p0[0]-1.6,p0[1]],[p0[0]+1.6,p0[1]],[p1[0]+1.6,p1[1]],[p1[0]-1.6,p1[1]]],'#8a7458','#63523c',0.6);
  fp(o,[P(xm,y0,pz0),P(xm,y1,pz0),P(xm,y1,pz1),P(xm,y0,pz1)],panel,sh(panel,0.66),0.8);
  lines.forEach(([z,w,col])=>fp(o,[P(xm,y0+0.04,z),P(xm,y0+0.04+w,z),P(xm,y0+0.04+w,z+1.4),P(xm,y0+0.04,z+1.4)],col,'none'));
}
CF.permit_board=o=>cboard(o,'#e4dcc6',[[14,0.48,'#8d8778'],[17,0.52,'#8d8778'],[20,0.36,'#8d8778']],14,11,24);
CF.sold_sign=o=>{ cboard(o,'#f2ece0',[[15,0.5,'#b3453a'],[19,0.42,'#b3453a']],16,12,26);
  const xm=.5; fp(o,[P(xm,.20,12),P(xm,.80,26),P(xm,.80,23),P(xm,.20,9)],'#b3453a','none');};
CF.for_sale_sign=o=>cboard(o,'#f2ece0',[[15,0.5,'#3f6187'],[18.6,0.44,'#3f6187'],[22,0.3,'#8d8778']],16,12,26);
CF.rival_hoarding=o=>{ const xm=.5;
  [.18,.82].forEach(y=>{const a=P(xm,y,0), b=P(xm,y,14);
    fp(o,[[a[0]-1.6,a[1]],[a[0]+1.6,a[1]],[b[0]+1.6,b[1]],[b[0]-1.6,b[1]]],'#8a7458','#63523c',0.6);});
  fp(o,[P(xm,.06,13),P(xm,.94,13),P(xm,.94,34),P(xm,.06,34)],'#dcd3bd',sh('#dcd3bd',0.66),0.8);
  fp(o,[P(xm,.10,28),P(xm,.62,28),P(xm,.62,32),P(xm,.10,32)],'#5980a6','none');
  [22,18.5].forEach(z=>fp(o,[P(xm,.10,z),P(xm,.72,z),P(xm,.72,z+1.6),P(xm,.10,z+1.6)],'#8d8778','none'));};
CF.parked_car=o=>{ const x0=.16,x1=.62,y0=.10,y1=.90, col='#8a4f46';
  cube(o,x0,y0,x1,y1,2.4,8,col);
  cube(o,x0+0.05,y0+0.20,x1-0.05,y1-0.20,8,13.5,sh(col,1.16));
  fp(o,[P(x0+0.05,y0+0.24,9),P(x0+0.05,y1-0.24,9),P(x0+0.05,y1-0.24,12.8),P(x0+0.05,y0+0.24,12.8)],'#7fa0b4',sh('#7fa0b4',0.72),0.5);
  [y0+0.14,y1-0.14].forEach(y=>{const b=P(x0,y,1.8);
    fp(o,[[b[0]-2.2,b[1]-1],[b[0]+2.2,b[1]-1],[b[0]+2.2,b[1]+1.6],[b[0]-2.2,b[1]+1.6]],'#2f3134','none');
    const c=P(x1,y,1.8);
    fp(o,[[c[0]-2.2,c[1]-1],[c[0]+2.2,c[1]-1],[c[0]+2.2,c[1]+1.6],[c[0]-2.2,c[1]+1.6]],'#2f3134','none');});};
CF.street_lamp=o=>{ const g=.5, a=P(g,g,0), b=P(g,g,54);
  fp(o,[[a[0]-2,a[1]],[a[0]+2,a[1]],[b[0]+1.4,b[1]],[b[0]-1.4,b[1]]],'#5b6068','#3e434a',0.7);
  const c=P(g,g+0.26,56);
  fp(o,[[b[0]-1.3,b[1]],[b[0]+1.3,b[1]-1],[c[0]+1.3,c[1]-1],[c[0]-1.3,c[1]]],'#5b6068','#3e434a',0.7);
  fp(o,[[c[0]-4,c[1]],[c[0],c[1]-3],[c[0]+4,c[1]],[c[0]+2.6,c[1]+5.4],[c[0]-2.6,c[1]+5.4]],'#f6c97c','#cfa557',0.7);
  const d=P(g,g,0); fp(o,[[d[0]-5,d[1]],[d[0],d[1]-3],[d[0]+5,d[1]],[d[0],d[1]+3]],'#6b6f74','#4a4e53',0.6);};
