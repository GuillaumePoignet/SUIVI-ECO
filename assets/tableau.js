'use strict';
/* SUIVI-ECO - deux panneaux de plus.
   pTable affiche un fichier plat tel qu'il est : aucune colonne calculee,
   aucune ligne masquee hors pagination, tri et recherche seulement.
   pDoc affiche une note ou une etude du depot, en rendu simple. */

function nombreOuTexte(x){
  if(x==null||x==='')return null;
  const n=Number(String(x).replace(',','.'));
  return (isNaN(n)||String(x).trim()==='')?null:n;
}
function pTable(zone,cfg,D){
  const sh=panneauShell(zone,cfg.titre,cfg.quoi);
  const F=D[cfg.fichier];
  if(!F){sh.corps.innerHTML='<p class="note">Fichier absent.</p>';return;}
  const p=F.serie;
  let head,rows;
  if(p.type==='table'){head=p.head;rows=p.rows;}
  else{const c=corps(F.txt);head=c.head;rows=c.rows;}
  const cols=cfg.colonnes&&cfg.colonnes.length?cfg.colonnes.filter(c=>head.indexOf(c)>=0):head;
  const idx=cols.map(c=>head.indexOf(c));
  const num={};cols.forEach(function(c,j){
    let n=0,t=0;
    for(let i=0;i<Math.min(rows.length,80);i++){const v=rows[i][idx[j]];if(v==null||v==='')continue;t++;if(nombreOuTexte(v)!=null)n++;}
    num[j]=t>0&&n/t>0.8;
  });
  const outils=document.createElement('div');outils.className='filtres';
  outils.innerHTML='<label>Rechercher<input type="search" placeholder="un mot, un code\u2026" style="font:500 12.5px Inter,sans-serif;padding:7px 10px;border:1px solid var(--ligne);border-radius:9px;min-width:190px"></label>';
  sh.corps.appendChild(outils);
  const q=outils.querySelector('input');
  const hote=document.createElement('div');hote.style.overflowX='auto';sh.corps.appendChild(hote);
  const pied=document.createElement('p');pied.className='metaC';sh.corps.appendChild(pied);
  const PAGE=cfg.page||60;
  let tri=-1,sens=1,montre=PAGE;
  function filtrees(){
    const t=q.value.trim().toLowerCase();
    let r=t?rows.filter(function(x){return idx.some(function(i){return String(x[i]||'').toLowerCase().indexOf(t)>=0;});}):rows.slice();
    if(tri>=0){
      const i=idx[tri],n=num[tri];
      r.sort(function(a,b){
        const va=a[i],vb=b[i];
        if(n){const na=nombreOuTexte(va),nb=nombreOuTexte(vb);
          if(na==null&&nb==null)return 0;if(na==null)return 1;if(nb==null)return -1;return (na-nb)*sens;}
        return String(va||'').localeCompare(String(vb||''),'fr')*sens;
      });
    }
    return r;
  }
  function rendre(){
    const r=filtrees(),vus=r.slice(0,montre);
    let h='<table style="border-collapse:collapse;width:100%;font-size:12.5px"><thead><tr>';
    cols.forEach(function(c,j){
      h+='<th data-j="'+j+'" style="text-align:'+(num[j]?'right':'left')+';padding:7px 10px;border-bottom:1px solid var(--ligne);'+
         'white-space:nowrap;cursor:pointer;font:600 11px Inter,sans-serif;text-transform:uppercase;letter-spacing:.05em;color:var(--muet)">'+
         ech(pretty(c))+(tri===j?(sens>0?' \u2191':' \u2193'):'')+'</th>';
    });
    h+='</tr></thead><tbody>';
    for(const x of vus){
      h+='<tr>';
      cols.forEach(function(c,j){
        const v=x[idx[j]];
        const aff=num[j]&&nombreOuTexte(v)!=null?nfAuto(nombreOuTexte(v)):(v==null||v===''?'\u2014':v);
        h+='<td style="text-align:'+(num[j]?'right':'left')+';padding:6px 10px;border-bottom:1px solid var(--ligne2);'+
           (num[j]?'font-family:IBM Plex Mono,monospace;white-space:nowrap':'')+'">'+ech(aff)+'</td>';
      });
      h+='</tr>';
    }
    h+='</tbody></table>';
    hote.innerHTML=h;
    hote.querySelectorAll('th').forEach(function(th){
      th.addEventListener('click',function(){
        const j=+th.getAttribute('data-j');
        if(tri===j)sens=-sens;else{tri=j;sens=num[j]?-1:1;}
        rendre();
      });
    });
    pied.textContent=vus.length+' ligne(s) affich\u00e9e(s) sur '+r.length+
      (r.length!==rows.length?(' filtr\u00e9e(s), '+rows.length+' au fichier'):'')+
      (vus.length<r.length?' \u00b7 touche le bouton pour en voir plus':'');
    plus.hidden=vus.length>=r.length;
  }
  const plus=document.createElement('button');plus.className='btnH';plus.textContent='Afficher 200 lignes de plus';
  plus.style.marginTop='10px';
  plus.addEventListener('click',function(){montre+=200;rendre();});
  sh.corps.appendChild(plus);
  q.addEventListener('input',function(){montre=PAGE;rendre();});
  rendre();
}
/* Rendu tres simple d'un document du depot : titres, listes, tableaux, gras.
   Aucun HTML du fichier n'est interprete, tout est echappe avant mise en forme. */
function markdownSimple(md){
  const L=md.split(/\r?\n/);let h='',dansListe=false,dansTable=false;
  function finListe(){if(dansListe){h+='</ul>';dansListe=false;}}
  function finTable(){if(dansTable){h+='</tbody></table>';dansTable=false;}}
  function enligne(t){
    return ech(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/(^|[^*])\*([^*]+?)\*/g,'$1<i>$2</i>')
                 .replace(/`(.+?)`/g,'<code style="font-family:IBM Plex Mono,monospace;font-size:.92em">$1</code>');
  }
  for(let i=0;i<L.length;i++){
    const l=L[i];
    if(/^\s*\|/.test(l)&&/\|/.test(l)){
      const cells=l.trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim());
      if(/^[\s|:-]+$/.test(l)){continue;}
      if(!dansTable){finListe();h+='<table style="border-collapse:collapse;width:100%;font-size:12.5px;margin:10px 0"><tbody>';dansTable=true;}
      h+='<tr>'+cells.map(c=>'<td style="padding:5px 9px;border-bottom:1px solid var(--ligne2)">'+enligne(c)+'</td>').join('')+'</tr>';
      continue;
    }
    finTable();
    const m=l.match(/^(#{1,4})\s+(.*)$/);
    if(m){finListe();const n=Math.min(m[1].length+1,4);h+='<h'+n+' style="font-family:Space Grotesk,sans-serif;margin:16px 0 6px;font-size:'+(21-n*2)+'px">'+enligne(m[2])+'</h'+n+'>';continue;}
    if(/^\s*[-*]\s+/.test(l)){if(!dansListe){h+='<ul style="margin:8px 0;padding-left:20px;color:var(--texte)">';dansListe=true;}
      h+='<li style="margin-bottom:5px">'+enligne(l.replace(/^\s*[-*]\s+/,''))+'</li>';continue;}
    finListe();
    if(!l.trim()){h+='';continue;}
    h+='<p style="margin:8px 0;color:var(--texte)">'+enligne(l)+'</p>';
  }
  finListe();finTable();
  return h;
}
function pDoc(zone,cfg,D){
  const sh=panneauShell(zone,cfg.titre,cfg.quoi);
  const F=D[cfg.fichier];
  if(!F||!F.txt){sh.corps.innerHTML='<p class="note">Document absent du d\u00e9p\u00f4t.</p>';return;}
  const det=document.createElement('details');
  det.className='src';det.open=!!cfg.ouvert;
  det.innerHTML='<summary>'+ech(cfg.lien||'Lire le document')+'</summary><div style="margin-top:10px;max-width:78ch"></div>';
  det.querySelector('div').innerHTML=markdownSimple(F.txt);
  sh.corps.appendChild(det);
}
