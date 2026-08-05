'use strict';
/* SUIVI-ECO - composant carte. Colorie un fond par les valeurs d'un fichier du
   depot, joint par le code que la source porte elle-meme (INSEE pour la France,
   ISO de Natural Earth pour le monde) : aucune correspondance n'est fabriquee.
   Les entites du fond sans donnee restent grises, les codes de donnee sans
   contour sont listes sous la carte. */

const PAL_SEQ=['#DDE1EF','#B0B9DA','#7E8BC4','#4E5D9E','#26346B'];
const PAL_DIV=['#A8231B','#DE9A94','#EDEFF4','#7E8BC4','#26346B'];

function bornesQuantiles(vals,n){
  const v=vals.slice().sort((a,b)=>a-b),b=[];
  for(let i=1;i<n;i++)b.push(v[Math.floor(i*v.length/n)]);
  return b;
}
function classeDe(x,bornes){
  let i=0;while(i<bornes.length&&x>=bornes[i])i++;
  return i;
}
function projecteur(ents,L,T,W,H){
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
  for(const e of ents)for(const poly of e.g)for(const r of poly)for(const p of r){
    if(p[0]<x0)x0=p[0];if(p[0]>x1)x1=p[0];if(p[1]<y0)y0=p[1];if(p[1]>y1)y1=p[1];
  }
  const k=Math.cos((y0+y1)/2*Math.PI/180);
  const lx=(x1-x0)*k,ly=y1-y0;
  const s=Math.min(W/(lx||1),H/(ly||1));
  const dx=L+(W-lx*s)/2,dy=T+(H-ly*s)/2;
  return p=>[dx+(p[0]-x0)*k*s,dy+(y1-p[1])*s];
}
function cheminDe(e,pr){
  let d='';
  for(const poly of e.g)for(const r of poly){
    r.forEach((p,i)=>{const q=pr(p);d+=(i?'L':'M')+q[0].toFixed(1)+' '+q[1].toFixed(1);});
    d+='Z';
  }
  return d;
}
function composantCarte(host,fond,cle){
  const bloc=document.createElement('div');
  bloc.innerHTML='<div class="chartbox"><svg viewBox="0 0 1000 600" role="img"></svg><div class="tip" hidden></div></div>'+
    '<div class="explore"><label>P\u00e9riode</label><input type="range" min="0" max="0" value="0" step="1"><span class="exp-an"></span><div class="exp-val"></div></div>'+
    '<p class="metaC"></p>';
  host.appendChild(bloc);
  const box=bloc.querySelector('.chartbox'),svg=box.querySelector('svg'),tip=box.querySelector('.tip');
  const slider=bloc.querySelector('input'),expAn=bloc.querySelector('.exp-an'),expVal=bloc.querySelector('.exp-val'),meta=bloc.querySelector('.metaC');
  const zones={};
  for(const e of fond.e){(zones[e.z]=zones[e.z]||[]).push(e);}
  const zPrincipale=zones.M?'M':(zones.W?'W':Object.keys(zones)[0]);
  const cartouches=Object.keys(zones).filter(z=>z!==zPrincipale).sort();
  function dessiner(valeurs,unite,libelle){
    svg.innerHTML='';tip.hidden=true;
    const vals=[];for(const k in valeurs)if(valeurs[k]!=null)vals.push(valeurs[k]);
    if(!vals.length){
      const t=el('text',{x:24,y:44,'font-size':13,fill:'#98A2B3'});
      t.textContent='Aucune valeur pour cette s\u00e9lection.';svg.appendChild(t);return;
    }
    const mn=Math.min.apply(null,vals),mx=Math.max.apply(null,vals);
    const div=mn<0&&mx>0,pal=div?PAL_DIV:PAL_SEQ;
    const bornes=div?[mn/2,-1e-9,mx/4,mx/2]:bornesQuantiles(vals,5);
    const largeCarto=cartouches.length?120:0;
    const pr=projecteur(zones[zPrincipale],largeCarto+10,10,940-largeCarto-20,470);
    const groupe=el('g',{});svg.appendChild(groupe);
    function tracer(ents,pro,cl){
      for(const e of ents){
        const v=valeurs[e[cle]];
        const p=el('path',{d:cheminDe(e,pro),fill:v==null?'#EEF1F6':pal[classeDe(v,bornes)],
          stroke:'#fff','stroke-width':cl==='c'?0.4:0.6,'stroke-linejoin':'round'});
        p.style.cursor='pointer';
        const montrer=()=>{
          const f=v==null?{court:'pas de donn\u00e9e'}:fmtU(v,unite);
          tip.innerHTML='<div class="t">'+ech(e.n)+'</div><div class="r"><b>'+ech(f.court)+'</b>'+
            (f.exact?' ('+ech(f.exact)+')':'')+'</div><div class="r" style="opacity:.7">'+ech(e[cle])+'</div>';
          tip.hidden=false;
          const rb=box.getBoundingClientRect(),bb=p.getBoundingClientRect();
          let px=bb.left-rb.left+bb.width/2;const w=tip.offsetWidth;
          tip.style.left=Math.max(w/2+4,Math.min(rb.width-w/2-4,px))+'px';
        };
        p.addEventListener('mouseenter',montrer);
        p.addEventListener('touchstart',montrer,{passive:true});
        p.addEventListener('mouseleave',()=>{tip.hidden=true;});
        groupe.appendChild(p);
      }
    }
    tracer(zones[zPrincipale],pr,'p');
    cartouches.forEach(function(z,i){
      const y=12+i*84;
      groupe.appendChild(el('rect',{x:10,y:y,width:100,height:76,fill:'#fff',stroke:'var(--ligne)',rx:8}));
      tracer(zones[z],projecteur(zones[z],14,y+16,92,56),'c');
      const t=el('text',{x:60,y:y+12,'text-anchor':'middle','font-size':9.5,fill:'var(--muet)','font-family':'IBM Plex Mono'});
      t.textContent=zones[z][0].n;svg.appendChild(t);
    });
    // legende
    const lx=largeCarto+16,ly=505;
    const lg=el('g',{});svg.appendChild(lg);
    pal.forEach(function(c,i){
      lg.appendChild(el('rect',{x:lx+i*74,y:ly,width:70,height:11,fill:c,rx:2}));
      const b=i===0?'moins de '+nfAuto(bornes[0]):(i===pal.length-1?nfAuto(bornes[bornes.length-1])+' et plus':nfAuto(bornes[i-1])+' \u00e0 '+nfAuto(bornes[i]));
      const t=el('text',{x:lx+i*74,y:ly+25,'font-size':10,fill:'var(--muet)','font-family':'IBM Plex Mono'});
      t.textContent=b;lg.appendChild(t);
    });
    lg.appendChild(el('rect',{x:lx+pal.length*74+14,y:ly,width:22,height:11,fill:'#EEF1F6',rx:2}));
    const t2=el('text',{x:lx+pal.length*74+42,y:ly+10,'font-size':10,fill:'var(--muet)','font-family':'IBM Plex Mono'});
    t2.textContent='sans donn\u00e9e';lg.appendChild(t2);
    const t3=el('text',{x:lx,y:ly-8,'font-size':11,fill:'var(--texte)'});
    t3.textContent=libelle+(div?' \u2014 \u00e9chelle centr\u00e9e sur z\u00e9ro':' \u2014 cinq classes de m\u00eame effectif');
    lg.appendChild(t3);
  }
  return {dessiner,slider,expAn,expVal,meta};
}
function pCarte(zone,cfg,D){
  const sh=panneauShell(zone,cfg.titre,cfg.quoi);
  const fond=window[cfg.fond];
  const F=D[cfg.fichier];
  if(!fond){sh.corps.innerHTML='<p class="note">Le fond de carte n\u2019est pas charg\u00e9 par cette page.</p>';return;}
  if(!F||F.serie.type!=='serie'||F.serie.facettes.indexOf('code')<0){
    sh.corps.innerHTML='<p class="note">Ce fichier ne porte pas d\u2019axe \u00ab code \u00bb \u00e0 cartographier.</p>';return;}
  const s=F.serie,axe=D.axeFor(cfg.fichier),cle=cfg.cle||'c';
  const dansFond={};for(const e of fond.e)dansFond[e[cle]]=1;
  /* Choix par defaut : pour chaque facette autre que le code, retenir la valeur
     qui colorie le plus de territoires - sinon un fichier a plusieurs niveaux
     geographiques s'ouvre sur le mauvais et la carte reste vide. */
  const choix={};
  for(const f of s.facettes){
    if(f==='code')continue;
    const vs=s.vals[f];
    if(f==='grandeur'&&cfg.prefMotif){
      const m=vs.find(g=>String(g).toLowerCase().indexOf(String(cfg.prefMotif).toLowerCase())>=0);
      if(m){choix[f]=m;continue;}
    }
    let best=vs[0],bestN=-1;
    for(const v of vs){
      const essai={};for(const k in choix)essai[k]=choix[k];essai[f]=v;
      const vus={};let n=0;
      for(const o of s.obs){
        if(o.v==null||!dansFond[o.c.code])continue;
        let ok=true;for(const k in essai)if(o.c[k]!==essai[k]){ok=false;break;}
        if(ok&&!vus[o.c.code]){vus[o.c.code]=1;n++;}
      }
      if(n>bestN){bestN=n;best=v;}
    }
    choix[f]=best;
  }
  const filt=document.createElement('div');filt.className='filtres';sh.corps.appendChild(filt);
  const c=composantCarte(sh.corps,fond,cle);
  let periodes=[];
  function majCarte(){
    if(!periodes.length){c.dessiner({},'','');c.expAn.textContent='';c.expVal.textContent='';return;}
    const per=periodes[+c.slider.value];c.expAn.textContent=per.t;
    const rows=filtrer(s,choix).filter(o=>o.t===per.t&&o.v!=null);
    const val={},hors=[];let unite='';
    for(const o of rows){
      const cd=o.c.code;unite=unite||o.c.unite||'';
      if(dansFond[cd])val[cd]=o.v;
      else if(hors.indexOf(libCode(s,axe,cd))<0)hors.push(libCode(s,axe,cd));
    }
    const lib=[choix.grandeur?pretty(choix.grandeur):'',per.t].filter(Boolean).join(' \u00b7 ');
    c.dessiner(val,unite,lib);
    const n=Object.keys(val).length;
    c.expVal.innerHTML='<b>'+n+'</b> territoires color\u00e9s'+(hors.length?' \u00b7 '+hors.length+' code(s) sans contour \u00e0 cette \u00e9chelle':'');
    c.meta.textContent=hors.length?('Non cartographi\u00e9s, faute de contour dans le fond : '+hors.slice(0,20).join(', ')+(hors.length>20?', et '+(hors.length-20)+' autres.':'')):'';
  }
  function majPeriodes(){
    const cpt={},ord=[];
    for(const o of filtrer(s,choix)){
      if(o.v==null||isNaN(o.x)||!dansFond[o.c.code])continue;
      if(!(o.t in cpt)){cpt[o.t]=0;ord.push({t:o.t,x:o.x});}
      cpt[o.t]++;
    }
    ord.sort((a,b)=>a.x-b.x);periodes=ord;
    c.slider.max=Math.max(0,ord.length-1);
    /* la periode la plus recente qui soit vraiment remplie : la derniere annee
       d'un fichier est souvent partielle, et une carte trouee tromperait */
    let plein=0;for(const p of ord)if(cpt[p.t]>plein)plein=cpt[p.t];
    let i=ord.length-1;while(i>0&&cpt[ord[i].t]<plein*0.6)i--;
    c.slider.value=i;
    majCarte();
  }
  for(const f of s.facettes){
    if(f==='code')continue;
    const sel=selecteur(filt,pretty(f),s.vals[f],v=>pretty(v),choix[f]);
    sel.addEventListener('change',()=>{choix[f]=sel.value;majPeriodes();});
  }
  c.slider.addEventListener('input',majCarte);
  majPeriodes();
}
