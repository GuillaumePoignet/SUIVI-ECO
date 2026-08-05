'use strict';
/* SUIVI-ECO - couche de donnees commune.
   Lit le depot prive en mode brut, decouvre les colonnes des fichiers
   au format long (annee|periode ; ... ; valeur) et fournit filtres,
   series temporelles et valeurs de cartes, sans rien recalculer d'autre
   que des rapports toujours etiquetes. Regle absolue : aucune somme de
   codes n'est fabriquee, les nomenclatures du depot etant souvent
   emboitees (S13 contient S1311) ou non additives (des taux). */

const DEPOT='GuillaumePoignet/DEPOT-AGENT-ECO';
const AUJ=new Date().toISOString().slice(0,10);
const NAV=[
  ['vue-densemble','Vue d\u2019ensemble','vue-densemble.html'],
  ['branches','Production par branche','branches.html'],
  ['population','Population & territoire','population.html'],
  ['menages','M\u00e9nages','menages.html'],
  ['commerce','Commerce ext\u00e9rieur','commerce.html'],
  ['finances','Finances publiques','finances-publiques.html'],
  ['capital','Capital & patrimoine','capital.html'],
  ['monde','Monde & d\u00e9pendances','monde.html']
];

/* ---------- outils ---------- */
const $=id=>document.getElementById(id);
const NS='http://www.w3.org/2000/svg';
const el=(t,a)=>{const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);return e;};
const nf0=new Intl.NumberFormat('fr-FR');
const nf1=new Intl.NumberFormat('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1});
const nf2=new Intl.NumberFormat('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2});
const nf4=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:4});
const fmtPct=v=>(v>=0?'+':'\u2212')+nf1.format(Math.abs(v))+' %';
const ech=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const DATE_OK=/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const anneeFrac=iso=>{const p=iso.split('-').map(Number);return p[0]+((p[1]||1)-1)/12+((p[2]||1)-1)/365;};
const dFR=iso=>String(iso).split('-').reverse().join('/');
const fHM=d=>String(d.getHours()).padStart(2,'0')+'h'+String(d.getMinutes()).padStart(2,'0');
const dfPlein=new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short',year:'numeric'});
function lignes(txt){return txt.split(/\r?\n/);}
function entete(txt){return lignes(txt).filter(l=>l.startsWith('#')).join('\n');}
function corps(txt){const L=lignes(txt).filter(l=>l&&!l.startsWith('#'));const head=(L[0]||'').split(';');return {head,rows:L.slice(1).map(l=>l.split(';'))};}
function num(x){if(x==null||x==='')return null;const n=Number(String(x).replace(',','.'));return isNaN(n)?null:n;}
function periodeX(t){
  t=String(t);
  if(/^\d{4}$/.test(t))return +t;
  let m=t.match(/^(\d{4})-T([1-4])$/i);if(m)return +m[1]+(+m[2]-1)/4;
  m=t.match(/^(\d{4})-M(\d{2})$/i);if(m&&+m[2]>=1&&+m[2]<=12)return +m[1]+(+m[2]-1)/12;
  m=t.match(/^(\d{4})-(\d{2})$/);if(m&&+m[2]>=1&&+m[2]<=12)return +m[1]+(+m[2]-1)/12;
  if(DATE_OK.test(t))return anneeFrac(t);
  return NaN;
}
function pretty(g){return String(g==null?'':g).replace(/_/g,' ');}
function fmtU(v,u){
  if(v==null)return {court:'\u2014',exact:null};
  const ul=String(u||'').toLowerCase();
  if(/meur|millions d/.test(ul)){
    if(Math.abs(v)>=100000)return {court:nf1.format(v/1000)+' Md\u20ac',exact:nf0.format(Math.round(v))+' M\u20ac'};
    return {court:nf0.format(Math.round(v))+' M\u20ac',exact:null};
  }
  if(/pct|%/.test(ul))return {court:(Math.abs(v)<10?nf2:nf1).format(v)+' %',exact:null};
  if(/millier/.test(ul))return {court:nf0.format(Math.round(v))+' milliers',exact:null};
  if(/^euros?$|^eur$/.test(ul))return {court:nf0.format(Math.round(v))+' \u20ac',exact:null};
  const c=Math.abs(v)>=1000?nf0.format(Math.round(v)):(Math.abs(v)>=10?nf1.format(v):nf4.format(v));
  return {court:c+(u?' '+u:''),exact:null};
}

/* ---------- acces au depot ---------- */
function cleActuelle(){return localStorage.getItem('se_cle')||sessionStorage.getItem('se_cle')||'';}
async function ghTexte(chemin){
  const r=await fetch('https://api.github.com/repos/'+DEPOT+'/contents/'+chemin+'?ref=main',
    {headers:{Authorization:'Bearer '+cleActuelle(),Accept:'application/vnd.github.raw'}});
  if(r.status===401||r.status===403)throw new Error('AUTH');
  if(r.status===404)throw new Error('ABSENT:'+chemin);
  if(!r.ok)throw new Error('HTTP '+r.status);
  return r.text();
}
async function ghApi(suite){
  const r=await fetch('https://api.github.com/repos/'+DEPOT+'/'+suite,
    {headers:{Authorization:'Bearer '+cleActuelle(),Accept:'application/vnd.github+json'}});
  if(r.status===401||r.status===403)throw new Error('AUTH');
  if(!r.ok)throw new Error('HTTP '+r.status);
  return r.json();
}

/* ---------- lecture des fichiers longs ---------- */
function parseLong(txt){
  const c=corps(txt),head=c.head,rows=c.rows;
  const iV=head.indexOf('valeur');
  let iT=head.indexOf('annee');if(iT<0)iT=head.indexOf('periode');
  if(iV<0||iT<0)return {type:'table',head,rows};
  const catsAll=[];head.forEach((h,i)=>{if(i!==iT&&i!==iV)catsAll.push(h);});
  const vals={},seen={};for(const cc of catsAll){vals[cc]=[];seen[cc]={};}
  const libInterne={};const obs=[];
  for(const r of rows){
    const t=r[iT],x=periodeX(t),v=num(r[iV]);const co={};
    head.forEach((h,i)=>{if(i!==iT&&i!==iV)co[h]=r[i];});
    if(co.libelle!=null&&co.code!=null&&!(co.code in libInterne))libInterne[co.code]=co.libelle;
    obs.push({t,x,v,c:co});
    for(const cc of catsAll){const vv=co[cc];if(!seen[cc][vv]){seen[cc][vv]=1;vals[cc].push(vv);}}
  }
  const facettes=catsAll.filter(cc=>cc!=='unite'&&cc!=='libelle'&&vals[cc].length>1);
  return {type:'serie',head,obs,vals,facettes,libInterne};
}
function axeDe(parsed){
  const head=parsed.head,rows=parsed.rows||[];
  let iC=head.indexOf('code');if(iC<0)iC=0;
  let iL=head.indexOf('libelle');if(iL<0)iL=head.length>1?1:0;
  const m={};for(const r of rows)m[r[iC]]=r[iL];return m;
}
function estTotal(code,lib){return /^(TOT|TOTAL|ENS|_T)$/i.test(String(code))||/total|ensemble/i.test(String(lib||''));}
function libCode(s,axe,code){return (axe&&axe[code])||(s.libInterne&&s.libInterne[code])||code;}
function filtrer(s,choix){
  return s.obs.filter(o=>{for(const k in choix){const v=choix[k];if(v==null)continue;if(o.c[k]!==v)return false;}return true;});
}
function serieTemps(rows){
  const m={},ord=[];let ecartes=0;
  for(const o of rows){
    if(o.v==null||isNaN(o.x)){ecartes++;continue;}
    if(!(o.t in m))ord.push(o.t);
    m[o.t]=o;
  }
  const pts=ord.map(t=>m[t]).sort((a,b)=>a.x-b.x).map(o=>({t:o.t,x:o.x,v:o.v}));
  return {pts,ecartes};
}
function uniteDe(rows){for(const o of rows){if(o.c.unite)return o.c.unite;}return '';}
function defautChoix(s,axe,motif){
  const ch={};
  for(const f of s.facettes){
    const vs=s.vals[f];
    if(f==='grandeur')ch[f]=(motif&&vs.find(g=>String(g).toLowerCase().indexOf(motif)>=0))||vs[0];
    else if(f==='vue')ch[f]=vs.indexOf('brut')>=0?'brut':vs[0];
    else if(f==='code'){const tot=vs.find(cc=>estTotal(cc,libCode(s,axe,cc)));ch[f]=tot||vs[0];}
    else ch[f]=vs[0];
  }
  return ch;
}
/* Valeur d'une carte : une observation reelle du fichier, jamais un agregat
   fabrique. Si aucun code d'ensemble n'est reconnu, le premier code du fichier
   est retenu ET nomme dans la carte, pour qu'on ne le lise pas comme un total. */
function carteValeur(s,axe,motif){
  const ch={};let gMatched=false;
  for(const f of s.facettes){
    const vs=s.vals[f];
    if(f==='grandeur'){const m=motif?vs.find(g=>String(g).toLowerCase().indexOf(motif)>=0):null;gMatched=!!m;ch[f]=m||vs[0];}
    else if(f==='vue')ch[f]=vs.indexOf('brut')>=0?'brut':vs[0];
    else ch[f]=vs[0];
  }
  let codeNote='';
  if(s.facettes.indexOf('code')>=0){
    const vs=s.vals.code;
    const tot=vs.find(cc=>estTotal(cc,libCode(s,axe,cc)));
    ch.code=tot||vs[0];
    codeNote=libCode(s,axe,ch.code);
    if(!tot&&vs.length>1)codeNote+=' (1 des '+vs.length+' postes)';
  }
  const g=ch.grandeur||(s.vals.grandeur?s.vals.grandeur[0]:'');
  const rows=filtrer(s,ch);
  const pts=serieTemps(rows).pts;
  if(!pts.length)return null;
  const der=pts[pts.length-1],av=pts.length>1?pts[pts.length-2]:null;
  return {g,gMatched,t:der.t,v:der.v,prevT:av?av.t:null,prevV:av?av.v:null,u:uniteDe(rows),codeNote};
}
