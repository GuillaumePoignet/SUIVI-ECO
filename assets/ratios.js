'use strict';
/* SUIVI-ECO - panneau ratio.
   Le depot ne grave aucun ratio : grave, il deviendrait faux a la premiere
   revision de son numerateur. Il se calcule donc ICI, a la lecture, a partir
   des fichiers, et la page dit toujours de quel rapport il s'agit. */

function serieDe(D,spec){
  const F=D[spec.fichier];
  if(!F)return null;
  /* Certains fichiers du socle sont larges - une colonne par grandeur - et non
     au format long : M1_PIB_FRANCE en est un. On lit alors la colonne nommee. */
  if(F.serie.type==='table'){
    const c=corps(F.txt),h=c.head;
    let iT=h.indexOf('annee');if(iT<0)iT=h.indexOf('periode');
    const iV=h.indexOf(spec.colonne);
    if(iT<0||iV<0)return null;
    const m={};
    for(const r of c.rows){
      const v=num(r[iV]),x=periodeX(r[iT]);
      if(v!=null&&!isNaN(x))m[r[iT]]={x:x,v:v};
    }
    return {pts:m,choix:{},unite:'',nom:pretty(spec.colonne)};
  }
  if(F.serie.type!=='serie')return null;
  const s=F.serie,axe=D.axeFor(spec.fichier);
  const ch={};
  for(const f of s.facettes){
    const vs=s.vals[f];
    if(f==='grandeur'){
      const m=spec.grandeur?vs.find(g=>String(g).toLowerCase().indexOf(String(spec.grandeur).toLowerCase())>=0):null;
      ch[f]=m||vs[0];
    }
    else if(f==='vue')ch[f]=vs.indexOf(spec.vue||'courant')>=0?(spec.vue||'courant'):(vs.indexOf('brut')>=0?'brut':vs[0]);
    else if(/^code\d*$/.test(f)){
      if(spec.code&&vs.indexOf(spec.code)>=0)ch[f]=spec.code;
      else ch[f]=vs.find(cc=>estTotal(cc,libCode(s,axe,cc,f)))||vs[0];
    }
    else ch[f]=vs[0];
  }
  const rows=filtrer(s,ch);
  const m={};
  for(const o of rows)if(o.v!=null&&!isNaN(o.x))m[o.t]={x:o.x,v:o.v};
  return {pts:m,choix:ch,unite:uniteDe(rows),
          nom:(ch.grandeur?pretty(ch.grandeur):spec.fichier)+(ch.code?(' \u00b7 '+libCode(s,axe,ch.code)):'')};
}
function pRatio(zone,cfg,D){
  const sh=panneauShell(zone,cfg.titre,cfg.quoi);
  const A=serieDe(D,cfg.num),B=serieDe(D,cfg.den);
  if(!A||!B){sh.corps.innerHTML='<p class="note">Un des deux fichiers n\u2019est pas lisible comme s\u00e9rie.</p>';return;}
  const C=cfg.num2?serieDe(D,cfg.num2):null;
  const pts=[];
  for(const t in A.pts){
    if(!(t in B.pts)||B.pts[t].v===0)continue;
    let num=A.pts[t].v;
    if(C){ if(!(t in C.pts))continue; num=cfg.operation==='moins'?(num-C.pts[t].v):(num+C.pts[t].v); }
    pts.push({t:t,x:A.pts[t].x,v:num/B.pts[t].v*(cfg.pourcent===false?1:100)});
  }
  pts.sort((a,b)=>a.x-b.x);
  const cc=composantCourbe(sh.corps);
  const formule=cfg.formule||((C?(A.nom+(cfg.operation==='moins'?' moins ':' plus ')+C.nom):A.nom)+' \u00f7 '+B.nom);
  cc.maj(pts,{u:(cfg.pourcent===false?'':'pct'),lib:cfg.libelle||cfg.titre,
    meta:formule+'. '+pts.length+' p\u00e9riode(s) o\u00f9 les deux termes existent.'});
  if(!pts.length)sh.corps.insertAdjacentHTML('beforeend','<p class="note">Aucune p\u00e9riode ne porte les deux termes \u00e0 la fois.</p>');
}
