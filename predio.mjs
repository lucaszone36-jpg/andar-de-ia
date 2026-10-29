// Prédio do escritório em pixel art: um andar por setor, agentes animados a partir da /api/central.
// Texturas: Higgsfield (gpt_image_2_5, 28/10/2026, 1,5 crédito). Pessoas: desenhadas aqui, pixel a pixel.
import {montarPredio,centralDemo,ORDEM_DEMO,TICKER_DEMO,haQuanto,ORDEM_ANDARES} from './predio-modelo.mjs';

const VITRINE=true;
const QUIETO=matchMedia('(prefers-reduced-motion: reduce)').matches;
const RW=112,FH=84,PISO=FH-6,FPS=10;
const $=id=>document.getElementById(id);
const ESTADO={ativo:'Trabalhando agora',espera:'Espera você',pausa:'Em pausa'};
const PELES=['#f1c7a0','#d9a273','#a8704a','#7a4a2c','#e8b48c'],CABELOS=['#2a1d18','#5b3a24','#c98b3a','#1b1b22','#8a8a96','#a2412d'];

const sprites={};
const NOMES=['mesa','cadeira','planta','rack','quadro','cafe','arquivo','estante','bebedouro','luminaria','notebook','caixa'];
const carregar=n=>new Promise(ok=>{const i=new Image();i.onload=()=>{sprites[n]=i;ok();};i.onerror=()=>ok();i.src=`predio-assets/${n}.png`;});

const hash=s=>{let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
let modelo=null,andaresVivos=[],rua=null,tick=0,ultimoDado=null;

// ---------- pessoas ----------
function pessoa(ctx,x,pisoY,p,pose,f){
  const {pele,cabelo,camisa,dir}=p;
  const sentado=pose==='sentado'||pose==='dormindo';
  let top=pisoY-(sentado?36:30);
  if(pose==='sentado'&&f%6===0)top+=1;
  if(pose==='dormindo')top+=3;
  // contorno escuro: dá leitura ao boneco no fundo escuro
  ctx.fillStyle='#070a14';ctx.fillRect(x,top-1,10,9);ctx.fillRect(x-1,top+8,12,sentado?14:13);
  ctx.fillStyle=camisa;ctx.fillRect(x,top+8,10,sentado?14:12);
  ctx.fillStyle='rgba(0,0,0,.22)';ctx.fillRect(dir<0?x:x+8,top+8,2,sentado?14:12);
  ctx.fillStyle='rgba(255,255,255,.22)';ctx.fillRect(x+3,top+8,4,1);
  ctx.fillStyle=pele;ctx.fillRect(x+1,top+2,8,6);
  ctx.fillStyle=cabelo;ctx.fillRect(x+1,top,8,3);ctx.fillRect(dir<0?x+8:x+1,top+2,1,4);
  if(pose!=='dormindo'){ctx.fillStyle='#141020';ctx.fillRect(dir<0?x+3:x+6,top+4,1,2);}
  if(pose==='sentado'){ // braços no teclado
    ctx.fillStyle=camisa;ctx.fillRect(x-4,top+13,5,3);
    ctx.fillStyle=pele;ctx.fillRect(x-6-(f%2),top+13+(f%2),2,2);
  }else if(!sentado){
    ctx.fillStyle='#1d2335';const a=pose==='andando'?f%4:0;
    ctx.fillRect(x+2,top+20,2,10-(a===1?3:0));ctx.fillRect(x+6,top+20,2,10-(a===3?3:0));
    ctx.fillStyle='#0a0d18';ctx.fillRect(x+1,top+29-(a===1?3:0),3,1);ctx.fillRect(x+6,top+29-(a===3?3:0),3,1);
    ctx.fillStyle=pele;ctx.fillRect(dir<0?x-1:x+10,top+10+(a%2),1,5);
  }
  return top;
}
function balao(ctx,x,y,f){
  if(f%10<7){ctx.fillStyle='#ffb341';ctx.fillRect(x,y-9,7,7);ctx.fillRect(x+2,y-2,2,2);ctx.fillStyle='#13233f';ctx.fillRect(x+3,y-8,1,3);ctx.fillRect(x+3,y-4,1,1);}
}
function zzz(ctx,x,y,f){ctx.fillStyle='rgba(200,215,255,.75)';const k=f%24;ctx.fillRect(x+6+(k>>3),y-4-(k>>1),3,1);ctx.fillRect(x+8+(k>>3),y-3-(k>>1),1,1);ctx.fillRect(x+6+(k>>3),y-2-(k>>1),3,1);}

// ---------- salas ----------
function montarSala(sala,cor,x,y,w){
  const h=hash(sala.id),cap=Math.max(1,Math.floor((w-40)/46));
  const props=[['planta','estante','arquivo','bebedouro','rack'][h%5],['cafe','quadro','luminaria','caixa','planta'][(h>>3)%5]];
  if(sala.area==='Software'||sala.id==='jarvis')props[0]='rack';
  const atores=sala.agentes.map((a,i)=>{
    const hh=hash(sala.id+a.nome);
    const p={pele:PELES[hh%PELES.length],cabelo:CABELOS[(hh>>4)%CABELOS.length],camisa:cor,dir:-1};
    const mesa=i<cap?x+20+Math.round((i+.5)*(w-40)/Math.min(cap,sala.agentes.length))-22:null;
    return {...a,p,mesa,px:mesa!=null?mesa+40:x+16+hh%Math.max(1,w-40),alvo:null,espera:hh%40,fase:hh%7};
  });
  return {sala,cor,x,y,w,props,atores,luz:sala.status==='pausa'?0:1};
}
function desenharSala(ctx,s,f){
  const {x,y,w}=s,py=y+PISO,lit=s.sala.status!=='pausa';
  s.luz+=((lit?1:0)-s.luz)*0.15;
  const g=ctx.createLinearGradient(0,y,0,y+FH);
  g.addColorStop(0,lit?'#2e2a47':'#121a2e');g.addColorStop(1,lit?'#3d3140':'#0f1626');
  ctx.fillStyle=g;ctx.fillRect(x,y,w,FH);
  // cone de luz do teto
  if(s.luz>0.05){ctx.fillStyle=`rgba(255,179,65,${0.10*s.luz})`;ctx.beginPath();ctx.moveTo(x+w/2-5,y+6);ctx.lineTo(x+w/2+5,y+6);ctx.lineTo(x+w/2+w*0.42,py);ctx.lineTo(x+w/2-w*0.42,py);ctx.fill();}
  ctx.fillStyle=lit?'#ffd48a':'#2a3550';ctx.fillRect(x+w/2-5,y+3,10,3);
  // quadro na parede
  ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(x+w-30,y+20,14,10);ctx.fillStyle=s.cor;ctx.globalAlpha=lit?.55:.2;ctx.fillRect(x+w-29,y+21,12,8);ctx.globalAlpha=1;
  // rodapé e piso
  ctx.fillStyle='#0a1020';ctx.fillRect(x,py-1,w,1);ctx.fillStyle='#172036';ctx.fillRect(x,py,w,FH-PISO);
  ctx.fillStyle='#1f2a44';for(let i=x+(s.x%9);i<x+w;i+=9)ctx.fillRect(i,py+2,4,1);
  // objetos das pontas
  const a=sprites[s.props[0]],b=sprites[s.props[1]];
  if(a)ctx.drawImage(a,x+3,py-a.height);
  if(b&&w>150)ctx.drawImage(b,x+w-b.width-3,py-b.height);
  // pessoas
  for(const at of s.atores)desenharAtor(ctx,s,at,f,py);
  // paredes divisórias
  ctx.fillStyle='#0b1120';ctx.fillRect(x,y,2,FH);
  if(!lit){ctx.fillStyle='rgba(6,10,22,.35)';ctx.fillRect(x,y,w,FH);}
}
function desenharAtor(ctx,s,at,f,py){
  const mesa=sprites.mesa;
  if(at.mesa==null||at.status==='pausa'&&at.fase%3===0){
    // sem mesa ou em pausa: circula pela sala (café, quadro, janela)
    if(at.mesa!=null&&mesa)ctx.drawImage(mesa,at.mesa,py-mesa.height);
    let pose='parado';
    if(at.alvo==null||Math.abs(at.px-at.alvo)<1){
      if(at.espera-->0){}else{at.alvo=s.x+16+(hash(at.nome+f)%Math.max(1,s.w-40));at.espera=20+(hash(at.nome+f+1)%40);}
    }else{const d=Math.sign(at.alvo-at.px);at.p.dir=d||at.p.dir;if(!QUIETO){at.px+=d;pose='andando';}}
    const top=pessoa(ctx,Math.round(at.px),py,at.p,pose,f);
    if(at.status==='espera')balao(ctx,Math.round(at.px)+1,top,f);
    return;
  }
  const mx=at.mesa;
  const pose=at.status==='pausa'?'dormindo':'sentado';
  at.p.dir=-1;
  const top=pessoa(ctx,mx+27,py,at.p,pose,QUIETO?0:f);
  if(mesa)ctx.drawImage(mesa,mx,py-mesa.height);
  const my=py-(mesa?.height??31);
  if(at.status!=='pausa'){ // tela viva: linhas de código rolando
    ctx.fillStyle='rgba(120,190,255,.45)';ctx.fillRect(mx+8,my+2,18,9);
    for(let l=0;l<3;l++){const k=hash(at.nome+((f>>1)+l));ctx.fillStyle=l%2?'#ffd48a':'#eaf4ff';ctx.fillRect(mx+9,my+3+l*3,2+(k%14),1);}
  }
  if(at.status==='espera')balao(ctx,mx+29,top,f);
  if(pose==='dormindo'&&!QUIETO)zzz(ctx,mx+28,top,f);
}

// ---------- andares ----------
function colunas(largura){return Math.max(1,Math.min(5,Math.floor(largura/RW)));}
function construir(){
  const host=$('andares');host.replaceChildren();andaresVivos=[];
  if(!modelo)return;
  const largura=host.clientWidth||340,cols=colunas(largura),CW=cols*RW;
  for(const andar of modelo.andares){
    const n=andar.salas.length,linhas=Math.ceil(n/cols),porLinha=Math.ceil(n/linhas);
    const sec=document.createElement('section');sec.className='andar';sec.setAttribute('aria-label',`${andar.numero}º andar: ${andar.area}`);
    const placa=document.createElement('div');placa.className='placa';
    const num=document.createElement('span');num.className='num';num.textContent=`${andar.numero}º`;
    const nome=document.createElement('span');nome.className='nome';nome.textContent=andar.area;nome.style.setProperty('--cor',andar.cor);
    placa.append(num,nome);
    const vidro=document.createElement('div');vidro.className='vidro';
    const cv=document.createElement('canvas');cv.width=CW;cv.height=linhas*FH;cv.setAttribute('aria-hidden','true');
    const camada=document.createElement('div');camada.className='salas';
    const salasVivas=[];
    andar.salas.forEach((sala,i)=>{
      const lin=Math.floor(i/porLinha),col=i%porLinha,naLinha=Math.min(porLinha,n-lin*porLinha);
      const w=Math.floor(CW/naLinha),x=col*w,y=lin*FH,ww=col===naLinha-1?CW-x:w;
      salasVivas.push(montarSala(sala,andar.cor,x,y,ww));
      const b=document.createElement('button');b.type='button';b.className=`sala-btn st-${sala.status}`;
      b.style.left=`${x/CW*100}%`;b.style.top=`${y/(linhas*FH)*100}%`;b.style.width=`${ww/CW*100}%`;b.style.height=`${FH/(linhas*FH)*100}%`;
      const etq=document.createElement('span');etq.className='etiqueta';
      const dot=document.createElement('i');dot.className=`dot dot-${sala.status}`;
      const t=document.createElement('span');t.textContent=sala.nome;etq.append(dot,t);
      b.append(etq);b.setAttribute('aria-label',`${sala.nome}, ${sala.agente}: ${ESTADO[sala.status]}`);
      b.addEventListener('click',()=>abrirSala(sala,andar));
      camada.append(b);
    });
    vidro.append(cv,camada);sec.append(placa,vidro);host.append(sec);
    andaresVivos.push({cv,ctx:cv.getContext('2d'),salas:salasVivas});
  }
  const rc=$('rua');rc.width=CW;rc.height=64;rua={ctx:rc.getContext('2d'),w:CW,gato:-20};
  desenhar(true);
}

function desenharRua(f){
  const {ctx,w}=rua,h=64;
  ctx.fillStyle='#2b2236';ctx.fillRect(0,0,w,40);
  const g=ctx.createLinearGradient(0,0,0,40);g.addColorStop(0,'rgba(255,179,65,.28)');g.addColorStop(1,'rgba(255,179,65,.05)');ctx.fillStyle=g;ctx.fillRect(0,0,w,40);
  // porta giratória e vidros do saguão
  const c=Math.round(w/2);ctx.fillStyle='#0b1120';ctx.fillRect(c-16,8,32,32);ctx.fillStyle='#ffcf7a';ctx.globalAlpha=.55;ctx.fillRect(c-14,10,13,30);ctx.fillRect(c+1,10,13,30);ctx.globalAlpha=1;
  ctx.fillStyle='#0b1120';const ph=Math.round(Math.sin(f/6)*10);ctx.fillRect(c+ph,10,1,30);
  for(let i=6;i<w-6;i+=26){if(Math.abs(i-c)<24)continue;ctx.fillStyle='rgba(255,207,122,.18)';ctx.fillRect(i,12,18,22);ctx.fillStyle='#0b1120';ctx.fillRect(i+9,12,1,22);}
  if(sprites.planta){ctx.drawImage(sprites.planta,c-50,40-sprites.planta.height);ctx.drawImage(sprites.planta,c+22,40-sprites.planta.height);}
  // calçada e rua
  ctx.fillStyle='#3a4258';ctx.fillRect(0,40,w,6);ctx.fillStyle='#2a3046';for(let i=0;i<w;i+=12)ctx.fillRect(i,40,1,6);
  ctx.fillStyle='#10141f';ctx.fillRect(0,46,w,h-46);ctx.fillStyle='#e9d7a1';for(let i=(-(f*2))%24;i<w;i+=24)ctx.fillRect(i,55,10,1);
  // postes
  for(const px of [14,w-18]){ctx.fillStyle='#1d2335';ctx.fillRect(px,6,2,34);ctx.fillRect(px-4,6,8,2);ctx.fillStyle='#ffd48a';ctx.fillRect(px-3,8,6,1);ctx.fillStyle='rgba(255,212,138,.10)';ctx.beginPath();ctx.moveTo(px-3,9);ctx.lineTo(px+3,9);ctx.lineTo(px+14,40);ctx.lineTo(px-14,40);ctx.fill();}
  // gato da madrugada
  if(!QUIETO){rua.gato+=0.6;if(rua.gato>w+20)rua.gato=-40;}
  const gx=Math.round(rua.gato),gy=37;ctx.fillStyle='#0a0a12';ctx.fillRect(gx,gy,9,3);ctx.fillRect(gx+8,gy-3,4,4);ctx.fillRect(gx+8,gy-4,1,1);ctx.fillRect(gx+11,gy-4,1,1);ctx.fillRect(gx-2,gy-2-(f%4<2?1:0),2,1);
  ctx.fillRect(gx+1,gy+3,1,(f%2)+1);ctx.fillRect(gx+7,gy+3,1,2-(f%2));ctx.fillStyle='#ffd48a';ctx.fillRect(gx+10,gy-2,1,1);
}

function desenhar(forcar){
  for(const a of andaresVivos){a.ctx.imageSmoothingEnabled=false;a.ctx.clearRect(0,0,a.cv.width,a.cv.height);for(const s of a.salas)desenharSala(a.ctx,s,tick);}
  if(rua){rua.ctx.imageSmoothingEnabled=false;desenharRua(tick);}
}
let ultimo=0;
function laco(t){
  requestAnimationFrame(laco);
  if(document.hidden||t-ultimo<1000/FPS)return;
  ultimo=t;tick++;desenhar();
}

// ---------- painel lateral, ticker, sala ----------
function placar(p){
  const itens=[['Agentes',p.agentes],['Trabalhando agora',p.ativos],['Esperam você',p.espera],['Andares',p.andares]];
  $('placar').replaceChildren(...itens.flatMap(([k,v])=>{const d=document.createElement('div');const dt=document.createElement('dt');dt.textContent=k;const dd=document.createElement('dd');dd.textContent=String(v);d.append(dd,dt);return [d];}));
}
function pendencias(lista){
  $('pend-count').textContent=String(lista.length);
  const ul=$('pend-lista');
  if(!lista.length){const li=document.createElement('li');li.className='vazio';li.textContent='Nada esperando você agora.';ul.replaceChildren(li);return;}
  ul.replaceChildren(...lista.slice(0,6).map(p=>{const li=document.createElement('li');
    const el=p.url?Object.assign(document.createElement('a'),{href:p.url,target:'_blank',rel:'noopener noreferrer'}):document.createElement('span');
    el.textContent=(p.numero?`#${p.numero} · `:'')+p.titulo.replace(/^\[Tarefa\]\s*/,'');li.append(el);return li;}));
}
function ticker(linhas){
  const t=$('ticker');const base=linhas.length?linhas:['Prédio aceso. Aguardando o próximo acontecimento.'];
  const mk=()=>base.map(l=>{const s=document.createElement('span');s.textContent=l;return s;});
  t.replaceChildren(...mk(),...mk());
  t.style.setProperty('--dur',`${Math.max(30,base.join(' ').length*0.22)}s`);
}
function abrirSala(sala,andar){
  $('sala-area').textContent=`${andar.numero}º andar · ${andar.area}`;
  $('sala-titulo').textContent=`${sala.nome} — ${sala.agente}`;
  const est=$('sala-estado');est.textContent=ESTADO[sala.status]+(sala.relatorioEm?` · último relatório ${haQuanto(sala.relatorioEm)}`:'');est.className=`sala-estado st-${sala.status}`;
  $('sala-papel').textContent=sala.papel;
  $('sala-quando').textContent=sala.quando?`Horário: ${sala.quando}`:'';
  $('sala-kpis').replaceChildren(...sala.kpis.slice(0,8).map(k=>{const d=document.createElement('div');const dd=document.createElement('dd');dd.textContent=String(k.value??'—');const dt=document.createElement('dt');dt.textContent=k.label;d.append(dd,dt);return d;}));
  $('sala-relatorio-box').hidden=!sala.relatorio;$('sala-relatorio').textContent=sala.relatorio.slice(0,1200)+(sala.relatorio.length>1200?'…':'');
  $('sala-tarefas-box').hidden=!sala.tarefas.length;
  $('sala-tarefas').replaceChildren(...sala.tarefas.slice(0,10).map(t=>{const li=document.createElement('li');const el=t.url?Object.assign(document.createElement('a'),{href:t.url,target:'_blank',rel:'noopener noreferrer'}):document.createElement('span');el.textContent=`#${t.numero} · ${t.titulo.replace(/^\[Tarefa\]\s*/,'')}`;const e=document.createElement('em');e.textContent=t.etapa;li.append(el,e);return li;}));
  $('sala').showModal();
}

// ---------- dados ----------
async function atualizar(){
  // A linha do tempo consulta o GitHub (até ~20 s): corre à parte para não segurar o prédio.
  if(VITRINE)ticker(TICKER_DEMO);
  else fetch('/api/office/timeline',{cache:'no-store'}).then(r=>r.json()).then(tl=>ticker((tl.events??[]).slice(0,10).map(e=>`${new Date(e.at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} · #${e.number} · ${e.role==='Você'?'Você':e.engine??e.role}: ${String(e.text).slice(0,90)}`))).catch(()=>{});
  try{
    let central;
    if(VITRINE)central=centralDemo();
    else{const r=await fetch('/api/central',{cache:'no-store'});if(!r.ok)throw Error(String(r.status));central=await r.json();}
    const novo=montarPredio(central,Date.now(),VITRINE?ORDEM_DEMO:ORDEM_ANDARES);
    const mudou=JSON.stringify(novo.andares.map(a=>a.salas.map(s=>[s.id,s.status,s.agentes.length])))!==JSON.stringify(modelo?.andares.map(a=>a.salas.map(s=>[s.id,s.status,s.agentes.length])));
    modelo=novo;ultimoDado=Date.now();
    placar(modelo.placar);pendencias(modelo.pendencias);
    if(mudou)construir();
    $('eyebrow').textContent=VITRINE?'Vitrine Local · demonstração':`Ao vivo · atualizado ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
    $('status').textContent='';
  }catch{
    $('status').textContent=modelo?'Sem resposta da Central agora; mostrando a última leitura.':'Não consegui ler a Central. Estado atual desconhecido.';
  }
}

function modoVitrine(){
  document.body.classList.add('vitrine');
  document.title='Vitrine Local · Sua loja, sempre acesa';
  $('titulo').textContent='Sua empresa ganha um andar de IA.';
  $('subtitulo').textContent='Sua loja, sempre acesa: cada janela é um agente trabalhando, até de madrugada.';
  $('letreiro').textContent='SUA LOJA';
  $('pendencias').hidden=true;$('pitch').hidden=false;
  
}

async function iniciar(){
  if(VITRINE)modoVitrine();
  $('sala-fechar').addEventListener('click',()=>$('sala').close());
  $('sala').addEventListener('click',e=>{if(e.target===$('sala'))$('sala').close();});
  const espera=document.createElement('p');espera.className='acendendo';espera.textContent='Acendendo as luzes…';$('andares').append(espera);
  ticker([]);
  await Promise.all(NOMES.map(carregar));
  await atualizar();
  let largura=$('andares').clientWidth;
  new ResizeObserver(()=>{const w=$('andares').clientWidth;if(colunas(w)!==colunas(largura)){largura=w;construir();}}).observe($('andares'));
  setInterval(atualizar,60000);
  if(QUIETO)setInterval(()=>{tick++;desenhar();},2000);else requestAnimationFrame(laco);
}
iniciar();
