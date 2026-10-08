/* Central de OS 1.77.0 — leitura e consolidação dos registros existentes. */
(function(root){
 'use strict';
 const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const id=v=>String(v??'').trim().toLowerCase();
 const active=o=>o&&o.is_deleted!==true&&o.ativo!==false&&!['EXCLUIDA','EXCLUIDO'].includes(String(o.status||'').toUpperCase());
 const hasModule=(p,key)=>p?.perfil==='Master'||(Array.isArray(p?.modulos)&&p.modulos.includes(key));
 const can=(p,key)=>hasModule(p,'central_os.html')&&(p?.perfil==='Master'||p?.permissoesCentralOS?.[key]===true);
 function money(v){
  if(v===null||v===undefined||v==='')return null;
  if(typeof v==='number')return Number.isFinite(v)?v:null;
  let s=String(v).trim().replace(/R\$|\s/g,'');
  if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');
  else if(/^[-+]?\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,'');
  if(!/^[-+]?\d+(\.\d+)?$/.test(s))return null;
  const n=Number(s);return Number.isFinite(n)?n:null;
 }
 const round=v=>Math.round((v+Number.EPSILON)*100)/100;
 function dateKey(v){
  if(!v)return '';
  if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)){
   const d=new Date(v+'T12:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===v?v:'';
  }
  try{
   const d=v?.toDate?v.toDate():v?.seconds!==undefined?new Date(v.seconds*1000):new Date(v);
   if(Number.isNaN(d.getTime()))return '';
   const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
   return ['year','month','day'].map(k=>p.find(x=>x.type===k)?.value).join('-');
  }catch(_){return ''}
 }
 function stage(o){
  const s=String(o.etapaKanban||o.status||'ENTRADA').toUpperCase();
  if(o.encerradoAdministrativamente===true||/^ENCERRAD/.test(s))return 'ENCERRADOS';
  if(o.finalizadoTecnico===true||s==='FATURAMENTO'||/FINAL|CONCLUID/.test(s))return 'FATURAMENTO';
  if(s.includes('CANCEL'))return 'CANCELADOS';
  if(s.includes('AGEND')||s.includes('EXECU'))return 'AGENDAMENTO';
  if(s.includes('ORCAM'))return 'ORCAMENTOS';
  if(s.includes('TRIAG')||s.includes('DIAGN'))return 'TRIAGEM';
  return 'ENTRADA';
 }
 const labels={ENTRADA:'Entrada',TRIAGEM:'Triagem / Diagnóstico',ORCAMENTOS:'Orçamentos',AGENDAMENTO:'Agendamento / Execução',FATURAMENTO:'Finalizada tecnicamente',ENCERRADOS:'Encerrada',CANCELADOS:'Cancelada'};
 function identity(user,p){return new Set([user?.uid,user?.email,p?.id,p?.userId,p?.authUid,p?.uid,p?.email,p?.userEmail].map(id).filter(Boolean))}
 function visible(o,user,p){
  if(!hasModule(p,'central_os.html'))return false;
  if(p?.perfil==='Master'||p?.visaoGlobalPorTela?.['central_os.html']===true)return true;
  const mine=identity(user,p),refs=[o.criadoPorUid,o.criadoPorEmail,o.tecnicoId,o.tecnicoUid,o.tecnicoEmail,...(o.tecnicoIds||[]),...(o.tecnicosResponsaveisIds||[]),...(o.tecnicosIds||[])];
  for(const t of (Array.isArray(o.equipeTecnica)?o.equipeTecnica:[])){
   if(t?.ativo!==false)refs.push(typeof t==='string'?t:t.uid, t?.id,t?.email,t?.authUid,t?.tecnicoId,t?.tecnicoEmail);
  }
  for(const t of Object.values(o.tecnicoRecebimentos||o.recebimentoTecnicos||{}))if(t?.ativo!==false)refs.push(t?.ref,t?.tecnicoId,t?.tecnicoUid,t?.tecnicoEmail);
  return refs.some(v=>mine.has(id(v)));
 }
 function budgetsFor(o,cycle,equipments,budgets,closed){
  const eqs=equipments.filter(e=>active(e)&&!['RECUSADO','CANCELADO'].includes(String(e.statusEquipamento||'').toUpperCase()));
  const ids=new Set(eqs.map(e=>String(e.equipamentoId||e.id||e.internalId)));
  const relevant=budgets.filter(b=>active(b)&&Number(b.cicloAtendimento||1)===cycle&&ids.has(String(b.equipamentoId||'')));
  const latest=new Map();
  for(const b of relevant){
   const prev=latest.get(String(b.equipamentoId));
   if(!prev||Number(b.versao||0)>Number(prev.versao||0)||(Number(b.versao||0)===Number(prev.versao||0)&&String(b.updatedAtISO||b.createdAtISO||'')>String(prev.updatedAtISO||prev.createdAtISO||'')))latest.set(String(b.equipamentoId),b);
  }
  let quoted=0,approved=0,valid=true;
  for(const b of latest.values()){
   if(['CANCELADO','SUBSTITUIDO'].includes(String(b.statusOrcamento||'').toUpperCase()))continue;
   const value=money(b.total);if(value===null){valid=false;continue}quoted+=value;
  }
  for(const eid of ids){
   const b=relevant.filter(b=>String(b.equipamentoId)===eid&&b.statusOrcamento==='APROVADO').sort((a,b)=>Number(b.versao||0)-Number(a.versao||0))[0];
   if(b){const value=money(b.total);if(value===null)valid=false;else approved+=value}
  }
  // O encerramento guarda o valor efetivamente aprovado daquele ciclo.
  if(closed&&money(o.valorOrcamentoAprovadoNoEncerramento)!==null)approved=money(o.valorOrcamentoAprovadoNoEncerramento);
  return {quoted:valid?round(quoted):null,approved:valid?round(approved):null};
 }
 function records(o,detail={}){
  if(!active(o))return [];
  const current=Number(o.cicloAtendimento||1),rows=[];
  const add=(data,cycle,archived)=>{
   const eqs=(archived?data.equipamentos:detail.equipamentos)||[];
   const st=archived?'ENCERRADOS':stage(o);
   const closed=st==='ENCERRADOS';
   const values=budgetsFor(data,cycle,eqs,detail.orcamentos||[],closed);
   const financial=String(data.situacaoFaturamento||'').toUpperCase()||(data.faturado===true?'FATURADO':'PENDENTE');
   const invoiced=financial==='FATURADO'?money(data.valorFaturado):0;
   const equipment=eqs.filter(active);
   const techDate=data.finalizadoTecnicoEmISO||equipment.map(e=>e.checkoutConcluidoEmISO||'').sort().at(-1)||'';
   const complete=detail.loaded===true&&!detail.error;
   const team=archived&&(data.tecnicoNome||data.tecnicoNomes?.length)?data:o;
   const teamHistoricalUnknown=archived&&team===o;
   const r={key:String(o.id)+'::'+cycle,osId:String(o.id),number:o.osNumber||o.numero||o.id,cycle,archived,clientId:o.clienteId||'',client:o.clienteNome||o.cliente||'Cliente não informado',stage:st,stageLabel:labels[st],financial,priority:o.prioridade||'NORMAL',kind:o.tipoAtendimento||'INTERNO',description:o.descricaoInicial||'',technicians:[team.tecnicoNome,...(team.tecnicoNomes||[]),...(team.tecnicosResponsaveisNomes||[]),...(team.tecnicosNomes||[])].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', ')||'A definir',teamHistoricalUnknown,technicianIds:[team.tecnicoId,...(team.tecnicoIds||[]),...(team.tecnicosResponsaveisIds||[]),...(team.tecnicosIds||[])].filter(Boolean).map(String),created:dateKey(o.createdAtISO||o.createdAt),finished:dateKey(techDate||data.encerradoEmISO),closed:dateKey(data.encerradoEmISO),invoiceDate:dateKey(data.faturadoEmData),invoice:data.numeroNF||'',quoted:complete?values.quoted:null,approved:complete?values.approved:null,invoiced:invoiced,financialComplete:complete&&(financial!=='FATURADO'||invoiced!==null)&&values.quoted!==null&&values.approved!==null,equipments:equipment,budgetCount:(detail.orcamentos||[]).filter(b=>Number(b.cicloAtendimento||1)===cycle).length,duration:Number(data.atendimentoDuracaoSegundos||0),note:data.observacaoFaturamento||'',justification:data.justificativaDivergenciaFaturamento||'',loaded:complete,error:detail.error||''};
   rows.push(r);
  };
  for(const c of detail.ciclos||[]){const cycle=Number(c.ciclo||0);if(cycle>0&&cycle<current&&!rows.some(r=>r.cycle===cycle))add(c,cycle,true)}
  add(o,current,false);return rows;
 }
 function filter(rows,f={}){
  return rows.filter(r=>{
   if(f.stage==='FINALIZADAS'&&!['ENCERRADOS','FATURAMENTO'].includes(r.stage))return false;
   if(f.stage&&f.stage!=='TODAS'&&f.stage!=='FINALIZADAS'&&r.stage!==f.stage)return false;
   if(f.clientId&&r.clientId!==f.clientId)return false;
   if(f.client&&!norm(r.client).includes(norm(f.client)))return false;
   if(f.number&&!norm(r.number).replace(/[^a-z0-9]/g,'').includes(norm(f.number).replace(/[^a-z0-9]/g,'')))return false;
   if(f.technician&&!norm(r.technicians).includes(norm(f.technician))&&!r.technicianIds.includes(f.technician))return false;
   if(f.equipment&&!norm(r.equipments.map(e=>[e.modelo,e.numeroSerie,e.parqueMaquinaId].join(' ')).join(' ')+' '+r.description).includes(norm(f.equipment)))return false;
   if(f.financial&&r.financial!==f.financial)return false;
   if(f.kind&&r.kind!==f.kind)return false;
   const d=r[f.dateField||'finished'];
   if((f.from||f.to)&&!d)return false;
   if(f.from&&d<f.from||f.to&&d>f.to)return false;
   return true;
  });
 }
 function summary(rows){
  const sum=k=>round(rows.reduce((n,r)=>n+(r[k]||0),0));
  const closed=rows.filter(r=>['ENCERRADOS','FATURAMENTO'].includes(r.stage));
  const billed=rows.filter(r=>r.financial==='FATURADO');
  const durations=closed.map(r=>r.duration).filter(n=>n>0);
  return {orders:new Set(rows.map(r=>r.osId)).size,cycles:rows.length,closed:closed.length,pending:rows.filter(r=>r.stage==='FATURAMENTO'&&r.financial==='PENDENTE').length,nonBillable:rows.filter(r=>r.financial==='NAO_FATURAVEL').length,billed:billed.length,quoted:sum('quoted'),approved:sum('approved'),invoiced:sum('invoiced'),ticket:billed.length?round(sum('invoiced')/billed.length):0,awaitingInvoice:round(rows.filter(r=>r.financial==='PENDENTE').reduce((n,r)=>n+(r.approved||0),0)),divergences:billed.filter(r=>r.approved!==null&&r.invoiced!==null&&Math.abs(r.invoiced-r.approved)>0.01).length,complete:rows.every(r=>r.financialComplete),averageHours:durations.length?durations.reduce((a,b)=>a+b,0)/durations.length/3600:0};
 }
 function csvCell(v){let s=String(v??'');if(/^\s*[=+\-@]|^[\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
 const api={norm,active,hasModule,can,money,dateKey,stage,labels,visible,records,filter,summary,csvCell};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.CentralOSDados=Object.freeze(api);
})(typeof window!=='undefined'?window:globalThis);
