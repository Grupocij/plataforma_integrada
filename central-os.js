(function(){
 'use strict';
 const D=window.CentralOSDados,BASE=['artifacts','plataforma-cij','public','data'];
 const S={rows:[],filtered:[],orders:[],details:new Map(),page:1,financePage:1,size:25,tab:'orders',generation:0,busy:false,selected:null,loading:0,failures:0};
 const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const profile=()=>window.userProfile||{},allowed=k=>D.can(profile(),k);
 const currency=v=>v===null||v===undefined?'—':Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const date=v=>v?v.split('-').reverse().join('/'):'—';
 const finLabel=v=>({FATURADO:'Faturado',NAO_FATURAVEL:'Não faturável',PENDENTE:'Pendente'}[v]||v);
 const status=(message,error=false)=>{const el=$('cos-status');el.textContent=message;el.classList.toggle('error',error)};
 const col=(...parts)=>window.fsCollection(window.AppDB,...BASE,...parts);
 async function read(...parts){const snap=await window.fsGetDocs(col(...parts));const rows=[];snap.forEach(d=>rows.push({...d.data(),id:d.id}));return {rows,cache:!!snap.metadata?.fromCache}}
 const pill=(text,style='')=>`<span class="cos-pill ${style}">${esc(text)}</span>`;
 const current=token=>token===S.generation&&!!window.currentUser&&window.currentUser.uid===S.owner&&D.hasModule(profile(),'central_os.html');
 function permissions(){
  $('cos-tab-indicators').classList.toggle('hidden',!allowed('indicadores'));
  $('cos-tab-finance').classList.toggle('hidden',!allowed('faturamento'));
  $('cos-financial-filter').classList.toggle('hidden',!allowed('faturamento'));
  const invoiceOption=$('cos-date-field').querySelector('[value="invoiceDate"]');invoiceOption.disabled=!allowed('faturamento');invoiceOption.hidden=!allowed('faturamento');
  if(!allowed('faturamento')&&$('cos-date-field').value==='invoiceDate')$('cos-date-field').value='finished';
  $('cos-export').classList.toggle('hidden',!allowed('exportar'));
  $('cos-new').classList.toggle('hidden',!D.hasModule(profile(),'assistencia.html'));
  const global=profile().perfil==='Master'||profile().visaoGlobalPorTela?.['central_os.html']===true;
  $('cos-scope').textContent=global?'Visão global: OS de toda a equipe.':'Visão própria: OS criadas por você ou atribuídas à sua identidade.';
  if(S.tab==='finance'&&!allowed('faturamento')||S.tab==='indicators'&&!allowed('indicadores'))setTab('orders');
 }
 function rebuild(){S.rows=S.orders.flatMap(o=>D.records(o,S.details.get(o.id)));applyFilters(false)}
 function filters(){return {number:$('cos-number').value,client:$('cos-client').value,clientId:S.clientId||'',stage:$('cos-stage').value,dateField:$('cos-date-field').value,from:$('cos-from').value,to:$('cos-to').value,technician:$('cos-tech').value,equipment:$('cos-equipment').value,financial:allowed('faturamento')?$('cos-financial').value:'',kind:$('cos-kind').value}}
 function validFilters(){const f=filters();if(f.from&&f.to&&f.from>f.to){status('A data inicial deve ser anterior ou igual à data final.',true);return false}return true}
 function applyFilters(reset=true){
  if(!validFilters())return;
  S.filtered=D.filter(S.rows,filters());
  const sort=$('cos-sort').value;
  S.filtered.sort((a,b)=>sort==='client-asc'?a.client.localeCompare(b.client,'pt-BR'):sort==='number-desc'?String(b.number).localeCompare(String(a.number),'pt-BR',{numeric:true}):String(b[sort==='created-desc'?'created':'finished']||'').localeCompare(String(a[sort==='created-desc'?'created':'finished']||''))||String(b.number).localeCompare(String(a.number),'pt-BR',{numeric:true})||b.cycle-a.cycle);
  if(reset){S.page=1;S.financePage=1}render();
 }
 function pageRows(finance=false){const pages=Math.max(1,Math.ceil(S.filtered.length/S.size)),key=finance?'financePage':'page';S[key]=Math.min(Math.max(1,S[key]),pages);const start=(S[key]-1)*S.size;return {rows:S.filtered.slice(start,start+S.size),pages,page:S[key],start}}
 function pager(container,finance=false){
  const pg=pageRows(finance),el=$(container);el.innerHTML=`<span>${S.filtered.length?pg.start+1:0}–${Math.min(pg.start+S.size,S.filtered.length)} de ${S.filtered.length} atendimentos</span><div class="cos-actions"><label>Exibir <select aria-label="Quantidade por página">${[10,25,50,100].map(n=>`<option ${n===S.size?'selected':''}>${n}</option>`).join('')}</select></label><button class="cos-btn" data-page="${pg.page-1}" ${pg.page===1?'disabled':''} aria-label="Página anterior"><i class="fa-solid fa-chevron-left"></i></button><span>Página ${pg.page} de ${pg.pages}</span><button class="cos-btn" data-page="${pg.page+1}" ${pg.page>=pg.pages?'disabled':''} aria-label="Próxima página"><i class="fa-solid fa-chevron-right"></i></button></div>`;
  el.querySelector('select').onchange=e=>{S.size=Number(e.target.value);S.page=1;S.financePage=1;render()};
  el.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{S[finance?'financePage':'page']=Number(b.dataset.page);render()});
 }
 function numberCell(r){return `<button type="button" class="cos-number" data-detail="${esc(r.key)}">${esc(r.number)}</button><small>Ciclo ${r.cycle}${r.archived?' · Histórico anterior':''}</small>`}
 function renderOrders(){
  const finance=allowed('faturamento');
  $('cos-orders-head').innerHTML='<tr><th>OS / Ciclo</th><th>Cliente</th><th>Técnico / Equipe</th><th>Situação</th><th>Finalização</th>'+(finance?'<th>Faturamento</th><th class="cos-right">Faturado</th>':'')+'<th>Detalhes</th></tr>';
  $('cos-orders-body').innerHTML=pageRows().rows.map(r=>`<tr><td>${numberCell(r)}</td><td class="cos-client-cell"><b>${esc(r.client)}</b><small>${esc(r.kind==='EXTERNO'?'Externo / Campo':'Interno / Laboratório')} · ${esc(r.priority)}</small></td><td class="cos-client-cell">${esc(r.technicians)}${r.teamHistoricalUnknown?'<small>Equipe atual da OS</small>':''}</td><td>${pill(r.stageLabel,r.stage==='ENCERRADOS'?'green':r.stage==='FATURAMENTO'?'amber':'blue')}</td><td>${date(r.finished)}<small>${r.closed?'Encerrada: '+date(r.closed):'Criação: '+date(r.created)}</small></td>${finance?`<td>${pill(finLabel(r.financial),r.financial==='FATURADO'?'green':r.financial==='PENDENTE'?'amber':'')}</td><td class="cos-right"><b>${r.financial==='FATURADO'?currency(r.invoiced):'—'}</b>${r.invoice?`<small>NF ${esc(r.invoice)}</small>`:''}</td>`:''}<td><button type="button" class="cos-btn" data-detail="${esc(r.key)}">Consultar</button></td></tr>`).join('')||`<tr><td class="cos-empty" colspan="${finance?8:6}">${S.busy?'Carregando as ordens e seus equipamentos…':'Nenhuma OS corresponde aos filtros. Use “Todas as situações” para pesquisar OS em andamento.'}</td></tr>`;
  const sum=D.summary(S.filtered);$('cos-count').textContent=`${sum.orders} OS · ${sum.cycles} atendimento(s) / ciclo(s). Os filtros valem para todas as abas.`;pager('cos-pager');
 }
 function kpi(label,value,note=''){return `<div class="cos-kpi"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></div>`}
 function groups(rows,key,value=()=>1,limit=10){const map=new Map();for(const r of rows){const label=key(r)||'Não informado';map.set(label,(map.get(label)||0)+value(r))}return [...map].sort((a,b)=>b[1]-a[1]).slice(0,limit)}
 function bars(container,items,monetary=false){
  const max=Math.max(1,...items.map(x=>x[1]));$(container).innerHTML=items.length?'<div class="cos-bars">'+items.map(([label,n])=>`<div><div class="cos-bar-label"><span title="${esc(label)}">${esc(label)}</span><b>${esc(monetary?currency(n):n)}</b></div><div class="cos-bar-track"><div class="cos-bar-fill" style="width:${Math.max(0,n/max*100).toFixed(2)}%"></div></div></div>`).join('')+'</div>':'<div class="cos-empty">Nenhum registro neste filtro.</div>';
 }
 function renderIndicators(){
  if(!allowed('indicadores')){$('cos-indicator-cards').innerHTML='';return}
  const s=D.summary(S.filtered);
  $('cos-indicator-cards').innerHTML=kpi('Ordens de serviço',s.orders,'Quantidade de OS distintas')+kpi('Atendimentos / ciclos',s.cycles,'Inclui os ciclos anteriores preservados')+kpi('Finalizados / Encerrados',s.closed,'Conclusão técnica ou administrativa')+kpi('Tempo médio de atendimento',s.averageHours?s.averageHours.toFixed(1).replace('.',',')+' h':'—','Tempo apontado nos atendimentos finalizados');
  bars('cos-by-stage',groups(S.filtered,r=>r.stageLabel));bars('cos-by-client',groups(S.filtered,r=>r.client));bars('cos-by-tech',groups(S.filtered,r=>r.teamHistoricalUnknown?'Ciclo antigo: equipe não preservada':r.technicians));
  const byMonth=groups(S.filtered.filter(r=>r.finished),r=>r.finished.slice(0,7),()=>1,Infinity);byMonth.sort((a,b)=>a[0].localeCompare(b[0]));bars('cos-by-month',byMonth);
 }
 function renderFinance(){
  if(!allowed('faturamento')){$('cos-finance-cards').innerHTML='';$('cos-finance-body').innerHTML='';return}
  const s=D.summary(S.filtered),ready=s.complete&&!S.busy;
  const show=value=>ready?currency(value):'—',note=ready?'Valores do filtro atual':'Aguarde a carga completa; use Atualizar se houver falha.';
  $('cos-finance-cards').innerHTML=kpi('Total orçado',show(s.quoted),'Última versão registrada por equipamento e ciclo')+kpi('Total aprovado',show(s.approved),'Base registrada no encerramento, quando disponível')+kpi('Total faturado',show(s.invoiced),'Somente ciclos com situação Faturado')+kpi('Aprovado, ainda não faturado',show(s.awaitingInvoice),'Orçamento aprovado em atendimentos pendentes')+kpi('Ticket médio faturado',show(s.ticket),note)+kpi('Atendimentos faturados',ready?s.billed:'—','Quantidade de ciclos com NF registrada')+kpi('Não faturáveis',ready?s.nonBillable:'—','Não entram no total de faturamento')+kpi('Faturamentos divergentes',ready?s.divergences:'—','Diferença entre o valor aprovado e o faturado');
  const billed=S.filtered.filter(r=>r.financial==='FATURADO'&&r.invoiced!==null);
  const months=groups(billed,r=>r.invoiceDate?r.invoiceDate.slice(0,7):'Sem data da NF',r=>r.invoiced,Infinity);months.sort((a,b)=>a[0].localeCompare(b[0]));
  if(ready){bars('cos-revenue-month',months,true);bars('cos-revenue-client',groups(billed,r=>r.client,r=>r.invoiced),true)}else{$('cos-revenue-month').textContent=note;$('cos-revenue-client').textContent=note}
  $('cos-finance-body').innerHTML=pageRows(true).rows.map(r=>`<tr><td>${numberCell(r)}</td><td class="cos-client-cell">${esc(r.client)}</td><td>${pill(finLabel(r.financial),r.financial==='FATURADO'?'green':'')}</td><td>${esc(r.invoice||'—')}</td><td>${date(r.invoiceDate)}</td><td class="cos-right">${currency(r.quoted)}</td><td class="cos-right">${currency(r.approved)}</td><td class="cos-right">${r.financial==='FATURADO'?currency(r.invoiced):'—'}</td><td class="cos-right">${r.financial==='FATURADO'&&r.approved!==null&&r.invoiced!==null?currency(r.invoiced-r.approved):'—'}</td></tr>`).join('')||'<tr><td colspan="9" class="cos-empty">Nenhum atendimento neste filtro.</td></tr>';
  pager('cos-finance-pager',true);
 }
 function render(){permissions();renderOrders();renderIndicators();renderFinance();$('cos-export').disabled=S.busy||!S.filtered.length||!validFiltersQuiet()||(allowed('faturamento')&&!D.summary(S.filtered).complete)}
 function validFiltersQuiet(){return !$('cos-from').value||!$('cos-to').value||$('cos-from').value<=$('cos-to').value}
 function setTab(tab){
  if(tab==='finance'&&!allowed('faturamento')||tab==='indicators'&&!allowed('indicadores'))return;
  S.tab=tab;document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-selected',String(b.dataset.tab===tab))});
  ['orders','indicators','finance'].forEach(x=>$('cos-panel-'+x).classList.toggle('hidden',x!==tab));
 }
 async function load(){
  if(!D.hasModule(profile(),'central_os.html'))return;
  const token=++S.generation;S.owner=window.currentUser?.uid;S.busy=true;S.loading=0;S.failures=0;S.selected=null;closeDetail();S.details.clear();S.rows=[];S.orders=[];S.filtered=[];$('cos-refresh').disabled=true;status('Carregando OS…');render();
  let cached=false;
  try{
   const data=await read('os_ordens');if(!current(token))return;cached=data.cache;
   S.orders=data.rows.filter(D.active).filter(o=>D.visible(o,window.currentUser,profile()));rebuild();
   let index=0;
   async function worker(){
    while(index<S.orders.length){
     if(!current(token))return;const o=S.orders[index++];
     const sources=['equipamentos','ciclos',...(allowed('faturamento')?['orcamentos']:[])];
     const responses=await Promise.allSettled(sources.map(sub=>read('os_ordens',o.id,sub)));if(!current(token))return;
     const detail={loaded:true};responses.forEach((r,i)=>{if(r.status==='fulfilled'){detail[sources[i]]=r.value.rows;cached=cached||r.value.cache}else{detail.error='Não foi possível ler todos os dados desta OS.';console.warn('[Central OS]',o.id,sources[i],r.reason)}});
     if(detail.error)S.failures++;S.details.set(o.id,detail);S.loading++;
     if(S.loading%5===0||S.loading===S.orders.length){rebuild();status(`Carregando detalhes: ${S.loading} de ${S.orders.length} OS…`)}
    }
   }
   await Promise.all(Array.from({length:Math.min(4,S.orders.length)},worker));if(!current(token))return;
   S.busy=false;
   if(S.clientId&&!$('cos-client').value)$('cos-client').value=S.orders.find(o=>String(o.clienteId)===S.clientId)?.clienteNome||'';
   rebuild();
   $('cos-clients').innerHTML=[...new Set(S.rows.map(r=>r.client))].sort().map(v=>`<option value="${esc(v)}">`).join('');
   $('cos-techs').innerHTML=[...new Set(S.rows.map(r=>r.technicians))].sort().map(v=>`<option value="${esc(v)}">`).join('');
   status(S.failures?`${S.failures} OS com leitura incompleta. Os totais financeiros ficam indisponíveis enquanto houver falhas no filtro. Clique em Atualizar para tentar novamente.`:cached?'Consulta com dados do cache deste aparelho. Conecte-se e clique em Atualizar para conferir os dados mais recentes.':`Consulta atualizada às ${new Date().toLocaleTimeString('pt-BR')}. ${S.orders.length} OS carregadas.`,!!S.failures);
  }catch(e){if(current(token)){S.busy=false;status('Não foi possível carregar as OS. Confira sua conexão e seu acesso e clique em Atualizar.',true);console.error('[Central OS]',e);render()}}
  finally{if(current(token)){$('cos-refresh').disabled=false;S.busy=false;render()}}
 }
 function field(name,value){return `<div><dt>${esc(name)}</dt><dd>${esc(value||'—')}</dd></div>`}
 async function openDetail(key,button){
  const r=S.filtered.find(x=>x.key===key);if(!r||!D.hasModule(profile(),'central_os.html'))return;
  S.selected=key;S.previousFocus=button||document.activeElement;$('cos-detail-title').textContent=r.number+' · Ciclo '+r.cycle;$('cos-detail').classList.remove('hidden');$('cos-detail-close').focus();
  const fin=allowed('faturamento');
  $('cos-detail-content').innerHTML=`<div class="cos-detail-body">${r.archived?'<p class="cos-note">Este é um ciclo anterior. A OS foi reaberta e mantém o atendimento atual na Assistência.</p>':''}<dl class="cos-detail-grid">${field('Cliente',r.client)}${field(r.teamHistoricalUnknown?'Equipe atual (ciclo antigo sem registro)': 'Técnico / Equipe',r.technicians)}${field('Situação',r.stageLabel)}${field('Criação da OS',date(r.created))}${field('Finalização',date(r.finished))}${field('Encerramento',date(r.closed))}${field('Tipo',r.kind==='EXTERNO'?'Externo / Campo':'Interno / Laboratório')}${field('Prioridade',r.priority)}${field('Ciclo',String(r.cycle))}</dl><h3>Descrição inicial</h3><p>${esc(r.description||'Sem descrição registrada.')}</p>${fin?`<h3>Faturamento</h3><dl class="cos-detail-grid">${field('Situação',finLabel(r.financial))}${field('NF',r.invoice)}${field('Data da NF',date(r.invoiceDate))}${field('Orçado',currency(r.quoted))}${field('Aprovado',currency(r.approved))}${field('Faturado',r.financial==='FATURADO'?currency(r.invoiced):'—')}</dl><p>${esc(r.note)}${r.justification?'\nJustificativa da diferença: '+esc(r.justification):''}</p>`:''}<h3>Equipamentos</h3>${r.equipments.map(e=>`<div class="cos-equipment-card"><b>${esc(e.modelo||'Equipamento')}</b> · SN ${esc(e.numeroSerie||'Não informado')}<div>${esc(e.statusDetalhado||e.statusEquipamento||'')}</div></div>`).join('')||'<p>Nenhum equipamento disponível para este ciclo.</p>'}${r.error?`<p class="cos-value-unavailable">${esc(r.error)}</p>`:''}<h3>Linha do tempo</h3><div id="cos-detail-history">Carregando histórico…</div></div>`;
  const open=$('cos-open-assist');open.classList.toggle('hidden',!D.hasModule(profile(),'assistencia.html'));open.href='assistencia.html?os='+encodeURIComponent(r.osId);
  const token=S.generation;
  try{
   const hist=await read('os_ordens',r.osId,'historico');if(!current(token)||S.selected!==key)return;
   const cycles=(S.details.get(r.osId)?.ciclos||[]).sort((a,b)=>Number(a.ciclo)-Number(b.ciclo));
   const inferredCycle=h=>{if(h.cicloAtendimento)return Number(h.cicloAtendimento);const stamp=String(h.createdAtISO||'');if(!stamp)return 1;const old=cycles.find(c=>stamp<=String(c.snapshotCriadoEmISO||c.encerradoEmISO||''));return old?Number(old.ciclo):Number(S.orders.find(o=>o.id===r.osId)?.cicloAtendimento||1)};
   const rows=hist.rows.filter(h=>inferredCycle(h)===r.cycle&&h.is_deleted!==true).filter(h=>fin||!/FATUR|ORCAMENTO|APROVAC|DESCONTO/.test(String(h.tipo||'').toUpperCase())).sort((a,b)=>String(b.createdAtISO||'').localeCompare(String(a.createdAtISO||'')));
   $('cos-detail-history').innerHTML=rows.slice(0,60).map(h=>`<div class="cos-history"><b>${esc(h.titulo||h.tipo||'Evento')}</b><small>${date(D.dateKey(h.createdAtISO))} · ${esc(h.usuarioNome||'')}</small><span>${esc(h.detalhe||'')}</span></div>`).join('')||'<p>Nenhum evento identificado para este ciclo.</p>';
  }catch(e){if(current(token)&&S.selected===key)$('cos-detail-history').textContent='Não foi possível carregar a linha do tempo.'}
 }
 function closeDetail(){S.selected=null;$('cos-detail').classList.add('hidden');S.previousFocus?.focus?.();S.previousFocus=null}
 function exportCSV(){
  if(!allowed('exportar')||S.busy||!validFilters()||!S.filtered.length)return;
  const fin=allowed('faturamento');if(fin&&!D.summary(S.filtered).complete){status('Atualize os dados antes de exportar os valores financeiros.',true);return}
  const head=['OS','Ciclo','Ciclo anterior','Cliente','Técnico / Equipe','Situação','Criação','Finalização','Encerramento','Tipo',...(fin?['Faturamento','NF','Data da NF','Orçado','Aprovado','Faturado']:[])];
  const num=v=>v===null?'':Number(v).toFixed(2).replace('.',',');
  const rows=S.filtered.map(r=>[r.number,r.cycle,r.archived?'Sim':'Não',r.client,r.technicians,r.stageLabel,date(r.created),date(r.finished),date(r.closed),r.kind,...(fin?[finLabel(r.financial),r.invoice,date(r.invoiceDate),num(r.quoted),num(r.approved),r.financial==='FATURADO'?num(r.invoiced):'']:[])]);
  const blob=new Blob(['\uFEFF'+[head,...rows].map(line=>line.map(D.csvCell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='central-os-'+D.dateKey(new Date())+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 $('cos-filter-form').onsubmit=e=>{e.preventDefault();applyFilters()};$('cos-refresh').onclick=load;$('cos-sort').onchange=()=>applyFilters();
 let debounce;$('cos-filter-form').addEventListener('input',e=>{if(e.target.id==='cos-client')S.clientId='';clearTimeout(debounce);debounce=setTimeout(()=>applyFilters(),250)});
 $('cos-clear').onclick=()=>{$('cos-filter-form').reset();S.clientId='';applyFilters()};
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
 document.addEventListener('click',e=>{const b=e.target.closest('[data-detail]');if(b)openDetail(b.dataset.detail,b)});
 $('cos-detail-close').onclick=closeDetail;$('cos-detail-dismiss').onclick=closeDetail;$('cos-detail').onclick=e=>{if(e.target===$('cos-detail'))closeDetail()};
 document.addEventListener('keydown',e=>{if($('cos-detail').classList.contains('hidden'))return;if(e.key==='Escape')closeDetail();if(e.key==='Tab'){const items=[...$('cos-detail').querySelectorAll('button,a[href]')].filter(x=>!x.classList.contains('hidden'));const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
 $('cos-export').onclick=exportCSV;
 window.initModule=function(){if(!D.hasModule(profile(),'central_os.html'))return;$('main-content').classList.remove('hidden');const q=new URLSearchParams(location.search);S.clientId=q.get('clienteId')||'';if(q.get('status'))$('cos-stage').value=q.get('status');permissions();load()};
 window.addEventListener('pagehide',()=>{S.generation++});
 window.addEventListener('portal-session-ended',()=>{S.generation++;S.rows=[];S.filtered=[];S.orders=[];S.details.clear();closeDetail();$('cos-orders-body').innerHTML='';$('cos-finance-body').innerHTML='';$('cos-indicator-cards').innerHTML='';$('cos-finance-cards').innerHTML='';$('cos-detail-content').innerHTML='';$('main-content').classList.add('hidden')});
})();
