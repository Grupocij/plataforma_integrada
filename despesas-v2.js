(function(root){'use strict';
const BASE=['artifacts','plataforma-cij','public','data'];
const COL={items:'despesas_relatorio_novo',reports:'despesas_relatorios',cards:'despesas_cartoes',permissions:'despesas_permissoes',counter:'despesas_contadores'};
const ROOT_EMAILS=['marcos@grupocij.com','marcos@grupocij.com.br','marcos.bazacas@grupocij.com','marcos.bazacas@grupocij.com.br','adm@grupocij.com','adm@grupocij.com.br'];
const CATEGORIES=['Combustível','Pedágio','Alimentação/Bebida','Peças/Ferramentas','Hotel','Outros'];
const PAYMENTS=['Cartão de Crédito','Cartão de Débito','Dinheiro','Pix','Outro'];
const SEED_CARDS=[{id:'mastercard-0067',nome:'',bandeira:'Mastercard',final:'0067',ativo:true},{id:'mastercard-9553',nome:'',bandeira:'Mastercard',final:'9553',ativo:true},{id:'visa-7543',nome:'',bandeira:'Visa',final:'7543',ativo:true}];
const MAX_ITEMS=400,MAX_FILE=8*1024*1024;
const email=v=>String(v||'').trim().toLowerCase();
const text=v=>String(v??'').trim();
const isoNow=()=>new Date().toISOString();
const uuid=()=>root.crypto?.randomUUID?.()||('d_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localToday=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
function cents(v){
 if(typeof v==='number')return Number.isFinite(v)?Math.round((v+Number.EPSILON)*100):NaN;
 let s=text(v).replace(/R\$\s*/g,'').replace(/\s/g,'');
 if(!s||!/^-?\d[\d.,]*$/.test(s))return NaN;
 if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');
 else if((s.match(/\./g)||[]).length>1)s=s.replace(/\./g,'');
 if(!/^-?\d+(\.\d{1,2})?$/.test(s))return NaN;
 const number=Number(s);return Number.isFinite(number)&&Number.isSafeInteger(Math.round(number*100))?Math.round((number+Number.EPSILON)*100):NaN;
}
const itemCents=i=>Number.isSafeInteger(i?.valorCentavos)?i.valorCentavos:(Number.isFinite(cents(i?.valor))?cents(i.valor):0);
const money=n=>(Number(n||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
function normalizeDate(v){
 const s=text(v);if(!s)return '';
 const match=s.match(/^(\d{4})-(\d{2})-(\d{2})/)||s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)?.map((x,i,a)=>i===1?a[3]:i===3?a[1]:x);
 if(!match)return '';
 const y=Number(match[1]),m=Number(match[2]),d=Number(match[3]);
 const date=new Date(y,m-1,d);if(y<1900||y>2200||date.getFullYear()!==y||date.getMonth()!==m-1||date.getDate()!==d)return '';
 return `${match[1]}-${match[2]}-${match[3]}`;
}
const dateLabel=v=>{const s=normalizeDate(v);return s?s.split('-').reverse().join('/'):'—'};
const timeLabel=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('pt-BR')};
const categoryLabel=i=>i.categoria==='Outros'&&text(i.categoria_outros)?`Outros · ${text(i.categoria_outros)}`:text(i.categoria)||'Sem categoria';
const descriptionRequired=category=>['Alimentação/Bebida','Peças/Ferramentas','Outros'].includes(category);
const cardLabel=c=>`${text(c.nome)?text(c.nome)+' · ':''}${text(c.bandeira)||'Cartão'} **${text(c.final)}`;
const needsCard=p=>['Cartão de Crédito','Cartão de Débito'].includes(p);
const snapshotRow=s=>s?.exists?.()?{...s.data(),id:s.id}:null;
function legacyId(i){return 'legacy_'+encodeURIComponent([text(i.num_relatorio)||'Rascunho',email(i.autor),text(i.tecnico)||'Sem profissional'].join('|'))}
function identity(context){return {uid:text(context.user?.uid),email:email(context.user?.email),nome:text(context.nome||context.profile?.nome||context.user?.email)}}
function isMaster(context){return ROOT_EMAILS.includes(identity(context).email)||context.profile?.perfil==='Master'}
function canManageCards(context){return isMaster(context)||context.permissions?.gerenciarCartoes===true}
function canManageReports(context){return isMaster(context)||context.permissions?.gerenciarRelatorios===true}
function canReadAll(context){return isMaster(context)||context.global===true||context.permissions?.verTodos===true||canManageReports(context)}
const owns=(context,h)=>email(h.ownerEmail)===identity(context).email;
const canEdit=(context,h)=>(owns(context,h)||canManageReports(context))&&h.status==='RASCUNHO';
function buildGroups(items,headers,context){
 const groups=new Map();
 for(const h of headers||[]){if(!canReadAll(context)&&!owns(context,h))continue;groups.set(h.id,{id:h.id,header:{...h},items:[],legacy:false})}
 for(const raw of items||[]){
   if(raw.is_deleted===true)continue;
   const i={...raw,id:text(raw.id),data_pagamento:normalizeDate(raw.data_pagamento||raw.data_vencimento||raw.data)};
   if(!i.id||(!canReadAll(context)&&email(i.autor)!==identity(context).email))continue;
   const id=text(i.reportId)||legacyId(i);
   let g=groups.get(id);
   if(!g){g={id,legacy:!i.reportId,header:{id,ownerEmail:email(i.autor),tecnico:text(i.tecnico)||'Sem profissional',profissionalId:text(i.profissionalId),num_relatorio:text(i.num_relatorio)||'Rascunho',status:text(i.num_relatorio)==='Rascunho'||!i.num_relatorio?'RASCUNHO':'FINALIZADO',createdAtISO:i.createdAtISO||'',revision:0},items:[]};groups.set(id,g)}
   if(!g.items.some(x=>x.id===i.id))g.items.push(i);
 }
 return [...groups.values()].map(g=>{
   g.items.sort((a,b)=>a.data_pagamento.localeCompare(b.data_pagamento)||a.id.localeCompare(b.id));
   g.totalCentavos=g.items.reduce((n,i)=>n+itemCents(i),0);
   g.minDate=g.items.map(i=>i.data_pagamento).filter(Boolean).sort()[0]||'';
   g.maxDate=g.items.map(i=>i.data_pagamento).filter(Boolean).sort().at(-1)||'';
   g.clientes=[...new Set(g.items.map(i=>text(i.cliente)).filter(Boolean))];return g;
 });
}
function filterGroups(groups,filters){
 const search=text(filters.search).toLocaleLowerCase('pt-BR');
 const result=[];
 for(const g of groups){
   const h=g.header;if(h.status==='EXCLUIDO'&&filters.status!=='EXCLUIDO')continue;
   if(filters.status&&h.status!==filters.status)continue;
   if(filters.professional&&h.tecnico!==filters.professional)continue;
   const matched=g.items.filter(i=>{
     const haystack=[h.num_relatorio,h.tecnico,h.ownerEmail,i.descricao,i.cliente,i.cidade,i.osNumber,categoryLabel(i),i.cartao,i.observacoes].join(' ').toLocaleLowerCase('pt-BR');
     return (!search||haystack.includes(search))&&(!filters.category||i.categoria===filters.category)&&(!filters.start||(i.data_pagamento&&i.data_pagamento>=filters.start))&&(!filters.end||(i.data_pagamento&&i.data_pagamento<=filters.end));
   });
   if(!matched.length&&h.status!=='EXCLUIDO')continue;
   if(h.status==='EXCLUIDO'&&search&&!String(h.num_relatorio+' '+h.tecnico+' '+h.ownerEmail).toLowerCase().includes(search))continue;
   result.push({...g,matched,subtotalCentavos:matched.reduce((n,i)=>n+itemCents(i),0)});
 }
 return result.sort((a,b)=>{
   const draftA=a.header.status==='RASCUNHO',draftB=b.header.status==='RASCUNHO';if(draftA!==draftB)return draftA?-1:1;
   const na=Number(text(a.header.num_relatorio).replace(/\D/g,''))||0,nb=Number(text(b.header.num_relatorio).replace(/\D/g,''))||0;
   return nb-na||String(b.header.createdAtISO||'').localeCompare(a.header.createdAtISO||'')||a.id.localeCompare(b.id);
 });
}
function validateExpense(input){
 const required=['cliente','cidade'];for(const key of required)if(!text(input[key]))throw new Error('Preencha cliente e cidade.');
 const value=Number.isSafeInteger(input.valorCentavos)?input.valorCentavos:cents(input.valor);
 if(!Number.isSafeInteger(value)||value<=0||value>99999999999)throw new Error('Informe um valor válido, maior que zero, com até duas casas decimais.');
 const date=normalizeDate(input.data_pagamento);if(!date)throw new Error('Informe uma data de pagamento válida.');
 if(!CATEGORIES.includes(input.categoria))throw new Error('Selecione uma categoria válida.');
 if(descriptionRequired(input.categoria)&&!text(input.descricao))throw new Error('Preencha a descrição da despesa para a categoria '+input.categoria+'.');
 if(input.categoria==='Outros'&&!text(input.categoria_outros))throw new Error('Descreva a categoria Outros.');
 if(!PAYMENTS.includes(input.pagamento))throw new Error('Selecione a forma de pagamento.');
 if(needsCard(input.pagamento)&&!text(input.cartaoId)&&!text(input.cartaoLegado))throw new Error('Selecione o cartão utilizado.');
 if((input.anexos||[]).length>3)throw new Error('É permitido anexar até três comprovantes por despesa.');
 return {...input,cliente:text(input.cliente).slice(0,180),cidade:text(input.cidade).slice(0,120),descricao:text(input.descricao).slice(0,250),valorCentavos:value,valor:value/100,data_pagamento:date,categoria_outros:input.categoria==='Outros'?text(input.categoria_outros).slice(0,100):'',observacoes:text(input.observacoes).slice(0,2000),osId:text(input.osId),osNumber:text(input.osNumber),clienteId:text(input.clienteId),cartaoId:needsCard(input.pagamento)?text(input.cartaoId):'',cartao:needsCard(input.pagamento)?text(input.cartao):'Não se aplica',anexos:(input.anexos||[]).map(a=>({nome:text(a.nome),url:text(a.url),storagePath:text(a.storagePath),contentType:text(a.contentType),size:Number(a.size||0),ownerUid:text(a.ownerUid)}))};
}
class ExpenseRepository{
 constructor(adapter,context){this.a=adapter;this.context=context}
 ref(collection,id){return this.a.doc(...BASE,collection,id)}
 async freshContext(){const c=this.context(),u=identity(c);if(!u.uid||!u.email)throw new Error('Entre no Portal para continuar.');const s=await this.a.getDoc(this.ref(COL.permissions,u.email));return {...c,permissions:s.exists()?s.data():{}}}
 auditRef(id,eventId){return this.a.doc(...BASE,COL.reports,id,'historico',eventId)}
 async initializeCounter(items){
   const context=await this.freshContext();if(!isMaster(context))return;
   const max=Math.max(1000,...items.map(i=>Number(text(i.num_relatorio).match(/^REL-(\d+)$/)?.[1]||0)));
   const ref=this.ref(COL.counter,'relatorios');
   await this.a.runTransaction(async tx=>{const s=await tx.get(ref);if(!s.exists()||Number(s.data().value)<max)tx.set(ref,{value:max,updatedAtISO:isoNow(),updatedByEmail:identity(context).email,schemaVersion:2})});
 }
 async initializeCards(){
   const context=await this.freshContext();if(!isMaster(context))return;
   const refs=SEED_CARDS.map(c=>this.ref(COL.cards,c.id));
   await this.a.runTransaction(async tx=>{const snaps=await Promise.all(refs.map(r=>tx.get(r)));SEED_CARDS.forEach((c,i)=>{if(!snaps[i].exists())tx.set(refs[i],{...c,createdAtISO:isoNow(),updatedAtISO:isoNow(),updatedByEmail:identity(context).email,revision:1})})});
 }
 async saveCard(card){
   const c=await this.freshContext();if(!canManageCards(c))throw new Error('Seu usuário não está autorizado a gerenciar cartões.');
   if(!text(card.bandeira)||!/^\d{4}$/.test(text(card.final)))throw new Error('Informe a bandeira e exatamente os quatro últimos dígitos.');
   const id=text(card.id)||uuid(),ref=this.ref(COL.cards,id),audit=this.a.doc(...BASE,'despesas_cartoes_historico',uuid()),now=isoNow();
   return this.a.runTransaction(async tx=>{const snap=await tx.get(ref),old=snapshotRow(snap);
     if(card.id&&!old)throw new Error('O cartão não existe mais. Atualize a lista.');
     if(old&&Number(card.revision||0)!==Number(old.revision||0))throw new Error('Este cartão foi alterado por outro usuário. Reabra a edição.');
     const next={id,nome:text(card.nome).slice(0,80),bandeira:text(card.bandeira).slice(0,40),final:text(card.final),ativo:card.ativo===true,createdAtISO:old?.createdAtISO||now,updatedAtISO:now,updatedByUid:identity(c).uid,updatedByEmail:identity(c).email,revision:Number(old?.revision||0)+1};
     tx.set(ref,next);tx.set(audit,{cartaoId:id,tipo:old?'ALTERACAO':'CRIACAO',antes:old||null,depois:next,createdAtISO:now,actorEmail:identity(c).email,actorUid:identity(c).uid});return next;
   });
 }
 async savePermissions(rows){
   const c=await this.freshContext();if(!isMaster(c))throw new Error('Somente Master pode alterar as autorizações.');
   if(rows.length>200)throw new Error('A lista possui mais de 200 usuários. Salve as autorizações em grupos menores.');
   const now=isoNow(),records=rows.map(r=>({...r,email:email(r.email)}));
   if(records.some(r=>!r.email||!r.email.includes('@')))throw new Error('Um dos usuários não possui e-mail válido.');
   return this.a.runTransaction(async tx=>{
     const refs=records.map(r=>this.ref(COL.permissions,r.email));await Promise.all(refs.map(ref=>tx.get(ref)));
     records.forEach((r,i)=>tx.set(refs[i],{email:r.email,nome:text(r.nome),uid:text(r.uid),master:r.master===true,moduloAtivo:r.moduloAtivo===true,gerenciarCartoes:r.gerenciarCartoes===true,gerenciarRelatorios:r.gerenciarRelatorios===true,verTodos:r.verTodos===true,updatedAtISO:now,updatedByEmail:identity(c).email}));
     tx.set(this.a.doc(...BASE,'despesas_permissoes_historico',uuid()),{createdAtISO:now,actorEmail:identity(c).email,actorUid:identity(c).uid,usuarios:records.map(r=>({email:r.email,gerenciarCartoes:r.gerenciarCartoes===true,gerenciarRelatorios:r.gerenciarRelatorios===true,verTodos:r.verTodos===true,moduloAtivo:r.moduloAtivo===true}))});
   });
 }
 async mirrorAccess(users,existing){
   const c=await this.freshContext();if(!isMaster(c))return;
   const records=users.filter(u=>email(u.email)).map(u=>{
     const saved=existing.find(x=>email(x.email||x.id)===email(u.email))||{};
     return {email:email(u.email),nome:u.nome||u.displayName||u.email,uid:u.authUid||u.uid||'',master:u.perfil==='Master'||ROOT_EMAILS.includes(email(u.email)),moduloAtivo:u.perfil==='Master'||(u.modulos||[]).includes('despesas.html'),verTodos:u.perfil==='Master'||u.visaoGlobalPorTela?.['despesas.html']===true||saved.verTodos===true,gerenciarCartoes:saved.gerenciarCartoes===true,gerenciarRelatorios:saved.gerenciarRelatorios===true};
   });
   const changed=records.filter(r=>{const old=existing.find(x=>email(x.email||x.id)===r.email);return !old||['nome','uid','master','moduloAtivo','verTodos','gerenciarCartoes','gerenciarRelatorios'].some(k=>r[k]!==old[k])});
   if(changed.length)await this.savePermissions(changed);
 }
 async mutate(group,action,payload={}){
   const context=await this.freshContext(),actor=identity(context),now=isoNow(),eventId=uuid();
   if(!group?.id)throw new Error('Relatório não identificado.');
   const input=action==='SAVE_ITEM'?validateExpense(payload.input):null;
   const savedId=input?text(payload.expenseId||payload.newExpenseId)||uuid():'';
   const headerRef=this.ref(COL.reports,group.id);
   return this.a.runTransaction(async tx=>{
     const hs=await tx.get(headerRef);let h=snapshotRow(hs);
     if(h&&['FINALIZE','REOPEN','REIMBURSE','UNDO_REIMBURSE','DELETE_REPORT'].includes(action)&&Number(h.revision||0)!==Number(group.header?.revision||0))throw new Error('Este relatório foi alterado em outra sessão. Confira os itens e o total atualizado antes de confirmar novamente.');
     if(!h){
       if(group.legacy)h={...group.header,id:group.id,legacy:true,legacySourceId:group.items[0]?.id||'',ownerUid:group.items[0]?.autorUid||(group.header.ownerEmail===actor.email?actor.uid:'')};
       else h={id:group.id,num_relatorio:'Rascunho',ownerEmail:actor.email,ownerUid:actor.uid,tecnico:text(payload.profissional?.nome),profissionalId:text(payload.profissional?.id),status:'RASCUNHO',createdAtISO:now,revision:0};
     }
     if(!owns(context,h)&&!canManageReports(context))throw new Error('Você não pode modificar o relatório de outro usuário.');
     if(!h.ownerEmail){if(!canManageReports(context))throw new Error('O relatório antigo não possui responsável identificado.');h.ownerEmail=actor.email;h.ownerUid=actor.uid}
     if(h.status==='EXCLUIDO')throw new Error('Este relatório já foi excluído.');
     if(!text(h.tecnico))throw new Error('Selecione o profissional responsável.');
     const itemIds=[...new Set(h.itemIds||group.items.map(i=>i.id))];
     if(itemIds.length>MAX_ITEMS)throw new Error('Este relatório excede 400 despesas. Divida os lançamentos em mais relatórios.');
     const refs=itemIds.map(id=>this.ref(COL.items,id)),snaps=await Promise.all(refs.map(r=>tx.get(r)));
     let items=snaps.map(snapshotRow).filter(Boolean).filter(i=>i.is_deleted!==true);
     for(const i of items){
       if(i.reportId&&i.reportId!==group.id)throw new Error('Os itens deste relatório mudaram. Atualize a página.');
       if(!i.reportId&&legacyId(i)!==group.id&&group.legacy)throw new Error('O relatório antigo foi alterado em outro dispositivo. Atualize a página.');
       if(email(i.autor)&&email(i.autor)!==email(h.ownerEmail))throw new Error('Este relatório contém despesas de responsáveis diferentes.');
     }
     const beforeTotal=items.reduce((n,i)=>n+itemCents(i),0),beforeCount=items.length;
     let oldItem=null,deleted=[],counterRef=null,counter=null,card=null;
     if(action==='SAVE_ITEM'){
       if(h.status!=='RASCUNHO')throw new Error('Reabra o relatório antes de adicionar ou editar despesas.');
       oldItem=items.find(i=>i.id===savedId)||null;
       if(payload.expenseId&&!oldItem)throw new Error('A despesa foi removida ou mudou de relatório.');
       if(!payload.expenseId){const newSnap=await tx.get(this.ref(COL.items,savedId));if(newSnap.exists())throw new Error('A despesa já foi registrada. Atualize a página.');if(items.length>=MAX_ITEMS)throw new Error('Crie um novo relatório para continuar: limite de 400 despesas atingido.')}
       if(oldItem&&Number(payload.expectedRevision||0)!==Number(oldItem.revision||0))throw new Error('Esta despesa foi alterada por outro usuário. Reabra a edição.');
       if(needsCard(input.pagamento)){
         if(input.cartaoId){const cs=await tx.get(this.ref(COL.cards,input.cartaoId));card=snapshotRow(cs);
           const sameOld=oldItem&&(oldItem.cartaoId===input.cartaoId||(!oldItem.cartaoId&&oldItem.cartao===input.cartao));
           if(!card||(!card.ativo&&!sameOld))throw new Error('Este cartão não está ativo. Selecione outro cartão.');
           input.cartao=sameOld&&oldItem.cartao?oldItem.cartao:cardLabel(card);
         }else if(!oldItem||oldItem.cartao!==input.cartaoLegado)throw new Error('Selecione um cartão cadastrado e ativo.');
       }
     }
     if(action==='FINALIZE'){
       if(h.status!=='RASCUNHO')throw new Error('Este relatório já foi finalizado.');
       if(!items.length)throw new Error('Adicione uma despesa antes de finalizar.');
       if(!/^REL-\d+$/.test(h.num_relatorio)){
         counterRef=this.ref(COL.counter,'relatorios');const cs=await tx.get(counterRef);counter=cs.exists()?cs.data():null;
         if(!counter||!Number.isSafeInteger(counter.value))throw new Error('Um usuário Master precisa abrir o módulo uma vez para inicializar a numeração.');
       }
     }
     if(action==='DELETE_ITEM'){
       if(h.status!=='RASCUNHO')throw new Error('Reabra o relatório antes de excluir uma despesa.');
       oldItem=items.find(i=>i.id===payload.expenseId);if(!oldItem)throw new Error('A despesa já foi removida.');
       if(Number(payload.expectedRevision||0)!==Number(oldItem.revision||0))throw new Error('A despesa foi alterada por outro usuário. Atualize a lista antes de excluí-la.');
       deleted=[oldItem];items=items.filter(i=>i.id!==oldItem.id);
     }
     if(action==='REOPEN'){
       if(h.status!=='FINALIZADO')throw new Error('Somente relatórios finalizados podem ser reabertos.');h.status='RASCUNHO';
     }
     if(action==='REIMBURSE'){
       if(!canManageReports(context))throw new Error('Seu usuário não está autorizado a registrar reembolsos.');
       if(h.status!=='FINALIZADO')throw new Error('Finalize o relatório antes de registrar o reembolso.');
       h.status='REEMBOLSADO';h.reembolsadoEmISO=now;h.reembolsadoPorEmail=actor.email;h.reembolsoReferencia=text(payload.reason);
     }
     if(action==='UNDO_REIMBURSE'){
       if(!canManageReports(context)||h.status!=='REEMBOLSADO')throw new Error('Seu usuário não pode desfazer este reembolso.');
       if(text(payload.reason).length<3)throw new Error('Informe a justificativa para desfazer o reembolso.');h.status='FINALIZADO';h.reembolsoDesfeitoEmISO=now;h.reembolsoDesfeitoPorEmail=actor.email;
     }
     if(action==='DELETE_REPORT'){
       if(!canManageReports(context)&&h.status!=='RASCUNHO')throw new Error('Somente um usuário autorizado pode excluir relatórios finalizados.');
       if(h.status==='REEMBOLSADO')throw new Error('Desfaça o reembolso antes de excluir este relatório.');
       deleted=[...items];items=[];h.status='EXCLUIDO';h.excluidoEmISO=now;h.excluidoPorEmail=actor.email;h.totalAntesExclusao=beforeTotal;
     }
     if(!['SAVE_ITEM','FINALIZE','DELETE_ITEM','REOPEN','REIMBURSE','UNDO_REIMBURSE','DELETE_REPORT'].includes(action))throw new Error('Ação de relatório inválida.');
     if(action==='SAVE_ITEM'){
       const next={...(oldItem||{}),...input,id:savedId,reportId:group.id,num_relatorio:h.num_relatorio,tecnico:h.tecnico,profissionalId:h.profissionalId||'',autor:h.ownerEmail,autorUid:h.ownerUid||'',createdAtISO:oldItem?.createdAtISO||now,updatedAtISO:now,updatedByEmail:actor.email,updatedByUid:actor.uid,revision:Number(oldItem?.revision||0)+1,schemaVersion:2,is_deleted:false};
       delete next.cartaoLegado;
       if(oldItem)items=items.map(i=>i.id===savedId?next:i);else items.push(next);
     }
     if(action==='FINALIZE'){
       if(counter){h.num_relatorio='REL-'+(counter.value+1);tx.set(counterRef,{...counter,value:counter.value+1,updatedAtISO:now,updatedByEmail:actor.email})}
       h.status='FINALIZADO';h.finalizadoEmISO=now;h.finalizadoPorEmail=actor.email;
     }
     const total=items.reduce((n,i)=>n+itemCents(i),0),resultItems=items.map(i=>({...i,reportId:group.id,num_relatorio:h.num_relatorio,autor:h.ownerEmail,tecnico:h.tecnico,profissionalId:h.profissionalId||'',data_pagamento:normalizeDate(i.data_pagamento||i.data_vencimento||i.data),valorCentavos:itemCents(i),valor:itemCents(i)/100,anexos:i.anexos||[],cartaoId:i.cartaoId||'',is_deleted:false,categoria_outros:i.categoria_outros||'',schemaVersion:2}));
     h={...h,itemIds:resultItems.map(i=>i.id),totalCentavos:total,itemCount:resultItems.length,updatedAtISO:now,updatedByEmail:actor.email,updatedByUid:actor.uid,revision:Number(h.revision||0)+1,schemaVersion:2};
     // Todos os documentos foram lidos antes de qualquer gravação.
     deleted.forEach(i=>tx.delete(this.ref(COL.items,i.id)));
     resultItems.forEach(i=>tx.set(this.ref(COL.items,i.id),i));
     tx.set(headerRef,h);
     const title={SAVE_ITEM:oldItem?'Despesa editada':'Despesa adicionada',DELETE_ITEM:'Despesa excluída',FINALIZE:'Relatório finalizado',REOPEN:'Relatório reaberto',REIMBURSE:'Reembolso registrado',UNDO_REIMBURSE:'Reembolso desfeito',DELETE_REPORT:'Relatório excluído'}[action];
     const audit={id:eventId,tipo:action,titulo:title,reportId:group.id,num_relatorio:h.num_relatorio,createdAtISO:now,actorEmail:actor.email,actorUid:actor.uid,actorNome:actor.nome,reason:text(payload.reason),totalAntesCentavos:beforeTotal,totalDepoisCentavos:total,itensAntes:beforeCount,itensDepois:resultItems.length,expenseId:savedId||payload.expenseId||'',descricao:input?.descricao||oldItem?.descricao||'',status:h.status};
     if(action==='DELETE_ITEM')audit.itemExcluido=oldItem;
     if(action==='DELETE_REPORT')audit.itensExcluidos=deleted.map(i=>({id:i.id,descricao:text(i.descricao).slice(0,250),cliente:text(i.cliente),cidade:text(i.cidade),data_pagamento:normalizeDate(i.data_pagamento),categoria:categoryLabel(i),valorCentavos:itemCents(i),pagamento:text(i.pagamento),cartao:text(i.cartao),anexos:(i.anexos||[]).map(a=>({nome:text(a.nome),storagePath:text(a.storagePath)}))}));
     audit.reportRevision=h.revision;
     tx.set(this.auditRef(group.id,eventId),audit);
     return {header:h,items:resultItems,expenseId:savedId,oldItem};
   });
 }
}
const exported={ExpenseRepository,buildGroups,filterGroups,validateExpense,cents,itemCents,money,normalizeDate,localToday,legacyId,canEdit,canReadAll,canManageCards,canManageReports,isMaster,cardLabel,COL,BASE,SEED_CARDS};
if(typeof module!=='undefined'&&module.exports)module.exports=exported;
root.CIJDespesas=exported;
if(typeof document==='undefined')return;

const $=id=>document.getElementById(id);
const state={items:[],headers:[],cards:[],permissions:[],users:[],clients:[],os:[],groups:[],filtered:[],page:1,expanded:new Set(),ready:false,busy:false,edit:null,workingReportId:'',attachments:[],removedAttachments:[],unsubscribers:[],sdk:null,initGeneration:0,cardEdit:null};
let repository,confirmResolve=null;
const context=()=>({user:root.currentUser,profile:root.userProfile,permissions:state.permissions.find(p=>email(p.email||p.id)===email(root.currentUser?.email))||{},global:root.userVisaoGlobal===true,nome:root.nomeUsuarioLogado});
const myId=()=>identity(context());
const getGroup=id=>state.groups.find(g=>g.id===id);
const draftStorageKey=()=> 'cij_despesas_form_v2_'+myId().email;
function toast(message,error=false){const node=document.createElement('div');node.className='toast'+(error?' error':'');const label=document.createElement('span');label.textContent=message;const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Fechar mensagem');close.onclick=()=>node.remove();node.append(label,close);$('toast-region').append(node);setTimeout(()=>node.remove(),error?12000:6000)}
function explainError(e){if(e?.code==='storage/unauthorized')return 'O Firebase recusou o comprovante. Publique as regras completas do Storage e confira o acesso do usuário ao módulo Despesas.';if(e?.code==='storage/unauthenticated')return 'Sua sessão expirou. Entre novamente no portal para anexar o comprovante.';if(['storage/retry-limit-exceeded','storage/unknown'].includes(e?.code))return 'O envio do comprovante não foi confirmado. Confira a conexão e tente novamente; os campos continuam preenchidos.';if(e?.code==='permission-denied')return 'Operação não autorizada. Confira as permissões do usuário e as regras do Firebase.';if(e?.code==='unavailable')return 'Não foi possível confirmar a gravação. Verifique sua conexão e tente novamente.';return e?.message||String(e)}
function showStatus(message,error=false){const node=$('module-status');node.className='notice'+(error?' error':'');node.textContent=message;node.classList.remove('hidden')}
function connection(){const offline=navigator.onLine===false;$('connection-state').textContent=offline?'Sem conexão':'Conectado';$('connection-state').classList.toggle('offline',offline);$('offline-notice').classList.toggle('hidden',!offline)}
async function requireOnline(){if(navigator.onLine===false)throw new Error('Reconecte à internet para confirmar esta operação.');if(!state.ready)throw new Error('Aguarde o carregamento dos relatórios.');if(state.busy)throw new Error('Uma operação já está sendo processada.')}
async function busyOperation(fn){await requireOnline();state.busy=true;$('expense-fields').disabled=true;$('btn-save').textContent='Salvando…';try{return await fn()}finally{state.busy=false;$('expense-fields').disabled=false;applyFormContext();$('btn-save').textContent=state.edit?'Salvar alterações':'Adicionar despesa'}}
function ask({title,message,reason=false,required=false,ok='Confirmar'}){
 if(confirmResolve)confirmResolve(null);
 $('confirm-title').textContent=title;$('confirm-message').textContent=message;$('confirm-ok').textContent=ok;$('confirm-reason-field').classList.toggle('hidden',!reason);$('confirm-reason').value='';$('confirm-reason').required=required;$('confirm-reason').minLength=required?3:0;
 const dialog=$('confirm-dialog');if(!dialog.open)dialog.showModal();return new Promise(resolve=>{confirmResolve=resolve});
}
function resolveConfirm(value){$('confirm-dialog').close();const resolve=confirmResolve;confirmResolve=null;resolve?.(value)}
function bindConfirm(){ $('confirm-form').addEventListener('submit',e=>{e.preventDefault();resolveConfirm({reason:$('confirm-reason').value.trim()})});$('confirm-cancel').onclick=()=>resolveConfirm(null);$('confirm-dialog').addEventListener('cancel',e=>{e.preventDefault();resolveConfirm(null)})}
async function firebaseSdk(){if(state.sdk)return state.sdk;state.sdk=await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');return state.sdk}
const collection=n=>root.fsCollection(root.AppDB,...BASE,n);
async function getRows(n,scope=null){const api=await firebaseSdk();const q=scope?api.query(collection(n),api.where(scope[0],'==',scope[1])):collection(n);const snap=await root.fsGetDocs(q);const rows=[];snap.forEach(d=>rows.push({...d.data(),id:d.id}));return rows}
function adapter(){return {doc:(...parts)=>root.fsDoc(root.AppDB,...parts),getDoc:ref=>root.fsGetDoc(ref),runTransaction:fn=>root.fsRunTransaction(root.AppDB,fn)}}
async function listenRows(n,onRows,scope=null,firstRequired=false){
 const api=await firebaseSdk(),q=scope?api.query(collection(n),api.where(scope[0],'==',scope[1])):collection(n);
 return new Promise((resolve,reject)=>{let initial=true;const unsub=root.fsOnSnapshot(q,snap=>{const rows=[];snap.forEach(d=>rows.push({...d.data(),id:d.id}));onRows(rows);if(initial){initial=false;resolve()}},e=>{if(firstRequired)showStatus(explainError(e),true);else toast('Não foi possível atualizar '+({[COL.cards]:'os cartões',[COL.permissions]:'as permissões'}[n]||'os dados')+'. '+explainError(e),true);if(initial){initial=false;reject(e)}});state.unsubscribers.push(unsub)});
}
async function startDataListeners(){
 state.unsubscribers.splice(0).forEach(unsub=>unsub());
 const global=canReadAll(context()),owner=myId().email;
 await Promise.all([
   listenRows(COL.items,rows=>{state.items=rows;root.expenses=rows;renderData()},global?null:['autor',owner],true),
   listenRows(COL.reports,rows=>{state.headers=rows;renderData()},global?null:['ownerEmail',owner],true),
   listenRows(COL.cards,rows=>{state.cards=rows;renderCardsSelect();if($('cards-dialog').open)renderCardsAdmin()},null,true),
   isMaster(context())?listenRows(COL.permissions,rows=>{state.permissions=rows;renderPermissionButtons();renderReportPicker();renderData()}):listenOwnPermissions(owner)
 ]);
}
async function listenOwnPermissions(owner){return new Promise((resolve,reject)=>{let initial=true;const unsub=root.fsOnSnapshot(root.fsDoc(root.AppDB,...BASE,COL.permissions,owner),snap=>{const previous=canReadAll(context());state.permissions=snap.exists()?[{...snap.data(),id:owner}]:[];renderPermissionButtons();renderCardsSelect();renderData();if(!initial&&previous!==canReadAll(context())){renderLookups();startDataListeners().catch(e=>toast(explainError(e),true))}if(initial){initial=false;resolve()}},e=>{if(initial){initial=false;reject(e)}toast(explainError(e),true)});state.unsubscribers.push(unsub)})}
async function initModule(){
 const generation=++state.initGeneration;state.ready=false;$('main-content').classList.remove('hidden');$('login-screen')?.classList.add('hidden');showStatus('Carregando relatórios, cartões e cadastros…');connection();
 try{
   for(const name of ['fsCollection','fsDoc','fsGetDoc','fsGetDocs','fsOnSnapshot','fsRunTransaction'])if(typeof root[name]!=='function')throw new Error('O core.js precisa disponibilizar '+name+'. Use a versão atual do Portal.');
   repository=new ExpenseRepository(adapter(),context);const ownPermission=await root.fsGetDoc(root.fsDoc(root.AppDB,...BASE,COL.permissions,myId().email));state.permissions=ownPermission.exists()?[{...ownPermission.data(),id:myId().email}]:[];
   const deps=await Promise.allSettled([getRows('usuarios_permissoes'),getRows('cadastros_clientes'),getRows('os_ordens'),isMaster(context())?getRows(COL.permissions):Promise.resolve(state.permissions)]);
   if(generation!==state.initGeneration)return;
   state.users=deps[0].status==='fulfilled'?deps[0].value:[];state.clients=deps[1].status==='fulfilled'?deps[1].value:[];state.os=deps[2].status==='fulfilled'?deps[2].value:[];
   if(deps[3].status==='fulfilled')state.permissions=deps[3].value;
   if(isMaster(context())&&navigator.onLine!==false){await repository.mirrorAccess(state.users,state.permissions);await repository.initializeCards()}
   renderLookups();setClientMode($('cliente-mode').value);renderPermissionButtons();$('data_pagamento').value=localToday();setCurrentMonth(false);
   await startDataListeners();if(generation!==state.initGeneration)return;
   if(isMaster(context())&&navigator.onLine!==false)await repository.initializeCounter(state.items);
   state.ready=true;renderData();restoreFormDraft();
   const missing=deps.slice(0,3).some(r=>r.status==='rejected');if(missing)showStatus('Relatórios carregados. Alguns cadastros não puderam ser consultados; cliente e cidade podem ser preenchidos manualmente.',true);else $('module-status').classList.add('hidden');
 }catch(e){state.ready=false;showStatus('Não foi possível iniciar o módulo. '+explainError(e),true);const retry=document.createElement('button');retry.type='button';retry.className='button secondary';retry.textContent='Tentar novamente';retry.onclick=initModule;$('module-status').append(retry)}
}
root.initModule=initModule;
function professionalRecords(){
 const records=state.users.map(u=>({id:text(u.authUid||u.uid||u.id||u.email),email:email(u.email),nome:text(u.nome||u.displayName||u.name||u.email)})).filter(u=>u.id&&u.nome);
 const me=myId();if(!records.some(u=>u.email===me.email))records.push({id:me.uid,email:me.email,nome:me.nome});
 return records.filter((u,i,a)=>a.findIndex(x=>x.id===u.id)===i).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
}
const clientLabel=c=>text(c.fantasia||c.razao_social||c.nomeFantasia||c.razaoSocial||c.nome||c.cliente);
const clientCity=c=>text(c.cidade||c.municipio||c.endereco?.cidade||c.endereco?.municipio||c.endereco_cidade);
function setClientMode(mode){
 const manual=mode==='manual';$('cliente-mode').value=manual?'manual':'cadastro';
 if(manual)$('cliente').removeAttribute('list');else $('cliente').setAttribute('list','clientes-options');
 $('cliente').placeholder=manual?'Digite o nome do cliente':'Selecione ou digite o cliente';
 $('cliente-help').textContent=manual?'O nome será registrado somente nesta despesa, sem criar um cadastro.':'Escolha um nome sugerido. Para informar outro nome, selecione a opção de digitar.';
}
function selectedClient(){return $('cliente-mode').value==='manual'?null:state.clients.find(c=>clientLabel(c)===text($('cliente').value))}
function renderLookups(){
 const old=$('tecnico').value;const professionals=professionalRecords();$('tecnico').innerHTML='<option value="">Selecione…</option>'+professionals.filter(u=>canReadAll(context())||u.email===myId().email).map(u=>`<option value="${esc(u.id)}">${esc(u.nome)}</option>`).join('');
 $('tecnico').value=old||professionals.find(u=>u.email===myId().email)?.id||'';
 $('clientes-options').innerHTML=state.clients.map(c=>`<option value="${esc(clientLabel(c))}">${esc(clientCity(c))}</option>`).join('');
 const orders=state.os.filter(o=>o.is_deleted!==true).filter(o=>canReadAll(context())||[o.tecnicoId,o.tecnicoUid,...(o.tecnicoIds||[])].some(id=>[myId().uid,myId().email].includes(String(id)))||o.criadoPorEmail===myId().email||o.tecnicoNome===myId().nome);
 $('os-select').innerHTML='<option value="">Sem vínculo com OS</option>'+orders.sort((a,b)=>String(b.osNumber||b.numero||'').localeCompare(String(a.osNumber||a.numero||''))).map(o=>`<option value="${esc(o.id)}">${esc(o.osNumber||o.numero||'OS')} · ${esc(o.clienteNome||o.cliente||'')}</option>`).join('');
}
function renderPermissionButtons(){$('btn-cards').classList.toggle('hidden',!canManageCards(context()));$('btn-permissions').classList.toggle('hidden',!isMaster(context()))}
function filters(){return {search:$('filter-search').value,start:$('filter-start').value,end:$('filter-end').value,professional:$('filter-professional').value,category:$('filter-category').value,status:$('filter-status').value}}
function renderData(){
 state.groups=buildGroups(state.items,state.headers,context());renderReportPicker();
 const old=$('filter-professional').value,names=[...new Set(state.groups.map(g=>g.header.tecnico))].filter(Boolean).sort((a,b)=>a.localeCompare(b,'pt-BR'));$('filter-professional').innerHTML='<option value="">Todos</option>'+names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');$('filter-professional').value=names.includes(old)?old:'';
 state.filtered=filterGroups(state.groups,filters());renderSummary();renderPage();
}
function renderSummary(){
 const items=state.filtered.flatMap(g=>g.matched);$('total-filtered').textContent=money(items.reduce((n,i)=>n+itemCents(i),0));$('items-filtered-count').textContent=items.length+' despesa'+(items.length===1?'':'s');$('reports-filtered-count').textContent=state.filtered.length;$('reports-finalized-count').textContent=state.filtered.filter(g=>g.header.status==='FINALIZADO').length;$('scope-label').textContent=canReadAll(context())?'Visão de todos os usuários':'Somente seus relatórios';
 const totals=new Map();items.forEach(i=>totals.set(categoryLabel(i),(totals.get(categoryLabel(i))||0)+itemCents(i)));$('summary-categories').innerHTML=totals.size?[...totals].sort((a,b)=>b[1]-a[1]).map(([cat,total])=>`<span class="category-chip">${esc(cat)}<strong>${esc(money(total))}</strong></span>`).join(''):'<small>Nenhuma despesa neste período.</small>';
}
const statusBadge=status=>`<span class="badge ${({RASCUNHO:'draft',FINALIZADO:'final',REEMBOLSADO:'paid',EXCLUIDO:'deleted'})[status]||''}">${({RASCUNHO:'Rascunho',FINALIZADO:'Finalizado',REEMBOLSADO:'Reembolsado',EXCLUIDO:'Excluído'})[status]||esc(status)}</span>`;
function actionButton(action,id,label,cls='secondary'){return `<button type="button" class="button ${cls}" data-action="${action}" data-report="${esc(id)}">${esc(label)}</button>`}
function renderPage(){
 const pages=Math.max(1,Math.ceil(state.filtered.length/10));state.page=Math.min(Math.max(state.page,1),pages);const visible=state.filtered.slice((state.page-1)*10,state.page*10);
 $('empty-state').classList.toggle('hidden',state.filtered.length>0);$('reports-list').innerHTML=visible.map(g=>{
   const h=g.header,c=context(),editable=canEdit(c,h),manageable=owns(c,h)||canManageReports(c),expanded=state.expanded.has(g.id),partial=g.matched.length!==g.items.length;
   const number=h.num_relatorio==='Rascunho'?'Rascunho':h.num_relatorio;
   let actions=actionButton('details',g.id,expanded?'Ocultar detalhes':'Detalhes')+actionButton('pdf',g.id,'PDF completo')+actionButton('excel',g.id,'Excel completo')+actionButton('history',g.id,'Histórico');
   if(editable)actions+=actionButton('select',g.id,'Adicionar despesas')+(g.items.length?actionButton('FINALIZE',g.id,'Finalizar','primary'):'');
   if(manageable&&h.status==='FINALIZADO')actions+=actionButton('REOPEN',g.id,'Reabrir');
   if(canManageReports(c)&&h.status==='FINALIZADO')actions+=actionButton('REIMBURSE',g.id,'Registrar reembolso');
   if(canManageReports(c)&&h.status==='REEMBOLSADO')actions+=actionButton('UNDO_REIMBURSE',g.id,'Desfazer reembolso');
   if(manageable&&h.status!=='REEMBOLSADO'&&h.status!=='EXCLUIDO'&&(editable||canManageReports(c)))actions+=actionButton('DELETE_REPORT',g.id,'Excluir','danger');
   return `<article class="report-card panel" data-report-card="${esc(g.id)}"><div class="report-summary"><div><div class="report-title-line"><strong class="report-number">${esc(number)}</strong>${statusBadge(h.status)}${g.legacy?'<span class="badge legacy">Legado</span>':''}</div><div class="report-person">${esc(h.tecnico)}</div><div class="report-owner">Responsável: ${esc(h.ownerEmail||'não identificado')}</div><div class="report-clients">${esc(g.clientes.slice(0,2).join(' · ')||'Sem despesas')}${g.clientes.length>2?' · +'+(g.clientes.length-2)+' cliente(s)':''}</div><div class="report-meta">${g.items.length} item(s)${g.minDate?' · '+dateLabel(g.minDate)+(g.maxDate!==g.minDate?' a '+dateLabel(g.maxDate):''):''}</div></div><div><div class="report-amount"><small>TOTAL DO RELATÓRIO</small>${esc(money(g.totalCentavos))}</div>${partial?`<div class="report-subtotal">No filtro: ${esc(money(g.subtotalCentavos))} · ${g.matched.length}/${g.items.length} itens</div>`:''}</div></div><div class="report-actions">${actions}</div>${expanded?`<div class="report-details"><div class="details-label">Todas as despesas do relatório: ${g.items.length} item(s).${partial?' Os filtros selecionam os relatórios; os detalhes incluem também os itens fora do filtro.':''}</div>${g.items.map(i=>renderExpense(i,g)).join('')||'<div class="details-label">Nenhuma despesa ativa. Consulte o histórico para ver as alterações.</div>'}${h.reembolsoReferencia?`<div class="report-observations">Referência do reembolso: ${esc(h.reembolsoReferencia)}</div>`:''}</div>`:''}</article>`;
 }).join('');$('page-label').textContent=`Página ${state.page} de ${pages}`;$('page-prev').disabled=state.page<=1;$('page-next').disabled=state.page>=pages;
}
function safeUrl(url){try{const u=new URL(url,location.href);return ['https:','http:','blob:'].includes(u.protocol)?u.href:'#'}catch(_){return '#'}}
function renderExpense(i,g){const editable=canEdit(context(),g.header),card=state.cards.find(c=>c.id===i.cartaoId);return `<div class="expense-item"><div><div class="item-description">${esc(text(i.descricao)||categoryLabel(i))}</div><div class="item-meta">${esc(categoryLabel(i))} · ${esc(i.pagamento||'')} · ${dateLabel(i.data_pagamento)}<br>${esc(i.cliente)} · ${esc(i.cidade)}${needsCard(i.pagamento)?'<br>'+esc(i.cartao)+(card?.ativo===false?' · cancelado':''):''}${i.osNumber?'<br>OS: '+esc(i.osNumber):''}</div>${i.observacoes?`<div class="item-observations">${esc(i.observacoes)}</div>`:''}<div class="item-receipts">${(i.anexos||[]).map((a,n)=>`<a href="${esc(safeUrl(a.url))}" target="_blank" rel="noopener noreferrer">Comprovante ${n+1}</a>`).join('')}</div></div><div class="item-right"><strong class="item-value">${esc(money(itemCents(i)))}</strong>${editable?`<div class="item-actions"><button class="text-button" type="button" data-action="edit" data-report="${esc(g.id)}" data-item="${esc(i.id)}">Editar</button><button class="text-button delete-link" type="button" data-action="delete-item" data-report="${esc(g.id)}" data-item="${esc(i.id)}">Excluir</button></div>`:''}</div></div>`}
function renderReportPicker(){
 const editable=state.groups.filter(g=>canEdit(context(),g.header));const current=state.workingReportId;
 $('report-select').innerHTML='<option value="">Novo rascunho</option>'+editable.map(g=>`<option value="${esc(g.id)}">${esc(g.header.num_relatorio)} · ${esc(g.header.tecnico)} · ${g.items.length} itens${owns(context(),g.header)?'':' · '+esc(g.header.ownerEmail)}</option>`).join('');
 $('report-select').value=editable.some(g=>g.id===current)?current:'';applyFormContext();
}
function applyFormContext(){
 const g=getGroup(state.workingReportId);$('current-report-label').textContent=g?g.header.num_relatorio:'Novo rascunho';$('current-report-owner').textContent=g?'Responsável: '+g.header.ownerEmail:'Os lançamentos deste relatório pertencem a você.';
 const editable=!g||canEdit(context(),g.header);$('btn-save').disabled=!editable||!state.ready;$('form-footnote').textContent=editable?'O sucesso será confirmado após a gravação.':'Este relatório foi fechado. Cancele a edição e selecione outro rascunho.';
 $('tecnico').disabled=!!g||state.busy;
 if(g){let p=professionalRecords().find(u=>u.id===g.header.profissionalId||u.nome===g.header.tecnico);if(!p){p={id:g.header.profissionalId||'legacy-professional-'+encodeURIComponent(g.header.tecnico),nome:g.header.tecnico};if(![...$('tecnico').options].some(o=>o.value===p.id)){const option=document.createElement('option');option.value=p.id;option.textContent=p.nome;$('tecnico').append(option)}}$('tecnico').value=p.id}
 $('report-select').disabled=!!state.edit||state.busy;
}
function renderCardsSelect(){
 const selected=$('cartao').value;const original=state.edit;
 const options=state.cards.filter(c=>c.ativo===true||original&&(c.id===original.cartaoId||c.label===original.cartao||cardLabel(c)===original.cartao));
 $('cartao').innerHTML='<option value="">Selecione o cartão…</option>'+options.map(c=>`<option value="${esc(c.id)}">${esc(cardLabel(c))}${c.ativo===false?' (cancelado · lançamento original)':''}</option>`).join('');
 if(original&&needsCard(original.pagamento)&&!options.some(c=>c.id===original.cartaoId||cardLabel(c)===original.cartao)){
   const option=document.createElement('option');option.value='__legacy__';option.textContent=(original.cartao||'Cartão antigo')+' (lançamento original)';$('cartao').append(option);
 }
 $('cartao').value=selected||original?.cartaoId||options.find(c=>cardLabel(c)===original?.cartao)?.id||(original&&needsCard(original.pagamento)?'__legacy__':'');
}
function toggleInputs(){const required=descriptionRequired($('categoria').value);$('descricao').required=required;$('descricao-status').textContent=required?'*':'opcional';$('descricao-status').classList.toggle('optional',!required);const custom=$('categoria').value==='Outros';$('custom-category-field').classList.toggle('hidden',!custom);$('categoria_outros').required=custom;if(!custom)$('categoria_outros').value='';const card=needsCard($('pagamento').value);$('card-field').classList.toggle('hidden',!card);$('cartao').required=card;if(!card)$('cartao').value=''}
function saveFormDraft(){if(!myId().email||state.busy)return;try{const fields={};['tecnico','cliente-mode','cliente','cidade','descricao','valor','data_pagamento','categoria','categoria_outros','pagamento','cartao','observacoes','os-select'].forEach(id=>fields[id]=$(id).value);localStorage.setItem(draftStorageKey(),JSON.stringify({fields,reportId:state.workingReportId,expenseId:state.edit?.id||'',savedAtISO:isoNow()}))}catch(_){}}
function restoreFormDraft(){try{const saved=JSON.parse(localStorage.getItem(draftStorageKey())||'null');if(!saved)return;if(saved.expenseId){const g=state.groups.find(g=>g.items.some(i=>i.id===saved.expenseId));const i=g?.items.find(i=>i.id===saved.expenseId);if(!g||!i||!canEdit(context(),g.header)){localStorage.removeItem(draftStorageKey());return}fillEdit(g,i)}else if(saved.reportId&&getGroup(saved.reportId)&&canEdit(context(),getGroup(saved.reportId).header))state.workingReportId=saved.reportId;
 for(const [id,value]of Object.entries(saved.fields||{}))if($(id))$(id).value=value;setClientMode(saved.fields?.['cliente-mode']||$('cliente-mode').value);toggleInputs();renderReportPicker();toast('Preenchimento anterior restaurado. Confira os campos antes de salvar.')}catch(_){}}
function resetExpense(){
 state.edit=null;state.attachments.forEach(a=>a.objectUrl&&URL.revokeObjectURL(a.objectUrl));state.attachments=[];state.removedAttachments=[];
 ['descricao','valor','observacoes'].forEach(id=>$(id).value='');$('data_pagamento').value=localToday();$('receipt-files').value='';$('receipt-camera').value='';$('form-mode').textContent='Novo item';$('form-mode').className='badge draft';$('form-title').textContent='Nova despesa';$('btn-save').textContent='Adicionar despesa';$('btn-cancel-edit').classList.add('hidden');renderCardsSelect();renderAttachments();applyFormContext();try{localStorage.removeItem(draftStorageKey())}catch(_){}}
function hasUnsaved(){return !!text($('descricao').value)||!!text($('valor').value)||state.attachments.some(a=>a.file)}
async function selectReport(id){const g=id?getGroup(id):null;if(id&&(!g||!canEdit(context(),g.header)))throw new Error('Selecione um relatório em rascunho que você possa modificar.');if(hasUnsaved()&&!await ask({title:'Trocar de relatório?',message:'O preenchimento atual ainda não foi salvo. Deseja descartá-lo?',ok:'Descartar e continuar'}))return;resetExpense();state.workingReportId=id;renderReportPicker();document.querySelector('.entry-panel')?.scrollIntoView({behavior:'smooth',block:'start'})}
function fillEdit(g,i){state.edit={...i};state.workingReportId=g.id;setClientMode(i.clienteModo||(i.clienteId?'cadastro':'manual'));['cliente','cidade','descricao','categoria','categoria_outros','pagamento','observacoes'].forEach(id=>$(id).value=i[id]||'');$('valor').value=(itemCents(i)/100).toFixed(2).replace('.',',');$('data_pagamento').value=normalizeDate(i.data_pagamento);if(i.osId&&!state.os.some(o=>o.id===i.osId)){const option=document.createElement('option');option.value=i.osId;option.textContent=(i.osNumber||'OS antiga')+' (vínculo original)';$('os-select').append(option)}$('os-select').value=i.osId||'';state.attachments=(i.anexos||[]).map(a=>({...a}));state.removedAttachments=[];renderCardsSelect();$('cartao').value=i.cartaoId||state.cards.find(c=>cardLabel(c)===i.cartao)?.id||(needsCard(i.pagamento)?'__legacy__':'');toggleInputs();renderReportPicker();renderAttachments();$('form-mode').textContent='Editando';$('form-title').textContent='Editar despesa';$('btn-save').textContent='Salvar alterações';$('btn-cancel-edit').classList.remove('hidden')}
async function editExpense(groupId,itemId){const g=getGroup(groupId),i=g?.items.find(x=>x.id===itemId);if(!g||!i||!canEdit(context(),g.header))throw new Error('Esta despesa não está disponível para edição.');if(hasUnsaved()&&!await ask({title:'Editar outra despesa?',message:'Descartar o preenchimento que ainda não foi salvo?',ok:'Continuar'}))return;resetExpense();fillEdit(g,i);document.querySelector('.entry-panel')?.scrollIntoView({behavior:'smooth',block:'start'})}
function renderAttachments(){$('attachments-preview').innerHTML=state.attachments.map((a,i)=>`<div class="attachment-preview">${a.objectUrl&&a.contentType?.startsWith('image/')?`<img src="${esc(a.objectUrl)}" alt="Prévia do comprovante">`:''}<span title="${esc(a.nome)}">${esc(a.nome)}</span>${a.url?`<a href="${esc(safeUrl(a.url))}" target="_blank" rel="noopener noreferrer">Abrir</a>`:'<small>Novo</small>'}<button type="button" data-remove-attachment="${i}" aria-label="Remover comprovante">×</button></div>`).join('')}
async function compressImage(file){if(file.type==='application/pdf')return file;let bitmap;try{if(typeof createImageBitmap==='function')bitmap=await createImageBitmap(file);}catch(_){}if(!bitmap){const url=URL.createObjectURL(file),img=new Image();try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('Não foi possível abrir a imagem. Selecione uma foto JPG, PNG ou WebP.'));img.src=url;});bitmap={width:img.naturalWidth,height:img.naturalHeight,image:img,close:()=>URL.revokeObjectURL(url)};}catch(error){URL.revokeObjectURL(url);throw error;}}try{const scale=Math.min(1,1800/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap.image||bitmap,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.84));if(!blob)throw new Error('Não foi possível preparar a imagem.');return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'})}finally{bitmap.close()}}
async function addFiles(files){for(const file of [...files]){if(state.attachments.length>=3)throw new Error('Você já selecionou três comprovantes.');if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type))throw new Error('Use imagens JPG, PNG, WebP ou PDF.');if(file.size>MAX_FILE)throw new Error('Cada comprovante pode ter até 8 MB.');const ready=await compressImage(file);state.attachments.push({file:ready,nome:ready.name,contentType:ready.type,size:ready.size,objectUrl:ready.type.startsWith('image/')?URL.createObjectURL(ready):''});renderAttachments()}saveFormDraft()}
async function uploadAttachments(expenseId){const uploaded=[];try{for(const a of state.attachments){if(!a.file)continue;if(!myId().uid||root.AppAuth?.currentUser&&root.AppAuth.currentUser.uid!==myId().uid)throw Object.assign(new Error('Entre novamente para enviar o comprovante.'),{code:'storage/unauthenticated'});if(!root.AppStorage||!root.fbStorageRef||!root.fbUploadBytes||!root.fbGetDownloadURL)throw new Error('O Storage de comprovantes não está disponível no core.js.');const path=`despesas_comprovantes/${myId().uid}/${expenseId}/${uuid()}.${a.contentType==='application/pdf'?'pdf':'jpg'}`,ref=root.fbStorageRef(root.AppStorage,path);await root.fbUploadBytes(ref,a.file,{contentType:a.contentType});const record={nome:a.nome,url:'',storagePath:path,contentType:a.contentType,size:a.size,ownerUid:myId().uid};uploaded.push(record);record.url=await root.fbGetDownloadURL(ref)}return uploaded}catch(e){await cleanupFiles(uploaded);throw e}}
async function cleanupFiles(files){for(const a of files){if(!a.storagePath||!root.fbDeleteObject)continue;try{await root.fbDeleteObject(root.fbStorageRef(root.AppStorage,a.storagePath))}catch(e){console.warn('[Despesas] comprovante preservado no Storage',e)}}}
function applyResult(groupId,result){state.headers=state.headers.filter(h=>h.id!==groupId).concat(result.header);const oldGroup=getGroup(groupId),oldIds=new Set(oldGroup?.items.map(i=>i.id)||[]);state.items=state.items.filter(i=>i.reportId!==groupId&&!oldIds.has(i.id)).concat(result.items);renderData()}
async function submitExpense(event){event.preventDefault();let uploaded=[];try{await busyOperation(async()=>{
   const p=professionalRecords().find(u=>u.id===$('tecnico').value);if(!p&&!state.workingReportId)throw new Error('Selecione o profissional responsável.');
   const existing=state.workingReportId?getGroup(state.workingReportId):null;if(state.workingReportId&&!existing)throw new Error('O relatório mudou. Selecione outro rascunho.');
   const id=state.edit?.id||uuid(),group=existing||{id:uuid(),legacy:false,header:{},items:[]},card=state.cards.find(c=>c.id===$('cartao').value),order=state.os.find(o=>o.id===$('os-select').value),client=selectedClient();
   const input={cliente:$('cliente').value,clienteId:client?.id||'',clienteModo:$('cliente-mode').value,cidade:$('cidade').value,descricao:$('descricao').value,valor:$('valor').value,data_pagamento:$('data_pagamento').value,categoria:$('categoria').value,categoria_outros:$('categoria_outros').value,pagamento:$('pagamento').value,cartaoId:card?.id||'',cartao:card?cardLabel(card):state.edit?.cartao||'',cartaoLegado:$('cartao').value==='__legacy__'?state.edit?.cartao||'':'',observacoes:$('observacoes').value,osId:$('os-select').value,osNumber:order?.osNumber||order?.numero||($('os-select').value===state.edit?.osId?state.edit?.osNumber||'':''),anexos:state.attachments.filter(a=>!a.file)};
   validateExpense(input);uploaded=await uploadAttachments(id);input.anexos=[...input.anexos,...uploaded];
   const result=await repository.mutate(group,'SAVE_ITEM',{input,expenseId:state.edit?.id||'',newExpenseId:id,expectedRevision:state.edit?.revision||0,profissional:p});
   applyResult(group.id,result);state.workingReportId=group.id;await cleanupFiles(state.removedAttachments);resetExpense();renderReportPicker();toast('Despesa gravada com sucesso.');
 })}catch(e){await cleanupFiles(uploaded);toast(explainError(e),true)}}
async function reportAction(action,id,itemId=''){
 const g=getGroup(id);if(!g)throw new Error('Relatório não encontrado.');
 const messages={FINALIZE:['Finalizar relatório?',`Confirmar ${g.items.length} despesa(s), total de ${money(g.totalCentavos)}?`,'Finalizar'],REOPEN:['Reabrir relatório?','O relatório voltará a rascunho, mantendo seu número e histórico.','Reabrir'],REIMBURSE:['Registrar reembolso?',`Marcar o relatório de ${money(g.totalCentavos)} como reembolsado?`,'Registrar'],UNDO_REIMBURSE:['Desfazer reembolso?','Informe o motivo para retornar o relatório à situação Finalizado.','Desfazer'],DELETE_REPORT:['Excluir relatório?',`Excluir todas as ${g.items.length} despesas deste relatório? O histórico da exclusão será preservado.`,'Excluir'],DELETE_ITEM:['Excluir despesa?','Remover somente esta despesa do relatório?','Excluir']};
 const [title,message,ok]=messages[action]||[];if(!title)return;
 const answer=await ask({title,message,ok,reason:['REIMBURSE','UNDO_REIMBURSE','DELETE_REPORT'].includes(action),required:action==='UNDO_REIMBURSE'});if(!answer)return;
 await busyOperation(async()=>{const item=g.items.find(i=>i.id===itemId),result=await repository.mutate(g,action,{reason:answer.reason,expenseId:itemId,expectedRevision:item?.revision||0});applyResult(g.id,result);if(state.workingReportId===g.id&&!canEdit(context(),result.header)){resetExpense();state.workingReportId='';renderReportPicker()}toast(action==='FINALIZE'?'Relatório '+result.header.num_relatorio+' finalizado.':'Operação concluída e registrada no histórico.')});
}
async function showHistory(id){const g=getGroup(id);if(!g)return;$('history-title').textContent='Histórico · '+g.header.num_relatorio;$('history-list').textContent='Carregando…';$('history-dialog').showModal();try{const rows=[];const snap=await root.fsGetDocs(root.fsCollection(root.AppDB,...BASE,COL.reports,id,'historico'));snap.forEach(d=>rows.push({...d.data(),id:d.id}));$('history-list').innerHTML=rows.sort((a,b)=>String(b.createdAtISO).localeCompare(String(a.createdAtISO))).map(x=>`<div class="history-event"><strong>${esc(x.titulo||x.tipo)}</strong><div>${esc(x.descricao||'')}${x.reason?'\n'+esc(x.reason):''}</div><div>${esc(money(x.totalAntesCentavos))} → ${esc(money(x.totalDepoisCentavos))} · ${Number(x.itensDepois||0)} item(s)</div><small>${esc(x.actorNome||x.actorEmail)} · ${esc(timeLabel(x.createdAtISO))}</small></div>`).join('')||'<div class="notice">Este relatório ainda não possui eventos na nova versão. As despesas antigas continuam preservadas.</div>'}catch(e){$('history-list').textContent=explainError(e)}}
function setCurrentMonth(render=true){const d=new Date(),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0');$('filter-start').value=`${y}-${m}-01`;$('filter-end').value=`${y}-${m}-${String(new Date(y,d.getMonth()+1,0).getDate()).padStart(2,'0')}`;if(render){state.page=1;renderData()}}
function exportRows(groups,filtered){return groups.flatMap(g=>(filtered?g.matched:g.items).map(i=>({'Relatório':g.header.num_relatorio,'Situação':g.header.status,'Responsável':g.header.ownerEmail,'Profissional':g.header.tecnico,'Cliente':i.cliente,'Cidade':i.cidade,'OS':i.osNumber||'','Descrição':i.descricao,'Categoria':categoryLabel(i),'Data do pagamento':normalizeDate(i.data_pagamento),'Forma de pagamento':i.pagamento,'Cartão':i.cartao||'Não se aplica','Valor (R$)':itemCents(i)/100,'Observações':i.observacoes||'','Comprovantes':(i.anexos||[]).map(a=>a.url).join(' | ')})))}
function exportExcel(groupId=''){
 if(!root.XLSX)throw new Error('A exportação Excel não carregou. Verifique a conexão e atualize a página.');const groups=groupId?[getGroup(groupId)].filter(Boolean):state.filtered;if(!groups.length)throw new Error('Não há despesas para exportar.');
 const rows=exportRows(groups,!groupId),reports=groups.map(g=>({'Relatório':g.header.num_relatorio,'Situação':g.header.status,'Profissional':g.header.tecnico,'Responsável':g.header.ownerEmail,'Data inicial':g.minDate,'Data final':g.maxDate,'Total completo (R$)':g.totalCentavos/100,'Subtotal exportado (R$)':(groupId?g.totalCentavos:g.subtotalCentavos)/100,'Itens completos':g.items.length,'Itens exportados':groupId?g.items.length:g.matched.length}));
 const wb=root.XLSX.utils.book_new();for(const [name,data]of [['Relatórios',reports],['Despesas',rows]]){const ws=root.XLSX.utils.json_to_sheet(data);ws['!cols']=Object.keys(data[0]||{}).map(k=>({wch:k==='Descrição'||k==='Observações'?38:k==='Comprovantes'?50:22}));if(ws['!ref'])ws['!autofilter']={ref:ws['!ref']};for(const [address,cell]of Object.entries(ws)){if(address.startsWith('!'))continue;if(typeof cell.v==='string'&&/^[=+@-]/.test(cell.v)){cell.t='s';delete cell.f}if(typeof cell.v==='number')cell.z='0.00'}root.XLSX.utils.book_append_sheet(wb,ws,name)}
 root.XLSX.writeFile(wb,'despesas-'+(groupId?groups[0].header.num_relatorio:'filtro')+'-'+localToday()+'.xlsx');
}
function exportPdf(groupId=''){
 const groups=groupId?[getGroup(groupId)].filter(Boolean):state.filtered;if(!groups.length)throw new Error('Não há despesas para exportar.');
 if(!root.jspdf?.jsPDF)throw new Error('A exportação PDF não carregou. Verifique a conexão e atualize a página.');
 const doc=new root.jspdf.jsPDF({unit:'mm',format:'a4'});if(typeof doc.autoTable!=='function')throw new Error('A tabela do PDF não carregou. Atualize a página com conexão.');
 doc.setFont('helvetica','bold');doc.setFontSize(17);doc.setTextColor(20,34,56);doc.text('GRUPO CIJ',14,18);doc.setFontSize(12);doc.text(groupId?'Relatório de despesas':'Despesas do período filtrado',14,26);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(90,105,120);doc.text('Gerado em '+timeLabel(isoNow())+' · '+myId().nome,14,33);
 let y=40;
 for(const g of groups){if(y>235){doc.addPage();y=18}const h=g.header,items=groupId?g.items:g.matched;
   doc.setTextColor(20,34,56);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text(`${h.num_relatorio} · ${h.tecnico} · ${h.status}`,14,y);doc.setFont('helvetica','normal');doc.setFontSize(8);const subtitle=doc.splitTextToSize('Responsável: '+h.ownerEmail+' · Período: '+dateLabel(g.minDate)+' a '+dateLabel(g.maxDate),180);doc.text(subtitle,14,y+5);y+=7+subtitle.length*3;
   doc.autoTable({startY:y,margin:{left:14,right:14,top:16,bottom:16},head:[['Data','Descrição / cliente','Categoria / pagamento','Valor']],body:items.map(i=>[dateLabel(i.data_pagamento),i.descricao+'\n'+i.cliente+' · '+i.cidade+(i.osNumber?'\n'+i.osNumber:''),categoryLabel(i)+'\n'+i.pagamento+(needsCard(i.pagamento)?' · '+i.cartao:'')+(i.observacoes?'\n'+i.observacoes:''),money(itemCents(i))]),styles:{font:'helvetica',fontSize:7.5,cellPadding:2.2,overflow:'linebreak',lineColor:[226,233,240],lineWidth:.1},headStyles:{fillColor:[20,46,67],textColor:255,fontSize:7.5},columnStyles:{0:{cellWidth:21},1:{cellWidth:67},2:{cellWidth:66},3:{cellWidth:28,halign:'right'}},alternateRowStyles:{fillColor:[246,249,252]},rowPageBreak:'avoid'});
   y=doc.lastAutoTable.finalY+6;if(y>260){doc.addPage();y=18}doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text('Total completo: '+money(g.totalCentavos),14,y);if(!groupId&&g.matched.length!==g.items.length){doc.setFont('helvetica','normal');doc.text('Subtotal exportado: '+money(g.subtotalCentavos)+' · '+g.matched.length+'/'+g.items.length+' itens',14,y+5);y+=5}y+=12;
 }
 const pages=doc.internal.getNumberOfPages();for(let p=1;p<=pages;p++){doc.setPage(p);doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(120,130,140);doc.text('Grupo CIJ · Prestação de contas',14,288);doc.text(p+' / '+pages,194,288,{align:'right'})}doc.save('despesas-'+(groupId?groups[0].header.num_relatorio:'filtro')+'-'+localToday()+'.pdf');
}
async function openCards(){const c=await repository.freshContext();if(!canManageCards(c))throw new Error('Seu usuário não está autorizado a gerenciar cartões.');resetCardForm();renderCardsAdmin();$('cards-dialog').showModal()}
function resetCardForm(){state.cardEdit=null;$('card-form').reset();$('card-id').value='';$('card-active').value='true';$('card-save').textContent='Salvar cartão'}
function renderCardsAdmin(){$('cards-list').innerHTML=state.cards.sort((a,b)=>Number(b.ativo)-Number(a.ativo)||cardLabel(a).localeCompare(cardLabel(b))).map(c=>`<div class="admin-row"><div><h3>${esc(cardLabel(c))}</h3><small>${c.ativo?'Disponível para novos lançamentos':'Cancelado · histórico preservado'}</small></div><div class="admin-row-actions"><span class="badge ${c.ativo?'paid':'deleted'}">${c.ativo?'Ativo':'Cancelado'}</span><button class="button secondary" data-edit-card="${esc(c.id)}" type="button">Editar</button><button class="button ${c.ativo?'danger':'secondary'}" data-toggle-card="${esc(c.id)}" type="button">${c.ativo?'Cancelar cartão':'Reativar'}</button></div></div>`).join('')||'<div class="notice">Nenhum cartão cadastrado. Inclua o primeiro cartão acima.</div>'}
async function saveCard(event){event.preventDefault();await requireOnline();const btn=$('card-save');btn.disabled=true;try{const result=await repository.saveCard({id:$('card-id').value,nome:$('card-name').value,bandeira:$('card-brand').value,final:$('card-last4').value,ativo:$('card-active').value==='true',revision:state.cardEdit?.revision||0});state.cards=state.cards.filter(c=>c.id!==result.id).concat(result);resetCardForm();renderCardsAdmin();renderCardsSelect();toast('Cartão salvo. As despesas antigas mantêm a identificação registrada.')}finally{btn.disabled=false}}
async function toggleCard(id){await requireOnline();const card=state.cards.find(c=>c.id===id);if(!card)return;const answer=await ask({title:card.ativo?'Cancelar cartão?':'Reativar cartão?',message:card.ativo?`${cardLabel(card)} deixará de aparecer em novos lançamentos. O histórico será mantido.`:`${cardLabel(card)} voltará a aparecer em novos lançamentos.`,ok:card.ativo?'Cancelar cartão':'Reativar'});if(!answer)return;const result=await repository.saveCard({...card,ativo:!card.ativo});state.cards=state.cards.filter(c=>c.id!==id).concat(result);renderCardsAdmin();renderCardsSelect();toast(result.ativo?'Cartão reativado.':'Cartão cancelado. Histórico preservado.')}
async function openPermissions(){if(!isMaster(await repository.freshContext()))throw new Error('Somente Master pode alterar autorizações.');state.permissions=await getRows(COL.permissions);renderPermissions();$('permissions-dialog').showModal()}
function renderPermissions(){const users=state.users.filter(u=>email(u.email)).sort((a,b)=>text(a.nome).localeCompare(text(b.nome),'pt-BR'));$('permissions-list').innerHTML=users.map(u=>{const e=email(u.email),p=state.permissions.find(p=>email(p.email||p.id)===e)||{},master=u.perfil==='Master'||ROOT_EMAILS.includes(e),active=u.perfil==='Master'||(u.modulos||[]).includes('despesas.html');return `<div class="permissions-row" data-permission-email="${esc(e)}"><h3>${esc(u.nome||u.displayName||e)} ${master?'<span class="badge final">Master</span>':''}</h3><small>${esc(e)}${active?'':' · Sem acesso ao módulo no cadastro de usuários'}</small><div class="permissions-checks"><label><input type="checkbox" data-permission="gerenciarCartoes" ${master||p.gerenciarCartoes?'checked':''} ${master||!active?'disabled':''}> Gerenciar cartões</label><label><input type="checkbox" data-permission="gerenciarRelatorios" ${master||p.gerenciarRelatorios?'checked':''} ${master||!active?'disabled':''}> Gerenciar relatórios</label><label><input type="checkbox" data-permission="verTodos" ${master||p.verTodos||u.visaoGlobalPorTela?.['despesas.html']===true?'checked':''} ${master||!active?'disabled':''}> Ver todos os relatórios</label></div></div>`}).join('')||'<div class="notice">Não foi possível consultar o cadastro de usuários. Confira a permissão de leitura de usuarios_permissoes.</div>'}
async function savePermissions(event){event.preventDefault();await requireOnline();const btn=$('permissions-save');btn.disabled=true;try{const rows=[...$('permissions-list').querySelectorAll('[data-permission-email]')].map(node=>{const e=node.dataset.permissionEmail,u=state.users.find(u=>email(u.email)===e);return {email:e,nome:u?.nome||u?.displayName||e,uid:u?.authUid||u?.uid||'',master:u?.perfil==='Master'||ROOT_EMAILS.includes(e),moduloAtivo:u?.perfil==='Master'||(u?.modulos||[]).includes('despesas.html'),gerenciarCartoes:node.querySelector('[data-permission="gerenciarCartoes"]').checked,gerenciarRelatorios:node.querySelector('[data-permission="gerenciarRelatorios"]').checked,verTodos:node.querySelector('[data-permission="verTodos"]').checked}});await repository.savePermissions(rows);state.permissions=state.permissions.filter(p=>!rows.some(r=>r.email===email(p.email||p.id))).concat(rows);renderPermissionButtons();$('permissions-dialog').close();toast('Autorizações salvas.')}finally{btn.disabled=false}}
function bind(){
 bindConfirm();document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
 $('expense-form').addEventListener('submit',submitExpense);$('expense-form').addEventListener('input',saveFormDraft);$('expense-form').addEventListener('change',saveFormDraft);
 $('categoria').onchange=()=>{toggleInputs();saveFormDraft()};$('pagamento').onchange=()=>{toggleInputs();saveFormDraft()};$('btn-cancel-edit').onclick=()=>{resetExpense();renderReportPicker()};
 $('btn-new-report').onclick=()=>selectReport('').catch(e=>toast(explainError(e),true));$('report-select').onchange=()=>{const id=$('report-select').value;selectReport(id).catch(e=>toast(explainError(e),true))};
 $('os-select').onchange=()=>{const o=state.os.find(o=>o.id===$('os-select').value);if(o){$('cliente').value=o.clienteNome||o.cliente||'';const c=state.clients.find(c=>c.id===o.clienteId||clientLabel(c)===$('cliente').value);setClientMode(c?'cadastro':'manual');if(c)$('cidade').value=clientCity(c);if(!state.workingReportId&&canReadAll(context())){const p=professionalRecords().find(p=>[o.tecnicoId,o.tecnicoUid,...(o.tecnicoIds||[])].includes(p.id));if(p)$('tecnico').value=p.id}}saveFormDraft()};
 $('cliente-mode').onchange=()=>{setClientMode($('cliente-mode').value);saveFormDraft()};
 $('cliente').addEventListener('change',()=>{const c=selectedClient();if(c&&clientCity(c))$('cidade').value=clientCity(c);saveFormDraft()});
 for(const id of ['receipt-files','receipt-camera'])$(id).onchange=async()=>{try{await addFiles($(id).files)}catch(e){toast(explainError(e),true)}finally{$(id).value=''}};
 $('attachments-preview').onclick=e=>{const b=e.target.closest('[data-remove-attachment]');if(!b)return;const [a]=state.attachments.splice(Number(b.dataset.removeAttachment),1);if(a?.storagePath)state.removedAttachments.push(a);if(a?.objectUrl)URL.revokeObjectURL(a.objectUrl);renderAttachments();saveFormDraft()};
 for(const id of ['filter-search','filter-start','filter-end','filter-professional','filter-category','filter-status'])$(id).addEventListener(id==='filter-search'?'input':'change',()=>{if($('filter-start').value&&$('filter-end').value&&$('filter-start').value>$('filter-end').value){toast('A data inicial deve ser anterior à data final.',true);return}state.page=1;renderData()});
 $('btn-current-month').onclick=()=>setCurrentMonth();$('btn-clear-filters').onclick=()=>{['filter-search','filter-start','filter-end','filter-professional','filter-category','filter-status'].forEach(id=>$(id).value='');state.page=1;renderData()};
 $('page-prev').onclick=()=>{state.page--;renderPage()};$('page-next').onclick=()=>{state.page++;renderPage()};
 $('reports-list').onclick=async e=>{const b=e.target.closest('[data-action]');if(!b)return;const {action,report,item}=b.dataset;try{if(action==='details'){state.expanded.has(report)?state.expanded.delete(report):state.expanded.add(report);renderPage()}else if(action==='pdf')exportPdf(report);else if(action==='excel')exportExcel(report);else if(action==='history')await showHistory(report);else if(action==='select')await selectReport(report);else if(action==='edit')await editExpense(report,item);else await reportAction(action==='delete-item'?'DELETE_ITEM':action,report,item)}catch(error){toast(explainError(error),true)}};
 $('btn-excel').onclick=()=>{try{exportExcel()}catch(e){toast(explainError(e),true)}};$('btn-pdf-filter').onclick=()=>{try{exportPdf()}catch(e){toast(explainError(e),true)}};
 $('btn-cards').onclick=()=>openCards().catch(e=>toast(explainError(e),true));$('card-form').onsubmit=e=>saveCard(e).catch(error=>toast(explainError(error),true));$('card-reset').onclick=resetCardForm;
 $('cards-list').onclick=e=>{const edit=e.target.closest('[data-edit-card]'),toggle=e.target.closest('[data-toggle-card]');if(edit){const c=state.cards.find(c=>c.id===edit.dataset.editCard);if(c){state.cardEdit={...c};$('card-id').value=c.id;$('card-name').value=c.nome||'';$('card-brand').value=c.bandeira;$('card-last4').value=c.final;$('card-active').value=String(c.ativo);$('card-save').textContent='Salvar alterações'}}if(toggle)toggleCard(toggle.dataset.toggleCard).catch(error=>toast(explainError(error),true))};
 $('btn-permissions').onclick=()=>openPermissions().catch(e=>toast(explainError(e),true));$('permissions-form').onsubmit=e=>savePermissions(e).catch(error=>toast(explainError(error),true));
 root.addEventListener('online',connection);root.addEventListener('offline',connection);
}
bind();
})(typeof window!=='undefined'?window:globalThis);
