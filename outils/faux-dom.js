// DOM minimal : assez pour executer les panneaux hors navigateur et voir si ca casse.
function El(tag){
  return {
    tagName:(tag||'div').toUpperCase(), children:[], parentNode:null, style:{}, dataset:{},
    _html:'', _text:'', attrs:{}, value:'', max:0, min:0, type:'', hidden:false, className:'', checked:false,
    set innerHTML(v){
      /* Mini-analyseur : on respecte l imbrication, sinon querySelector d un
         enfant ne trouve jamais ses propres descendants. */
      this._html=v; this.children=[];
      const re=/<(\/?)(\w+)([^>]*?)(\/?)>/g; let m; const pile=[this];
      const vides={br:1,img:1,input:1,meta:1,link:1,hr:1};
      while((m=re.exec(v))){
        const fermante=m[1]==='/', tag=m[2].toLowerCase(), attrs=m[3], auto=m[4]==='/';
        if(fermante){ if(pile.length>1)pile.pop(); continue; }
        const e=El(tag);
        const c=/class="([^"]*)"/.exec(attrs); if(c)e.className=c[1];
        const id=/id="([^"]*)"/.exec(attrs); if(id)e.attrs.id=id[1];
        const t=/type="([^"]*)"/.exec(attrs); if(t)e.type=t[1];
        pile[pile.length-1].appendChild(e);
        if(!auto&&!vides[tag])pile.push(e);
      }
    },

    get innerHTML(){return this._html;},
    set textContent(v){this._text=v;}, get textContent(){return this._text;},
    appendChild(c){c.parentNode=this;this.children.push(c);return c;},
    insertBefore(c,ref){
      if(ref&&this.children.indexOf(ref)<0) throw new Error("insertBefore : le noeud de reference n'est pas un enfant");
      c.parentNode=this;
      const i=ref?this.children.indexOf(ref):this.children.length;
      this.children.splice(i,0,c);return c;
    },
    insertAdjacentHTML(){}, setAttribute(k,v){this.attrs[k]=v;}, getAttribute(k){return this.attrs[k];},
    addEventListener(){}, removeAttribute(){}, closest(){return null;},
    querySelector(sel){return this._trouve(sel)[0]||null;},
    querySelectorAll(sel){return this._trouve(sel);},
    _trouve(sel){
      /* On accepte les selecteurs de classe ET de balise : le code cherche
         parfois querySelector('input') ou querySelector('svg'). */
      const parClasse=sel.charAt(0)==='.';
      const cible=parClasse?sel.slice(1):sel.toUpperCase();
      let out=[];
      for(const c of this.children){
        const match=parClasse?((c.className||'').split(' ').indexOf(cible)>=0):(c.tagName===cible);
        if(match)out.push(c);
        out=out.concat(c._trouve?c._trouve(sel):[]);
      }
      return out;
    },
    getBoundingClientRect(){return {left:0,top:0,width:900,height:400};},
    focus(){}, offsetWidth:100
  };
}
global.document={createElement:t=>El(t),createElementNS:(ns,t)=>El(t),getElementById:()=>El('div'),
  createTextNode:t=>{const e=El('#text');e._text=t;return e;}};
global.window={};
global.document.body=El('body');global.localStorage={getItem:()=>'',setItem(){},removeItem(){}};
global.sessionStorage=global.localStorage;
global.Date=Date; global.setInterval=()=>0; global.fetch=()=>Promise.reject(new Error('hors ligne'));
