'use strict';
/* SUIVI-ECO - couche d'interface commune : gabarit de page, graphes,
   panneaux generiques (cartes, classement, explorateur) et demarrage. */

let heureGravure=null,heureLecture=null,echecLecture=false,mnt=null,gradN=0;

/* ---------- primitives de trace ---------- */
function nfAuto(v){
  if(Math.abs(v)>=1000)return nf0.format(Math.round(v));
  if(Math.abs(v)>=10)return Number.isInteger(v)?nf0.format(v):nf1.format(v);
  return Math.abs(v)>=1&&Number.isInteger(v)?nf0.format(v):nf2.format(v);
}
function grilleYc(svg,y0,y1,Y,gL,W,gR,div){
  div=div||1;
  const et=y1-y0;let pas=et/6;
  for(const p of [0.01,0.02,0.05,0.1,0.2,0.25,0.5,1,2,2.5,5,10,20,25,50,100,200,250,500,1000,2000,2500,5000,10000,20000,25000,50000,100000,200000,500000]){if(et/p<=7){pas=p;break;}}
  for(let v=Math.ceil(y0/pas)*pas;v<=y1+1e-9;v+=pas){
    const zero=Math.abs(v)<1e-9;
    svg.appendChild(el('line',{x1:gL,x2:W-gR,y1:Y(v),y2:Y(v),stroke:zero?'#CBD2DE':'var(--ligne2)','stroke-width':1}));
    const t=el('text',{x:gL-10,y:Y(v)+4,'text-anchor':'end','font-size':13,fill:'var(--muet)','font-family':'Public Sans'});
    t.textContent=nfAuto(v/div);svg.appendChild(t);
  }
}
function grilleXc(svg,x0,x1,X,H,gB){
  const et=Math.max(1,x1-x0);let pas=1;
  for(const p of [1,2,5,10,20,25,50]){if(et/p<=9){pas=p;break;}}
  for(let v=Math.ceil(x0/pas)*pas;v<=x1+1e-9;v+=pas){
    const t=el('text',{x:X(v),y:H-11,'text-anchor':'middle','font-size':13,fill:'var(--muet)','font-family':'Public Sans'});
    t.textContent=v;svg.appendChild(t);
  }
}
function degrade(svg,id,couleur){
  const defs=el('defs',{}),g=el('linearGradient',{id,x1:0,y1:0,x2:0,y2:1});
  const s1=el('stop',{offset:'0%','stop-color':couleur,'stop-opacity':0.12});
  const s2=el('stop',{offset:'100%','stop-color':couleur,'stop-opacity':0});
  g.appendChild(s1);g.appendChild(s2);defs.appendChild(g);svg.appendChild(defs);
}
function etiquetteFin(svg,x,y,txt,couleur){
  const t=el('text',{x:x-8,y:y-12,'text-anchor':'end','font-size':14,'font-weight':700,fill:couleur,'font-family':'Public Sans','paint-order':'stroke',stroke:'#fff','stroke-width':4});
  t.textContent=txt;svg.appendChild(t);
}

/* ---------- composant courbe (svg + infobulle + curseur) ---------- */
function composantCourbe(host){
  const bloc=document.createElement('div');
  bloc.innerHTML='<div class="chartbox"><svg viewBox="0 0 1000 400" role="img"></svg><div class="tip" hidden></div></div>'+
    '<div class="explore"><div class="valSel" hidden></div>'+
    '<div class="curseur"><label>Choisir une p\u00e9riode</label><input type="range" min="0" max="0" value="0" step="1">'+
    '<span class="exp-an"></span></div><div class="exp-val"></div></div>'+
    '<p class="metaC"></p>';
  host.appendChild(bloc);
  const box=bloc.querySelector('.chartbox'),svg=box.querySelector('svg'),tip=box.querySelector('.tip');
  const slider=bloc.querySelector('input'),expAn=bloc.querySelector('.exp-an'),expVal=bloc.querySelector('.exp-val'),meta=bloc.querySelector('.metaC');
  const valSel=bloc.querySelector('.valSel');
  const W=1000,H=400,gL=104,gR=24,gT=26,gB=40;
  let pts=[],ctx={},X=null,Y=null,pinL=null,pinC=null;
  function majPin(){
    if(!pinL)return;
    const p=pts[+slider.value];
    if(!p){pinL.setAttribute('visibility','hidden');pinC.setAttribute('visibility','hidden');expAn.textContent='';expVal.textContent='';if(valSel)valSel.hidden=true;return;}
    const x=X(p.x);
    pinL.setAttribute('x1',x);pinL.setAttribute('x2',x);pinL.setAttribute('visibility','visible');
    pinC.setAttribute('cx',x);pinC.setAttribute('cy',Y(p.v));pinC.setAttribute('visibility','visible');
    expAn.textContent=libPeriodeMaj(p.t);
    const f=fmtU(p.v,ctx.u);
    /* La periode est rappelee dans la ligne de valeur : le curseur seul ne dit
       pas assez fort de quelle annee on parle. */
    expVal.innerHTML='';
    if(valSel){
      valSel.innerHTML='<span class="p">'+ech(libPeriodeMaj(p.t))+'</span><span class="v">'+ech(f.court)+'</span>'+
        (ctx.lib?'<span class="l">'+ech(ctx.lib)+'</span>':'');
      valSel.hidden=false;
    }
  }
  slider.addEventListener('input',majPin);
  function libelleAxes(){
    /* L'unite se lit horizontalement, au-dessus de l'axe : un texte tourne se
       superposait aux graduations. */
    const u=String(ctx.u||'').toLowerCase();
    let uy=ctx.uniteY||(/pct|%/.test(u)?'en %':(/meur|millions d/.test(u)?'en milliards d\u2019euros':
      (/millier/.test(u)?'en milliers':(/^euros?$|^eur$/.test(u)?'en euros':(ctx.u?pretty(ctx.u):'')))));
    if(/millions d\u2019euros/.test(uy))uy=uy.replace('millions','milliards');
    if(uy){
      const ty=el('text',{x:6,y:14,'font-size':12.5,fill:'var(--muet)','font-weight':600});
      ty.textContent=uy;svg.appendChild(ty);
    }
    /* Pas d'etiquette « annee » : l'axe horizontal d'une serie temporelle se
       comprend sans qu'on l'ecrive, et le mot se cognait aux graduations. */
    if(ctx.uniteX&&ctx.uniteX!=='ann\u00e9e'){
      const tx=el('text',{x:W-gR,y:H-2,'text-anchor':'end','font-size':12,fill:'var(--muet)','font-weight':600});
      tx.textContent=ctx.uniteX;svg.appendChild(tx);
    }
  }

  function dessiner(){
    svg.innerHTML='';tip.hidden=true;pinL=null;pinC=null;
    if(pts.length<2){
      const t=el('text',{x:24,y:44,'font-size':13,fill:'#98A2B3'});
      t.textContent='Pas assez de points pour tracer une courbe sur cette s\u00e9lection.';
      svg.appendChild(t);expAn.textContent='';expVal.textContent='';return;
    }
    const x0=pts[0].x,x1=pts[pts.length-1].x;
    X=x=>gL+(x-x0)*(W-gL-gR)/(x1-x0);
    let mn=Infinity,mx=-Infinity;
    for(const p of pts){if(p.v<mn)mn=p.v;if(p.v>mx)mx=p.v;}
    const estPct=/pct|%/.test(String(ctx.u||'').toLowerCase());
    const pad=(mx-mn)*0.06||Math.abs(mx)*0.02||1;
    const y0=(mn<0||estPct)?mn-pad:0, y1=mx+pad;
    Y=v=>gT+(y1-v)*(H-gT-gB)/(y1-y0);
    grilleYc(svg,y0,y1,Y,gL,W,gR,/meur|millions d/.test(String(ctx.u||'').toLowerCase())?1000:1);
    grilleXc(svg,Math.floor(x0),Math.ceil(x1),X,H,gB);
    const gid='grad'+(++gradN);degrade(svg,gid,'#2A4BD7');
    let d='';pts.forEach((p,i)=>{d+=(i?'L':'M')+X(p.x).toFixed(1)+' '+Y(p.v).toFixed(1);});
    if(y0<=mn){
      const aire=d+'L'+X(x1).toFixed(1)+' '+Y(y0).toFixed(1)+'L'+X(x0).toFixed(1)+' '+Y(y0).toFixed(1)+'Z';
      svg.appendChild(el('path',{d:aire,fill:'url(#'+gid+')',stroke:'none'}));
    }
    svg.appendChild(el('path',{d,fill:'none',stroke:'var(--accent)','stroke-width':2.6,'stroke-linejoin':'round','stroke-linecap':'round'}));
    const der=pts[pts.length-1];
    svg.appendChild(el('circle',{cx:X(der.x),cy:Y(der.v),r:4.2,fill:'var(--accent)'}));
    etiquetteFin(svg,X(der.x),Y(der.v),fmtU(der.v,ctx.u).court,'var(--accent)');
    pinL=el('line',{y1:gT,y2:H-gB,stroke:'var(--accent)','stroke-width':1.4,opacity:.45,visibility:'hidden'});svg.appendChild(pinL);
    pinC=el('circle',{r:4.2,fill:'var(--accent)',stroke:'#fff','stroke-width':1.6,visibility:'hidden'});svg.appendChild(pinC);
    const regle=el('line',{y1:gT,y2:H-gB,stroke:'#B9C2D4','stroke-width':1,'stroke-dasharray':'3 3',visibility:'hidden'});svg.appendChild(regle);
    const zone=el('rect',{x:gL,y:gT,width:W-gL-gR,height:H-gT-gB,fill:'transparent'});
    const idxDe=e=>{
      const r=svg.getBoundingClientRect();
      const px=(e.touches&&e.touches.length)?e.touches[0].clientX:e.clientX;
      const xc=x0+((px-r.left)*(W/r.width)-gL)*(x1-x0)/(W-gL-gR);
      let best=0,dm=Infinity;
      for(let i=0;i<pts.length;i++){const dd=Math.abs(pts[i].x-xc);if(dd<dm){dm=dd;best=i;}}
      return best;
    };
    const montrer=i=>{
      const p=pts[i],x=X(p.x);
      regle.setAttribute('x1',x);regle.setAttribute('x2',x);regle.setAttribute('visibility','visible');
      const f=fmtU(p.v,ctx.u);
      tip.innerHTML='<div class="t">'+ech(libPeriode(p.t))+'</div><div class="r"><span class="d" style="background:var(--accent)"></span><b>'+ech(f.court)+'</b>'+(f.exact?' ('+ech(f.exact)+')':'')+'</div>';
      tip.hidden=false;
      const rb=box.getBoundingClientRect();
      let pxx=x/W*rb.width;const w=tip.offsetWidth;
      pxx=Math.max(w/2+4,Math.min(rb.width-w/2-4,pxx));
      tip.style.left=pxx+'px';
    };
    zone.addEventListener('mousemove',e=>montrer(idxDe(e)));
    zone.addEventListener('touchstart',e=>montrer(idxDe(e)),{passive:true});
    zone.addEventListener('touchmove',e=>montrer(idxDe(e)),{passive:true});
    zone.addEventListener('mouseleave',()=>{regle.setAttribute('visibility','hidden');tip.hidden=true;});
    svg.appendChild(zone);
    libelleAxes();
    majPin();
  }
  return {slider:slider,bloc:bloc,maj(nouv,c){pts=nouv||[];ctx=c||{};slider.max=Math.max(0,pts.length-1);slider.value=slider.max;meta.textContent=ctx.meta||'';dessiner();}};
}

/* ---------- petits constructeurs ---------- */

/* Choisir une grandeur doit se faire d'un geste : des boutons, pas un menu
   deroulant qui cache les autres choix. */
function boutons(parent,titre,valeurs,libFn,courant,onChoix){
  const bar=document.createElement('div');bar.className='choix';
  const t=document.createElement('span');t.textContent=titre;bar.appendChild(t);
  const faits=[];
  valeurs.forEach(function(v){
    const b=document.createElement('button');b.type='button';b.textContent=libFn?libFn(v):v;
    if(v===courant)b.className='on';
    b.addEventListener('click',function(){
      /* On bascule la seule classe d'etat : ecraser className ferait perdre
         les classes de style posees ailleurs. */
      faits.forEach(x=>x.classList?x.classList.remove('on'):(x.className=''));
      if(b.classList)b.classList.add('on');else b.className='on';
      onChoix(v);
    });
    faits.push(b);bar.appendChild(b);
  });
  parent.appendChild(bar);return bar;
}
function selecteur(parent,labelTxt,values,labFn,val){
  const lab=document.createElement('label');
  lab.appendChild(document.createTextNode(labelTxt));
  const sel=document.createElement('select');
  for(const v of values){
    const o=document.createElement('option');o.value=v;o.textContent=labFn?labFn(v):v;sel.appendChild(o);
  }
  if(val!=null)sel.value=val;
  lab.appendChild(sel);parent.appendChild(lab);
  return sel;
}
function panneauShell(zone,titre,quoi){
  const sec=document.createElement('section');sec.className='panneau';
  sec.innerHTML='<div class="pan-tete"><div><h2>'+ech(titre)+'</h2><p>'+ech(quoi||'')+'</p></div></div><div class="corps"></div>';
  zone.appendChild(sec);
  return {sec,corps:sec.querySelector('.corps')};
}

/* ---------- panneaux generiques ---------- */
function pCartes(zone,cfg,D){
  const wrap=document.createElement('section');wrap.className='stats';zone.appendChild(wrap);
  const out=[];
  for(const pref of cfg.prefs){
    const F=D[pref.fichier];
    if(!F||F.serie.type!=='serie')continue;
    const r=carteValeur(F.serie,D.axeFor(pref.fichier),(pref.motif||'').toLowerCase(),pref.code);
    if(!r)continue;
    const f=fmtU(r.v,r.u);
    let ch='';
    if(r.prevV!=null&&r.v!=null&&r.prevV!==0){
      const pct=/pct|%/.test(String(r.u||'').toLowerCase());
      const dtxt=pct
        ?(((r.v-r.prevV)>=0?'+':'\u2212')+nf2.format(Math.abs(r.v-r.prevV))+' pt vs '+libPeriode(r.prevT))
        :(fmtPct((r.v/r.prevV-1)*100)+' vs '+libPeriode(r.prevT));
      /* Vert pour une hausse, rouge pour une baisse : c'est le SENS de la
         variation, pas un jugement - une inflation qui monte s'affiche en vert. */
      const sens=(r.v-r.prevV)>0?' vert':((r.v-r.prevV)<0?' rouge':'');
      ch='<span class="chip'+sens+'">'+ech(dtxt)+'</span>';
    }
    const et=r.gMatched&&pref.et?pref.et:pretty(r.g);
    const qd=[pretty(r.g),libPeriode(r.t),r.codeNote,(f.exact||'')].filter(Boolean).join(' \u00b7 ');
    out.push('<div class="stat"><div class="et">'+ech(et)+'</div>'+
      '<div class="rang"><span class="va">'+ech(f.court)+'</span>'+ch+'</div>'+
      '<div class="qd">'+ech(qd)+'</div></div>');
  }
  wrap.innerHTML=out.join('')||'<p class="note">Aucune carte constructible sur ces fichiers.</p>';
}
function pClassement(zone,cfg,D){
  const sh=panneauShell(zone,cfg.titre,cfg.quoi);
  const F=D[cfg.fichier];
  if(!F||F.serie.type!=='serie'||F.serie.facettes.indexOf('code')<0){
    sh.corps.innerHTML='<p class="note">Ce fichier ne porte pas d\u2019axe \u00ab code \u00bb \u00e0 classer.</p>';return;
  }
  const s=F.serie,axe=D.axeFor(cfg.fichier);
  const choix=defautChoix(s,axe,(cfg.prefMotif||'').toLowerCase());delete choix.code;
  const filt=document.createElement('div');filt.className='filtres';sh.corps.appendChild(filt);
  for(const f of s.facettes){
    if(f==='code')continue;
    const sel=selecteur(filt,pretty(f),s.vals[f],v=>libFacette(s,axe,f,v),choix[f]);
    sel.addEventListener('change',()=>{choix[f]=sel.value;majPeriodes();});
  }
  const bas=document.createElement('div');
  bas.innerHTML='<div class="explore"><label>Choisir une p\u00e9riode</label><input type="range" min="0" max="0" value="0" step="1"><span class="exp-an"></span></div><div class="cls"></div><p class="clsTot"></p><p class="metaC"></p>';
  sh.corps.appendChild(bas);
  const slider=bas.querySelector('input'),expAn=bas.querySelector('.exp-an'),cls=bas.querySelector('.cls'),totEl=bas.querySelector('.clsTot'),meta=bas.querySelector('.metaC');
  let periodes=[];
  function majBarres(){
    if(!periodes.length){cls.innerHTML='<p class="note">Aucune p\u00e9riode ne porte de valeur pour cette s\u00e9lection.</p>';totEl.textContent='';expAn.textContent='';meta.textContent='';return;}
    const per=periodes[+slider.value];expAn.textContent=libPeriodeMaj(per.t);
    const rows=filtrer(s,choix).filter(o=>o.t===per.t&&o.v!=null);
    const items=[],tots=[];
    for(const o of rows){
      const lib=libCode(s,axe,o.c.code);
      (estTotal(o.c.code,lib)?tots:items).push({code:o.c.code,lib,v:o.v,u:o.c.unite||''});
    }
    items.sort((a,b)=>b.v-a.v);
    const somme=items.reduce((a,b)=>a+b.v,0);
    const vmax=items.length?Math.max.apply(null,items.map(i=>Math.abs(i.v))):1;
    const cap=40,aff=items.slice(0,cap);
    cls.innerHTML=aff.map(function(it,i){
      const f=fmtU(it.v,it.u);
      const part=somme?nf1.format(it.v/somme*100)+' %':'\u2014';
      return '<div class="clsRow"><span class="rg">'+(i+1)+'</span>'+
        '<span class="lb">'+ech(it.lib)+'<span class="cd">'+ech(it.code)+'</span></span>'+
        '<span class="barre"><i style="width:'+Math.max(1,Math.abs(it.v)/(vmax||1)*100).toFixed(1)+'%"></i></span>'+
        '<span class="vl">'+ech(f.court)+'</span>'+
        '<span class="pt">'+part+'</span></div>';
    }).join('');
    totEl.textContent=tots.length?('Ensemble ('+tots.map(t=>t.lib).join(', ')+') : '+fmtU(tots[0].v,tots[0].u).court):'';
    let m='La part rapporte chaque ligne \u00e0 la somme des lignes hors \u00ab ensemble \u00bb.';
    if(items.length>cap)m=(items.length-cap)+' lignes suppl\u00e9mentaires non affich\u00e9es. '+m;
    meta.textContent=m;
  }
  function majPeriodes(){
    const rows=filtrer(s,choix);
    const set={},ps=[];
    for(const o of rows){
      if(o.v==null||isNaN(o.x))continue;
      if(!set[o.t]){set[o.t]=1;ps.push({t:o.t,x:o.x});}
    }
    ps.sort((a,b)=>a.x-b.x);
    periodes=ps;slider.max=Math.max(0,ps.length-1);slider.value=slider.max;
    majBarres();
  }
  slider.addEventListener('input',majBarres);
  majPeriodes();
}
function pExplorer(zone,cfg,D){
  const sh=panneauShell(zone,cfg.titre,cfg.quoi);
  const F=D[cfg.fichier];
  if(!F||F.serie.type!=='serie'){
    sh.corps.innerHTML='<p class="note">Ce fichier ne se lit pas comme une s\u00e9rie \u2014 voir Sources et contr\u00f4les.</p>';return;
  }
  const s=F.serie,axe=D.axeFor(cfg.fichier);
  const choix=defautChoix(s,axe,(cfg.prefMotif||'').toLowerCase());
  const filt=document.createElement('div');filt.className='filtres';sh.corps.appendChild(filt);
  const cc=composantCourbe(sh.corps);
  /* Une serie de deux siecles ecrase les vingt dernieres annees. On ouvre donc
     sur la plage utile, en laissant le choix de tout voir. */
  let depuis=cfg.debut||null;
  function majTout(){
    const rows=filtrer(s,choix);
    const st=serieTemps(rows);
    if(depuis)st.pts=st.pts.filter(p=>p.x>=depuis);
    const u=uniteDe(rows);
    const bits=[];
    if(choix.grandeur)bits.push(pretty(choix.grandeur));
    if(choix.code!=null)bits.push(libCode(s,axe,choix.code));
    if(choix.vue&&s.vals.vue&&s.vals.vue.length>1)bits.push(choix.vue);
    cc.maj(st.pts,{u,lib:bits.join(' \u00b7 '),meta:st.ecartes?(st.ecartes+' point(s) \u00e9cart\u00e9(s) : p\u00e9riode illisible ou valeur vide.'):''});
  }
  for(const f of s.facettes){
    if(s.vals[f].length<=20){
      const bar=boutons(sh.corps,cfg.libelleChoix||'Afficher',s.vals[f],v=>libFacette(s,axe,f,v),choix[f],v=>{choix[f]=v;majTout();});
      if(cc.bloc&&cc.bloc.parentNode)cc.bloc.parentNode.insertBefore(bar,cc.bloc);
      continue;
    }
    const sel=selecteur(filt,pretty(f),s.vals[f],v=>libFacette(s,axe,f,v),choix[f]);
    sel.addEventListener('change',()=>{choix[f]=sel.value;majTout();});
  }
  majTout();
}

/* ---------- gabarit, sources, reserves, heures ---------- */
function gabarit(config){
  document.title='\u00c9conomie fran\u00e7aise \u2014 '+config.titre;
  const ong=NAV.map(function(n){
    if(n[2])return '<a '+(n[0]===config.id?'class="actif" ':'')+'href="'+n[2]+'">'+ech(n[1])+'</a>';
    return '<span title="\u00e0 venir">'+ech(n[1])+'</span>';
  }).join('');
  document.body.innerHTML=
  '<div id="auth" class="plein" hidden><form id="formAuth" class="carteAuth">'+
    '<p class="eyebrow">SUIVI ECO</p><h1>\u00c9conomie fran\u00e7aise</h1>'+
    '<p class="expli">Cette page lit le d\u00e9p\u00f4t priv\u00e9 depuis ce navigateur ; la cl\u00e9 ne sert qu\u2019\u00e0 appeler GitHub. Colle une cl\u00e9 d\u2019acc\u00e8s GitHub qui peut lire DEPOT-AGENT-ECO.</p>'+
    '<label for="cle">Cl\u00e9 d\u2019acc\u00e8s GitHub</label>'+
    '<div class="rangCle"><input id="cle" type="password" autocomplete="off" spellcheck="false"><button type="button" id="voirCle" class="lienbtn">afficher</button></div>'+
    '<label class="case"><input type="checkbox" id="garder" checked> Garder la cl\u00e9 dans ce navigateur</label>'+
    '<button type="submit" id="btnLire" class="btnPlein">Lire le d\u00e9p\u00f4t</button>'+
    '<p id="erreurAuth" class="erreur" hidden></p></form></div>'+
  '<div id="app" hidden>'+
    '<header class="haut"><div class="haut-in">'+
      '<a class="marque" href="index.html"><span class="pastille"></span>\u00c9conomie fran\u00e7aise</a>'+
      '<nav class="onglets" aria-label="Rubriques">'+ong+'</nav>'+
      '<div class="outilsH"><button class="btnH" id="btnRecharger">Recharger</button><button class="lienbtn" id="btnCle">Changer de cl\u00e9</button></div>'+
    '</div></header>'+
    '<div class="cadre">'+
      '<section class="hero">'+
      '<h1>'+ech(config.titre)+'</h1><p class="sous">'+ech(config.sous||'')+'</p>'+
      '<p class="heures" id="heures"></p></section>'+
      '<div id="zone"></div>'+
      '<section class="panneau"><div class="pan-tete"><div><h2>Sources et contr\u00f4les</h2>'+
      '<p>Chaque fichier lu par la page, avec son en-t\u00eate complet : source, mill\u00e9sime, m\u00e9thode et contr\u00f4le chiffr\u00e9.</p></div></div>'+
      '<div id="srcList"></div></section>'+
      '<footer><details class="reserves" open><summary>R\u00e9serves sur les donn\u00e9es</summary><ul id="listeReserves"></ul></details>'+
      '<p class="petit mono" id="piedInfos"></p></footer>'+
    '</div></div>';
}
function rendreSources(config,D){
  const cles=Object.keys(config.fichiers);
  $('srcList').innerHTML=cles.map(function(k){
    const F=D[k];
    const md=/\.md$/i.test(config.fichiers[k]);
    const tete=(F&&F.txt&&!md)?entete(F.txt):(md?'Document du d\u00e9p\u00f4t, affich\u00e9 en entier dans la page.':'');
    return '<details class="src"><summary>'+ech(config.fichiers[k])+'</summary><pre>'+ech(tete||'(pas d\u2019en-t\u00eate dans ce fichier)')+'</pre></details>';
  }).join('');
}
function rendreReserves(config){
  const base=[
    'Les totaux, parts et \u00e9carts affich\u00e9s sont des sommes et rapports simples entre valeurs des fichiers, toujours \u00e9tiquet\u00e9s ; rien d\u2019autre n\u2019est recalcul\u00e9.',
    'Quand une grandeur attendue manque \u00e0 l\u2019appel, la carte affiche la premi\u00e8re grandeur du fichier, sous son vrai nom, plut\u00f4t que d\u2019inventer.',
    'Les en-t\u00eates complets des fichiers \u2014 sources, mill\u00e9simes, contr\u00f4les \u2014 sont dans le panneau \u00ab Sources et contr\u00f4les \u00bb.'
  ].concat(config.reserves||[]);
  $('listeReserves').innerHTML=base.map(n=>'<li>'+ech(n)+'</li>').join('');
  $('piedInfos').textContent='Lecture directe du d\u00e9p\u00f4t priv\u00e9 GuillaumePoignet/DEPOT-AGENT-ECO \u00b7 '+Object.keys(config.fichiers).length+' fichiers \u00b7 chaque chiffre garde sa source, sa date et son mill\u00e9sime';
}
function majHeures(){
  const g=heureGravure?(dfPlein.format(heureGravure)+' \u00e0 '+fHM(heureGravure)):'date inconnue';
  const vieux=heureGravure?((Date.now()-heureGravure.getTime())>7*864e5):false;
  let t='<span class="pt'+(vieux?' vieux':'')+'"></span>Donn\u00e9es grav\u00e9es le <b>'+ech(g)+'</b>';
  if(heureLecture)t+=' \u00b7 relues \u00e0 '+fHM(heureLecture);
  if(echecLecture)t+=' \u00b7 derni\u00e8re relecture en \u00e9chec';
  $('heures').innerHTML=t;
}

/* ---------- demarrage ---------- */
function pageRubrique(config){
  gabarit(config);
  const D={};
  D.axeFor=function(cle){
    const a=config.axes&&config.axes[cle];
    if(!a)return null;
    if(typeof a==='string')return D[a]?D[a].axeMap:null;
    const jeu={};for(const champ in a){if(D[a[champ]])jeu[champ]=D[a[champ]].axeMap;}
    return jeu;
  };
  async function charger(){
    const cles=Object.keys(config.fichiers);
    const txts=await Promise.all(cles.map(k=>ghTexte(config.fichiers[k])));
    cles.forEach(function(k,i){
      const p=parseLong(txts[i]);
      D[k]={chemin:config.fichiers[k],txt:txts[i],serie:p,axeMap:p.type==='table'?axeDe(p):null};
    });
    try{
      const cm=await ghApi('commits?path=ECO/series&per_page=1&sha=main');
      heureGravure=(cm&&cm[0])?new Date(cm[0].commit.committer.date):null;
    }catch(err){heureGravure=null;}
    heureLecture=new Date();echecLecture=false;
  }
  function rendre(){
    const zone=$('zone');zone.innerHTML='';
    for(const p of config.panneaux){
      if(p.type==='cartes')pCartes(zone,p,D);
      else if(p.type==='classement')pClassement(zone,p,D);
      else if(p.type==='explorer')pExplorer(zone,p,D);
      else if(p.type==='carte'&&typeof pCarte==='function')pCarte(zone,p,D);
      else if(p.type==='tableau'&&typeof pTable==='function')pTable(zone,p,D);
      else if(p.type==='document'&&typeof pDoc==='function')pDoc(zone,p,D);
      else if(p.type==='ratio'&&typeof pRatio==='function')pRatio(zone,p,D);
      else if(p.type==='texte')pTexte(zone,p,D);
      else if(p.type==='colonne')pColonne(zone,p,D);
      else if(p.type==='multi')pMulti(zone,p,D);
    }
    rendreSources(config,D);
    rendreReserves(config);
    majHeures();
  }
  async function demarrer(){
    $('auth').hidden=true;$('app').hidden=true;
    try{
      await charger();
      rendre();
      $('app').hidden=false;
      if(!mnt)mnt=setInterval(rafraichir,1800000);
    }catch(e){
      $('app').hidden=true;$('auth').hidden=false;
      const err=$('erreurAuth');err.hidden=false;
      if(e.message==='AUTH')err.textContent='Cl\u00e9 refus\u00e9e par GitHub. V\u00e9rifie qu\u2019elle peut lire le d\u00e9p\u00f4t priv\u00e9 DEPOT-AGENT-ECO.';
      else if(String(e.message).indexOf('ABSENT:')===0)err.textContent='Fichier introuvable au d\u00e9p\u00f4t : '+e.message.slice(7);
      else err.textContent='Lecture impossible : '+e.message;
    }
  }
  async function rafraichir(){
    try{await charger();rendre();}
    catch(e){echecLecture=true;majHeures();}
  }
  $('voirCle').addEventListener('click',function(){
    const c=$('cle'),p=c.type==='password';
    c.type=p?'text':'password';$('voirCle').textContent=p?'masquer':'afficher';
  });
  $('formAuth').addEventListener('submit',async function(e){
    e.preventDefault();
    const brut=$('cle').value.trim();
    const v=nettoyerCle(brut);
    if(!v)return;
    const err=$('erreurAuth');
    if(v!==brut){
      err.hidden=false;
      err.textContent='La cl\u00e9 coll\u00e9e contenait '+(brut.length-v.length)+' caract\u00e8re(s) invisible(s), retir\u00e9(s) automatiquement. Si la lecture \u00e9choue, recopie la cl\u00e9 depuis GitHub sans passer par un traitement de texte.';
    }
    ($('garder').checked?localStorage:sessionStorage).setItem('se_cle',v);
    const b=$('btnLire');b.disabled=true;b.textContent='Lecture du d\u00e9p\u00f4t en cours';
    await demarrer();
    b.disabled=false;b.textContent='Lire le d\u00e9p\u00f4t';
  });
  $('btnRecharger').addEventListener('click',demarrer);
  $('btnCle').addEventListener('click',function(){
    localStorage.removeItem('se_cle');sessionStorage.removeItem('se_cle');
    $('app').hidden=true;$('auth').hidden=false;$('cle').value='';$('erreurAuth').hidden=true;
  });
  if(cleActuelle())demarrer();
  else $('auth').hidden=false;
}

/* Un panneau qui n'affiche aucune donnee : il explique. Une page de chiffres
   sans definitions se lit mal, et les definitions valent d'etre ecrites une
   fois pour toutes plutot que devinees. */
function pTexte(zone,cfg,D){
  const sec=document.createElement('details');sec.className='panneau explic';
  let h='<summary><span class="lib">'+ech(cfg.titre)+'</span></summary>';
  if(cfg.chapeau)h+='<p class="chapeau">'+ech(cfg.chapeau)+'</p>';
  if(cfg.definitions&&cfg.definitions.length){
    /* Chaque definition est un bloc entier dans une grille : avec des colonnes
       CSS, le titre d'une definition se retrouvait separe de son texte. */
    h+='<div class="defs">';
    for(const d of cfg.definitions)
      h+='<div class="def"><h3>'+ech(d[0])+'</h3><p>'+ech(d[1])+'</p></div>';
    h+='</div>';
  }
  if(cfg.paragraphes){
    h+='<div class="paras">';
    for(const p of cfg.paragraphes)h+='<p>'+ech(p)+'</p>';
    h+='</div>';
  }
  sec.innerHTML=h;zone.appendChild(sec);
}


/* Certains fichiers du socle sont larges - une colonne par grandeur - au lieu
   du format long : le PIB en est un. Ce panneau trace la colonne choisie. */
function pColonne(zone,cfg,D){
  const sh=panneauShell(zone,cfg.titre,cfg.quoi);
  const F=D[cfg.fichier];
  if(!F){sh.corps.innerHTML='<p class="note">Fichier absent.</p>';return;}
  const c=corps(F.txt),h=c.head;
  let iT=h.indexOf('annee');if(iT<0)iT=h.indexOf('periode');
  if(iT<0){sh.corps.innerHTML='<p class="note">Ce fichier ne porte pas de colonne de temps.</p>';return;}
  const cols=(cfg.colonnes||[]).filter(x=>h.indexOf(x.col)>=0);
  if(!cols.length){sh.corps.innerHTML='<p class="note">Aucune des colonnes demand\u00e9es n\u2019existe dans ce fichier.</p>';return;}
  const filt=document.createElement('div');filt.className='filtres';sh.corps.appendChild(filt);
  const cc=composantCourbe(sh.corps);
  let choix=0,depuis=cfg.debut||null;
  function maj(){
    const d=cols[choix],i=h.indexOf(d.col);
    let pts=[];
    for(const r of c.rows){
      const v=num(r[i]),x=periodeX(r[iT]);
      if(v!=null&&!isNaN(x))pts.push({t:r[iT],x:x,v:v});
    }
    pts.sort((a,b)=>a.x-b.x);
    if(depuis)pts=pts.filter(p=>p.x>=depuis);
    cc.maj(pts,{u:d.unite||'',lib:d.lib,uniteY:d.uniteY||d.unite||'',meta:d.note||''});
  }
  const barG=boutons(sh.corps,cfg.libelleChoix||'Afficher',cols.map((x,i)=>i),i=>cols[i].lib,0,i=>{choix=+i;maj();});
  if(cc.bloc&&cc.bloc.parentNode)cc.bloc.parentNode.insertBefore(barG,cc.bloc);
  maj();
}

/* Plusieurs series sur un meme graphe : indispensable quand les courbes n'ont
   de sens que compare?es - les trois taux directeurs, par exemple. */
const COULEURS=['#26346B','#0F6B72','#A8231B','#5B3FA8','#C7891B','#5A6076'];
function pMulti(zone,cfg,D){
  const sh=panneauShell(zone,cfg.titre,cfg.quoi);
  const F=D[cfg.fichier];
  if(!F||F.serie.type!=='serie'){sh.corps.innerHTML='<p class="note">Ce fichier ne se lit pas comme une s\u00e9rie.</p>';return;}
  const s=F.serie,axe=D.axeFor(cfg.fichier),champ=cfg.champ||'grandeur';
  const valeurs=(cfg.valeurs||s.vals[champ]||[]).slice(0,6);
  if(!valeurs.length){sh.corps.innerHTML='<p class="note">Rien \u00e0 superposer sur ce fichier.</p>';return;}
  const fixe={};
  for(const f of s.facettes){
    if(f===champ)continue;
    if(cfg.fixe&&cfg.fixe[f]!==undefined)fixe[f]=cfg.fixe[f];
    else if(f==='vue')fixe[f]=s.vals[f].indexOf('brut')>=0?'brut':s.vals[f][0];
    else fixe[f]=s.vals[f].find(cc=>estTotal(cc,libCode(s,axe,cc,f)))||s.vals[f][0];
  }
  const toutes=[];let unite='';
  valeurs.forEach(function(v,i){
    const ch={};for(const k in fixe)ch[k]=fixe[k];ch[champ]=v;
    const rows=filtrer(s,ch);
    unite=unite||uniteDe(rows);
    const pts=serieTemps(rows).pts;
    if(pts.length)toutes.push({cle:v,lib:(cfg.libelles&&cfg.libelles[v])||libFacette(s,axe,champ,v),pts:pts,couleur:COULEURS[i%COULEURS.length]});
  });
  if(!toutes.length){sh.corps.innerHTML='<p class="note">Aucune valeur sur cette s\u00e9lection.</p>';return;}
  /* Les boutons sont cumulatifs : on retire ou remet une courbe sans perdre les
     autres, et on ne peut pas toutes les eteindre. */
  const actives={};toutes.forEach(t=>{actives[t.cle]=true;});
  const barre=document.createElement('div');barre.className='choix';
  barre.innerHTML='<span>'+ech(cfg.libelleChoix||'Afficher')+'</span>';
  const btns={};
  toutes.forEach(function(t){
    const b=document.createElement('button');b.type='button';b.className='on courbe';
    b.setAttribute('style','--c:'+t.couleur);
    b.innerHTML='<i style="background:'+t.couleur+'"></i>'+ech(t.lib);
    b.addEventListener('click',function(){
      const n=Object.keys(actives).filter(k=>actives[k]).length;
      if(actives[t.cle]&&n<=1)return;
      actives[t.cle]=!actives[t.cle];
      b.className=actives[t.cle]?'on courbe':'courbe';
      dessiner();
    });
    btns[t.cle]=b;barre.appendChild(b);
  });
  sh.corps.appendChild(barre);
  const box=document.createElement('div');box.className='chartbox';
  box.innerHTML='<svg viewBox="0 0 1000 400" role="img"></svg><div class="tip" hidden></div>';
  sh.corps.appendChild(box);
  const zoneC=document.createElement('div');zoneC.className='explore';
  zoneC.innerHTML='<div class="valSel multi" hidden></div>'+
    '<div class="curseur"><label>Choisir une p\u00e9riode</label>'+
    '<input type="range" min="0" max="0" value="0" step="1"><span class="exp-an"></span></div>';
  sh.corps.appendChild(zoneC);
  const leg=document.createElement('div');leg.className='legende';sh.corps.appendChild(leg);
  const curseur=zoneC.querySelector('input'),pastille=zoneC.querySelector('.exp-an'),cadre=zoneC.querySelector('.valSel');
  const svg=box.querySelector('svg'),tip=box.querySelector('.tip');
  const W=1000,H=400,gL=104,gR=24,gT=26,gB=34;
  function majCadre(){
    const series=toutes.filter(t=>actives[t.cle]);
    if(!series.length||!dates.length)return;
    const t=dates[Math.min(+curseur.value,dates.length-1)];
    pastille.textContent=libPeriodeMaj(t);
    let h='<span class="p">'+ech(libPeriodeMaj(t))+'</span><span class="lignes">';
    for(const se of series){
      const p=se.pts.find(x=>x.t===t);
      if(p)h+='<span class="l1"><i style="background:'+se.couleur+'"></i>'+ech(se.lib)+
        ' <b>'+ech(fmtU(p.v,unite).court)+'</b></span>';
    }
    cadre.innerHTML=h+'</span>';cadre.hidden=false;
  }
  let dates=[];
  function dessiner(){
    svg.innerHTML='';tip.hidden=true;
    const series=toutes.filter(t=>actives[t.cle]);
    let x0=Infinity,x1=-Infinity,mn=Infinity,mx=-Infinity;
    for(const se of series)for(const p of se.pts){
      if(cfg.debut&&p.x<cfg.debut)continue;
      if(p.x<x0)x0=p.x;if(p.x>x1)x1=p.x;if(p.v<mn)mn=p.v;if(p.v>mx)mx=p.v;
    }
    if(!isFinite(x0))return;
    const estPct=/pct|%/.test(String(unite||'').toLowerCase());
    const pad=(mx-mn)*0.08||1;
    const y0=(mn<0||estPct)?mn-pad:0,y1=mx+pad;
    const X=x=>gL+(x-x0)*(W-gL-gR)/((x1-x0)||1);
    const Y=v=>gT+(y1-v)*(H-gT-gB)/((y1-y0)||1);
    grilleYc(svg,y0,y1,Y,gL,W,gR,/meur|millions d/.test(String(unite||'').toLowerCase())?1000:1);
    grilleXc(svg,Math.floor(x0),Math.ceil(x1),X,H,gB);
    for(const se of series){
      let d='',n=0;
      for(const p of se.pts){if(cfg.debut&&p.x<cfg.debut)continue;d+=(n++?'L':'M')+X(p.x).toFixed(1)+' '+Y(p.v).toFixed(1);}
      if(!n)continue;
      svg.appendChild(el('path',{d:d,fill:'none',stroke:se.couleur,'stroke-width':2.4,'stroke-linejoin':'round','stroke-linecap':'round'}));
      const der=se.pts[se.pts.length-1];
      svg.appendChild(el('circle',{cx:X(der.x),cy:Y(der.v),r:3.8,fill:se.couleur}));
    }
    const uy=cfg.uniteY||(estPct?'en %':(unite||''));
    if(uy){const ty=el('text',{x:6,y:14,'font-size':12.5,fill:'var(--muet)','font-weight':600});ty.textContent=uy;svg.appendChild(ty);}
    /* Reticule : sans lui, on voit des courbes mais jamais a quelle date. */
    const regle=el('line',{y1:gT,y2:H-gB,stroke:'#B9C2D4','stroke-width':1,'stroke-dasharray':'3 3',visibility:'hidden'});
    svg.appendChild(regle);
    const zone2=el('rect',{x:gL,y:gT,width:W-gL-gR,height:H-gT-gB,fill:'transparent'});
    const montrer=function(e){
      const r=svg.getBoundingClientRect();
      const px=(e.touches&&e.touches.length)?e.touches[0].clientX:e.clientX;
      const xc=x0+((px-r.left)*(W/r.width)-gL)*(x1-x0)/(W-gL-gR);
      let ref=null,dm=Infinity;
      for(const p of series[0].pts){const d=Math.abs(p.x-xc);if(d<dm){dm=d;ref=p;}}
      if(!ref)return;
      regle.setAttribute('x1',X(ref.x));regle.setAttribute('x2',X(ref.x));regle.setAttribute('visibility','visible');
      let h='<div class="t">'+ech(libPeriodeMaj(ref.t))+'</div>';
      for(const se of series){
        let pr=null,d2=Infinity;
        for(const p of se.pts){const d=Math.abs(p.x-ref.x);if(d<d2){d2=d;pr=p;}}
        if(pr&&d2<0.5)h+='<div class="r"><span class="d" style="background:'+se.couleur+'"></span>'+ech(se.lib)+' <b>'+ech(fmtU(pr.v,unite).court)+'</b></div>';
      }
      tip.innerHTML=h;tip.hidden=false;
      const rb=box.getBoundingClientRect();let pxx=X(ref.x)/W*rb.width;const w=tip.offsetWidth;
      tip.style.left=Math.max(w/2+4,Math.min(rb.width-w/2-4,pxx))+'px';
    };
    zone2.addEventListener('mousemove',montrer);
    zone2.addEventListener('touchstart',montrer,{passive:true});
    zone2.addEventListener('touchmove',montrer,{passive:true});
    zone2.addEventListener('mouseleave',function(){regle.setAttribute('visibility','hidden');tip.hidden=true;});
    svg.appendChild(zone2);
    const vus={};dates=[];
    for(const se of series)for(const p of se.pts){
      if(cfg.debut&&p.x<cfg.debut)continue;
      if(!vus[p.t]){vus[p.t]=p.x;dates.push(p.t);}
    }
    dates.sort((a,b)=>vus[a]-vus[b]);
    curseur.max=Math.max(0,dates.length-1);curseur.value=dates.length-1;
    majCadre();
    leg.innerHTML=series.map(function(se){
      const der=se.pts[se.pts.length-1];
      return '<span><i style="background:'+se.couleur+'"></i>'+ech(se.lib)+' <b>'+ech(fmtU(der.v,unite).court)+'</b> <small>'+ech(libPeriodeMaj(der.t))+'</small></span>';
    }).join('');
  }
  curseur.addEventListener('input',majCadre);
  dessiner();
}

