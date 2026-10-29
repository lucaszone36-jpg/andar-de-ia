// Prédio do escritório (28/10/2026): projeção pura da /api/central em andares, salas e agentes.
// Regra: status vem de evidência (relatório recente, etapa da tarefa); sem evidência = pausa, nunca "trabalhando".
const rows=v=>Array.isArray(v)?v:[];
const text=v=>typeof v==='string'?v:'';

export const ORDEM_ANDARES=['Gerência','Marketing','Vendas','Atendimento','Financeiro'];
export const CORES={
  'Gerência':'#ffb341','Marketing':'#d79bff','Vendas':'#f27c6b','Atendimento':'#7fd1b9','Financeiro':'#7fa8ff'};
const ATIVO_MS=2*3600000;

export function githubUrl(v){return typeof v==='string'&&/^https:\/\/github\.com\/lucaszone36-jpg\/[\w.-]+\/(issues|pull)\/[1-9]\d*$/.test(v)?v:'';}

export function statusSala(setor,now=Date.now()){
  const tarefas=rows(setor.tasks),decisoes=rows(setor.decisions);
  if(setor.demo)return setor.demo;
  if(decisoes.length||tarefas.some(t=>t?.stage==='aguarda-lucas'))return 'espera';
  const at=Date.parse(setor.report?.at);
  if(Number.isFinite(at)&&now-at>=0&&now-at<=ATIVO_MS)return 'ativo';
  if(tarefas.some(t=>['em-execucao','revisao'].includes(t?.stage)))return 'ativo';
  return 'pausa';
}

export function nomesAgentes(setor){
  const partes=text(setor.agent).split(',').map(s=>s.trim()).filter(Boolean);
  return (partes.length>1?partes:[text(setor.agent)||text(setor.name)||'Agente']).slice(0,6);
}

export function haQuanto(iso,now=Date.now()){
  const at=Date.parse(iso);if(!Number.isFinite(at))return '';
  const min=Math.max(0,Math.round((now-at)/60000));
  if(min<1)return 'agora';if(min<60)return `há ${min} min`;
  const h=Math.round(min/60);return h<48?`há ${h} h`:`há ${Math.round(h/24)} dias`;
}

export function montarPredio(central={},now=Date.now(),ordem=ORDEM_ANDARES){
  const porArea=new Map();
  for(const s of rows(central.sectors)){
    if(!s||!s.id)continue;
    const area=text(s.area)||'Outros';
    const status=statusSala(s,now);
    const nomes=nomesAgentes(s);
    // Sala com vários papéis: metade trabalha, o resto circula (sem inventar quem faz o quê).
    const agentes=nomes.map((nome,i)=>({nome,status:status==='ativo'&&nomes.length>2&&i>=Math.ceil(nomes.length*0.6)?'pausa':status}));
    const sala={id:s.id,area,nome:text(s.name),agente:text(s.agent),papel:text(s.role),quando:text(s.when),nota:text(s.note),
      kpis:rows(s.kpis).filter(k=>k&&k.label).map(k=>({label:text(k.label),value:k.value})),
      relatorio:text(s.report?.text),relatorioEm:text(s.report?.at),
      tarefas:rows(s.tasks).filter(t=>t&&t.title).map(t=>({numero:t.number,titulo:text(t.title),etapa:text(t.stage),url:githubUrl(t.url)})),
      decisoes:rows(s.decisions).length,status,agentes};
    if(!porArea.has(area))porArea.set(area,[]);
    porArea.get(area).push(sala);
  }
  const areas=[...porArea.keys()].sort((a,b)=>{const ia=ordem.indexOf(a),ib=ordem.indexOf(b);return (ia<0?99:ia)-(ib<0?99:ib)||a.localeCompare(b);});
  const andares=areas.map((area,i)=>({area,numero:areas.length-i,cor:CORES[area]??'#c9d3e8',salas:porArea.get(area)}));
  const salas=andares.flatMap(a=>a.salas),agentes=salas.flatMap(s=>s.agentes);
  const pendencias=[...rows(central.decisions).map(d=>({titulo:text(d.title),url:githubUrl(d.url),sala:text(d.sector)||''})),
    ...salas.flatMap(s=>s.tarefas.filter(t=>t.etapa==='aguarda-lucas').map(t=>({titulo:t.titulo,url:t.url,sala:s.id,numero:t.numero})))];
  const vistos=new Set();
  return {andares,pendencias:pendencias.filter(p=>p.titulo&&!vistos.has(p.titulo)&&vistos.add(p.titulo)),
    placar:{agentes:agentes.length,ativos:agentes.filter(a=>a.status==='ativo').length,espera:salas.filter(s=>s.status==='espera').length,andares:andares.length}};
}

// Modo vitrine (Vitrine Local): empresa fictícia, nenhum dado real do Lucas.
export function centralDemo(){
  const s=(id,area,name,agent,role,demo,kpis)=>({id,area,name,agent,role,demo,when:'24 horas, todos os dias',kpis:kpis.map(([label,value])=>({label,value})),
    report:{text:'Exemplo ilustrativo. Na sua empresa, aqui aparece o relatório real de cada rodada do agente.',at:''},tasks:[],decisions:[]});
  return {sectors:[
    s('gerente','Gerência','Gerente de IA','Gerente, Analista, Revisor','Distribui o trabalho entre os agentes, revisa antes de sair e só chama você quando precisa.','ativo',[['Entregas revisadas hoje',14],['Chamou você',1]]),
    s('posts','Marketing','Posts e stories','Social media','Escreve e agenda posts da semana com a sua aprovação.','ativo',[['Posts na fila',6]]),
    s('anuncios','Marketing','Anúncios','Gestor de tráfego','Acompanha os anúncios e sugere onde cortar ou investir.','pausa',[['Campanhas acompanhadas',3]]),
    s('avaliacoes','Marketing','Avaliações Google','Reputação','Agradece avaliações e avisa você quando chega uma reclamação.','ativo',[['Respondidas',9]]),
    s('orcamentos','Vendas','Orçamentos','Vendedor','Monta o orçamento a partir da conversa e manda para você aprovar.','ativo',[['Orçamentos hoje',4]]),
    s('followup','Vendas','Follow-up','Closer','Lembra quem pediu orçamento e não respondeu.','espera',[['Para retomar',7]]),
    s('whatsapp','Atendimento','WhatsApp','Atendente','Responde dúvidas comuns a qualquer hora e passa para você o que for delicado.','ativo',[['Conversas hoje',38]]),
    s('agenda','Atendimento','Agenda','Recepcionista','Marca, confirma e remarca horários.','ativo',[['Horários confirmados',12]]),
    s('cobranca','Financeiro','Cobrança','Cobrador','Envia lembretes gentis de pagamento.','pausa',[['Lembretes enviados',5]]),
    s('notas','Financeiro','Notas e caixa','Contador','Organiza notas e o resumo do caixa do dia.','ativo',[['Lançamentos',21]])],decisions:[]};
}
export const ORDEM_DEMO=['Gerência','Marketing','Vendas','Atendimento','Financeiro'];
export const TICKER_DEMO=['Atendente respondeu um cliente às 02:14','Recepcionista confirmou 12 horários para amanhã','Vendedor montou 4 orçamentos e mandou para aprovação','Reputação agradeceu 3 avaliações no Google','Gerente revisou o post de sexta antes de agendar','Contador fechou o resumo do caixa'];
