// Property Flipper — Scout board sprites. Isometric, standing on the ground plane.
// Anchor (ground contact) = [31, 52] in a 64x64 artboard, identical across all frames.
const SP={fur:'#a8845c',furD:'#8a6a47',muz:'#cdb08a',ink:'#4a3b2a',nose:'#332c28',
  hat:'#d99f33',hatD:'#a3752a',hatL:'#efbc52',vest:'#c3cc5e',vestD:'#9aa33f',
  dirt:'#8a6f4e',dirtD:'#6b5439'};
const F=64, GY=52, CX=31, BODY_BASE=GY-10;

function scoutSprite(M,line){
  const o=[], bob=M.bob||0, hy=M.headY||0;
  const add=(d,fill,stroke,sw)=>o.push({d,fill:line?'none':fill,stroke:line?'#000000':stroke,sw:sw||1.1});
  if(!line) o.push({d:`M${CX-13} ${GY} a13 4.2 0 1 0 26 0 a13 4.2 0 1 0 -26 0`,fill:'rgba(60,50,40,0.13)',stroke:null,sw:0});

  // legs — in line mode they start at the body's underside so nothing shows through
  const top=z=>line?BODY_BASE+bob-1:z;
  M.legs.slice(0,2).forEach(([lx,ly,fx])=>add(
    `M${CX+lx} ${top(GY-14+bob)} L${CX+lx+3.4} ${top(GY-14+bob)} L${CX+fx+3} ${GY+ly} L${CX+fx} ${GY+ly} Z`,SP.furD,SP.ink,1));

  add(`M${CX-11} ${GY-22+bob} C${CX-13} ${GY-13+bob} ${CX-8} ${GY-10+bob} ${CX+1} ${GY-10+bob}
    C${CX+11} ${GY-10+bob} ${CX+15} ${GY-14+bob} ${CX+14} ${GY-23+bob}
    C${CX+13} ${GY-30+bob} ${CX-9} ${GY-31+bob} ${CX-11} ${GY-22+bob} Z`,SP.fur,SP.ink,1.4);

  // hi-vis band: a fill in colour, two ribs in line
  if(line){
    add(`M${CX-7} ${GY-25+bob} C${CX-1} ${GY-28.5+bob} ${CX+6} ${GY-28.5+bob} ${CX+10.6} ${GY-25+bob}`,null,SP.ink,1);
    add(`M${CX-8} ${GY-21+bob} C${CX-2} ${GY-24.5+bob} ${CX+5} ${GY-24.5+bob} ${CX+10} ${GY-21+bob}`,null,SP.ink,1);
  } else {
    add(`M${CX-8} ${GY-27+bob} C${CX-2} ${GY-30+bob} ${CX+6} ${GY-30+bob} ${CX+11} ${GY-26+bob}
      L${CX+10} ${GY-21+bob} C${CX+5} ${GY-25+bob} ${CX-3} ${GY-25+bob} ${CX-8} ${GY-22+bob} Z`,SP.vest,SP.vestD,1);
  }

  M.legs.slice(2).forEach(([lx,ly,fx])=>add(
    `M${CX+lx} ${top(GY-15+bob)} L${CX+lx+3.6} ${top(GY-15+bob)} L${CX+fx+3.2} ${GY+ly} L${CX+fx} ${GY+ly} Z`,SP.fur,SP.ink,1));

  add(M.tail,null,line?'#000000':SP.furD,line?1.6:2.6);

  const hx=CX-13, hyy=GY-30+bob+hy;
  // ear first in line mode so the skull outline stays unbroken on top
  const ear=`M${hx+4} ${hyy-7} C${hx+9} ${hyy-4} ${hx+9} ${hyy+3} ${hx+5} ${hyy+5} C${hx+2} ${hyy+5} ${hx+2} ${hyy-4} ${hx+4} ${hyy-7} Z`;
  if(line) add(ear,SP.furD,SP.ink,1);
  add(`M${hx-7} ${hyy-6} C${hx-9} ${hyy+2} ${hx-4} ${hyy+7} ${hx+3} ${hyy+6}
    C${hx+9} ${hyy+5} ${hx+10} ${hyy-4} ${hx+6} ${hyy-8}
    C${hx+1} ${hyy-12} ${hx-5} ${hyy-11} ${hx-7} ${hyy-6} Z`,SP.fur,SP.ink,1.4);
  add(`M${hx-6} ${hyy-2} C${hx-13} ${hyy-1} ${hx-16} ${hyy+3} ${hx-14} ${hyy+6}
    C${hx-11} ${hyy+9} ${hx-4} ${hyy+7} ${hx-3} ${hyy+3}${line?'':' Z'}`,SP.muz,SP.ink,1);
  add(`M${hx-15} ${hyy+4} a2.1 1.9 0 1 0 4.2 0 a2.1 1.9 0 1 0 -4.2 0`,SP.nose,line?'#000000':null,1);
  add(`M${hx-4} ${hyy-4} a1.7 1.9 0 1 0 3.4 0 a1.7 1.9 0 1 0 -3.4 0`,'#2b2521',line?'#000000':null,1);
  if(!line) add(ear,SP.furD,SP.ink,1);

  // hard hat — brim last so it caps the skull
  add(`M${hx-8} ${hyy-8} C${hx-8} ${hyy-15} ${hx+3} ${hyy-16} ${hx+5} ${hyy-9}${line?'':' Z'}`,SP.hatL,SP.hatD,1.2);
  add(`M${hx-11} ${hyy-7.5} C${hx-6} ${hyy-11} ${hx+4} ${hyy-11.5} ${hx+8} ${hyy-8}
    C${hx+4} ${hyy-6} ${hx-6} ${hyy-5.5} ${hx-11} ${hyy-7.5} Z`,SP.hat,SP.hatD,1.2);

  (M.dirt||[]).forEach(([x,y,r])=>add(`M${x} ${y} l${r} ${-r*0.7} l${r*0.5} ${r*0.9} Z`,SP.dirt,SP.dirtD,0.8));

  const body=o.map(s=>`<path d="${s.d.replace(/\s+/g,' ').trim()}" fill="${s.fill||'none'}"${
    s.stroke?` stroke="${s.stroke}" stroke-width="${s.sw}" stroke-linejoin="round" stroke-linecap="round"`:''}/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${F} ${F}" width="${F}" height="${F}">${body}</svg>`;
}

const FRAMES={
 'idle-1':{bob:0,legs:[[6,0,7],[10,0,11],[-6,0,-6],[-1,0,-1]],
   tail:`M${CX+14} ${GY-26} C${CX+20} ${GY-29} ${CX+21} ${GY-35} ${CX+19} ${GY-38}`},
 'idle-2':{bob:1,headY:0.6,legs:[[6,0,7],[10,0,11],[-6,0,-6],[-1,0,-1]],
   tail:`M${CX+14} ${GY-25} C${CX+21} ${GY-26} ${CX+23} ${GY-31} ${CX+22} ${GY-35}`},
 'walking-1':{bob:0,legs:[[6,0,10],[10,0,8],[-6,0,-9],[-1,0,2]],
   tail:`M${CX+14} ${GY-26} C${CX+21} ${GY-28} ${CX+23} ${GY-33} ${CX+21} ${GY-37}`},
 'walking-2':{bob:1,legs:[[6,0,3],[10,0,13],[-6,0,-3],[-1,0,-4]],
   tail:`M${CX+14} ${GY-25} C${CX+20} ${GY-30} ${CX+20} ${GY-35} ${CX+17} ${GY-38}`},
 'digging-1':{bob:2,headY:3,legs:[[6,0,7],[10,0,11],[-7,-3,-11],[-2,0,-3]],
   tail:`M${CX+14} ${GY-24} C${CX+21} ${GY-27} ${CX+23} ${GY-32} ${CX+22} ${GY-36}`,
   dirt:[[11,44,4],[6,47,3]]},
 'digging-2':{bob:3,headY:4,legs:[[6,0,7],[10,0,11],[-7,-1,-14],[-2,0,-5]],
   tail:`M${CX+14} ${GY-23} C${CX+22} ${GY-24} ${CX+24} ${GY-29} ${CX+23} ${GY-33}`,
   dirt:[[9,41,5],[4,45,3.4],[14,46,2.6]]}
};
