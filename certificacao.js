(function(w){
 'use strict';
 const D=w.CertDados,R=w.CertRepo,P=w.CertPDF,$=id=>document.getElementById(id),e=D.esc;
 const S={ready:false,rows:[],clientes:[],equipamentos:[],os:[],osEquip:[],padroes:[],executantes:[],alertas:[],config:{},entry:null,refs:[],tab:'certificados',busy:false,dirty:false,urls:[],timer:null,autosave:null};
 const root=()=>$('cert-app'),page=()=>root().dataset.mode,hasModule=id=>w.userProfile?.perfil==='Master'||(w.userProfile?.modulos||[]).includes(id);
 const allowedType=type=>hasModule(type==='PADRAO'?'padroes_teste.html':'certificacao.html');
 const canReadRecord=rec=>allowedType(rec.type)&&(w.userProfile?.perfil==='Master'||rec.ownerUid===w.currentUser?.uid||w.userProfile?.visaoGlobalPorTela?.[rec.type==='PADRAO'?'padroes_teste.html':'certificacao.html']===true||['revisar','aprovar','emitir','enviar','faturar'].some(k=>D.can(w.userProfile,k,rec.type)));
 const editable=rec=>rec.status==='RASCUNHO'?D.can(w.userProfile,'preencher',rec.type)&&(rec.ownerUid===w.currentUser?.uid||w.userProfile?.perfil==='Master'):['PRONTO','EM_REVISAO','APROVADO'].includes(rec.status)&&D.can(w.userProfile,'revisar',rec.type);
 const button=(action,label,kind='',extra='')=>`<button type="button" class="cert-btn ${kind}" data-action="${action}" ${extra}>${label}</button>`;
 const label=(value,optional=true)=>e(value)+(optional?'':' <span style="color:#ad3434;display:inline">*</span>');
 function field(k,name,value='',options={}){
  const input=options.choices?`<select id="f-${k}" ${options.disabled?'disabled':''} ${options.required?'required':''}>${options.choices.map(([v,l])=>`<option value="${e(v)}" ${String(value||'')===String(v)?'selected':''}>${e(l)}</option>`).join('')}</select>`:options.area?`<textarea id="f-${k}" ${options.disabled?'readonly':''}>${e(value)}</textarea>`:`<input id="f-${k}" type="${options.type||'text'}" value="${e(value)}" ${options.disabled?'readonly':''} ${options.required?'required':''} maxlength="${options.max||2000}">`;
  return `<label class="${options.wide?'wide':''}"><span>${label(name,!options.required)}</span>${input}${options.hint?`<small class="cert-hint">${e(options.hint)}</small>`:''}</label>`;
 }
 const section=(name,body,open=true)=>`<details class="cert-section" ${open?'open':''}><summary>${e(name)}</summary><div class="cert-fields">${body}</div></details>`;
 function toast(text){$('cert-toast')?.remove();const box=document.createElement('div');box.id='cert-toast';box.className='cert-toast';box.textContent=text;root().appendChild(box);setTimeout(()=>box.remove(),4500);}
 async function run(fn){if(S.busy)return;S.busy=true;root().querySelectorAll('[data-action]').forEach(b=>b.disabled=true);try{return await fn();}catch(err){console.error('[Certificação]',err);alert(err.message||String(err));}finally{S.busy=false;root().querySelectorAll('[data-action]').forEach(b=>b.disabled=false);}}
 async function reload(){
  S.rows=(await R.entries()).filter(x=>canReadRecord(x.record));
  [S.clientes,S.equipamentos,S.os,S.padroes,S.executantes,S.alertas]=await Promise.all(['clientes','equipamentos','os','padroes','executantes','alertas'].map(n=>R.cached(n)));
  S.config=await R.settings();S.clientes=S.clientes.filter(c=>c.is_deleted!==true&&c.ativo!==false);S.equipamentos=S.equipamentos.filter(c=>c.is_deleted!==true&&c.ativo!==false);S.os=S.os.filter(c=>c.is_deleted!==true);
  S.osEquip=await R.cached('os_equipamentos');
 }
 function executantes(){
  const people=S.executantes.filter(p=>p.ativo!==false&&p.is_deleted!==true&&!p.contaTabletCertificacao&&/t[eé]cnico/i.test(p.perfil||'')).map(p=>({id:p.id,nome:p.nome||p.email}));
  for(const nome of S.config.executantesAdicionais||[])people.push({id:'extra:'+nome,nome});return people.sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
 }
 function header(){
  const title=page()==='padroes'?'Padrões de teste':page()==='alertas'?'Central de alertas':'Certificação de equipamentos';
  return `<div class="cert-head"><div><h1>${title}</h1><p class="cert-sub">Preenchimento em campo, revisão interna e certificados · v1.1.0</p></div><div class="cert-top-actions">${D.can(w.userProfile,'preencher',page()==='padroes'?'PADRAO':'EQUIPAMENTO')?button('new',page()==='padroes'?'+ Certificar padrão':'+ Novo certificado','primary'):''}${button('prepare','Preparar offline')}${button('sync','Sincronizar')}</div></div><div id="cert-connection" class="cert-banner"></div>`;
 }
 function tabs(){return `<nav class="cert-tabs" aria-label="Áreas da certificação">${(page()==='alertas'?[]:[['certificados','Certificados'],...(hasModule('padroes_teste.html')?[['banco','Banco de padrões']]:[])]).concat(hasModule('cert_alertas.html')?[['alertas','Alertas']]:[]).concat(D.can(w.userProfile,'configurar')||D.can(w.userProfile,'configurar','PADRAO')?[['config','Configuração']]:[]).map(([id,name])=>`<button class="cert-tab ${S.tab===id?'active':''}" data-action="tab" data-tab="${id}">${name}</button>`).join('')}</nav>`;}
 async function render(){await reload();root().innerHTML=header()+tabs()+'<div id="cert-body"></div>';await connection();if(S.entry)await editor(S.entry.record.id);else renderTab();}
 async function connection(){
  const pending=S.rows.filter(x=>x.dirty).length,conflicts=S.rows.filter(x=>x.conflict).length,prepared=await R.get('meta',R.key('prepared'));
  const box=$('cert-connection');if(!box)return;box.className='cert-banner'+(navigator.onLine===false||conflicts?' warning':'');
  box.textContent=(navigator.onLine===false?'Sem internet · dados salvos neste aparelho':'Conectado')+' · '+pending+' registro(s) aguardando sincronização'+(conflicts?' · '+conflicts+' para conferência':'')+(prepared?' · preparação: '+new Date(prepared.value.at).toLocaleString('pt-BR'):' · prepare o aparelho antes de trabalhar offline');
 }
 function renderTab(){
  const box=$('cert-body');if(!box)return;
  if(S.tab==='certificados'){
   const type=page()==='padroes'?'PADRAO':'EQUIPAMENTO',rows=S.rows.filter(x=>x.record.type===type);
   box.innerHTML=`<div class="cert-kpis">${[['Total',rows.length],['Em preenchimento',rows.filter(x=>x.record.status==='RASCUNHO').length],['Aguardando revisão',rows.filter(x=>['PRONTO','EM_REVISAO'].includes(x.record.status)).length],['PDFs emitidos',rows.filter(x=>x.record.pdf).length]].map(([name,n])=>`<div class="cert-kpi"><strong>${n}</strong><span>${name}</span></div>`).join('')}</div><div class="cert-filters"><input class="cert-search" id="cert-search" placeholder="Cliente, número, OS, equipamento ou série" aria-label="Pesquisar certificados"><select id="cert-status" aria-label="Filtrar etapa"><option value="">Todas as etapas</option>${Object.entries(D.STATUS).map(([v,n])=>`<option value="${v}">${n}</option>`).join('')}</select><input id="cert-from" type="date" aria-label="Data inicial"><input id="cert-to" type="date" aria-label="Data final"></div><div id="cert-list" class="cert-list"></div>`;renderRows();
  }else if(S.tab==='banco')renderBank();else if(S.tab==='alertas')renderAlerts();else renderConfig();
 }
 function renderRows(){
  const box=$('cert-list');if(!box)return;const search=($('cert-search')?.value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),status=$('cert-status')?.value||'',from=$('cert-from')?.value||'',to=$('cert-to')?.value||'',type=page()==='padroes'?'PADRAO':'EQUIPAMENTO';
  const rows=S.rows.filter(x=>{const r=x.record;if(r.type!==type)return false;const hay=[r.numero,...Object.values(r.data||{}).filter(v=>typeof v==='string')].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),day=r.data?.dataServico||r.createdAtISO.slice(0,10);return hay.includes(search)&&(!status||r.status===status)&&(!from||day>=from)&&(!to||day<=to);});
  box.innerHTML=rows.map(x=>{const r=x.record;return `<article class="cert-record"><div><span class="cert-number">${e(r.numero)}</span> <span class="cert-pill ${['PRONTO','EM_REVISAO'].includes(r.status)?'ready':r.pdf?'done':''}">${e(D.STATUS[r.status])}</span>${x.dirty?' <span class="cert-pill local">Salvo no aparelho</span>':''}<h3>${e(r.data.clienteNome||'Cliente ainda não informado')}</h3><p>${e(r.data.equipamento||'Equipamento ainda não informado')} · ${e(r.data.marca||'')} · Série ${e(r.data.numeroSerie||'')}</p><p>${e(r.data.osNumero||'Sem OS vinculada')} · ${e(r.data.dataServico||'')} · ${e(r.data.executanteNome||'Executante não informado')}</p>${x.error?`<p style="color:#a32339">${e(x.error)}</p>`:''}</div><div class="cert-record-actions">${button('open','Abrir','',`data-id="${r.id}"`)}</div></article>`;}).join('')||'<div class="cert-empty">Nenhum certificado encontrado. Use “Novo certificado” para iniciar um atendimento.</div>';
 }
 function clientName(c){return c.fantasia||c.nome_fantasia||c.razao_social||c.razaoSocial||c.nome||'Cliente';}
 function clientOptions(d){const options=[['','Selecione o cliente'],...S.clientes.map(c=>[c.id,clientName(c)])];if(d.clienteId&&!options.some(([id])=>id===d.clienteId))options.push([d.clienteId,d.clienteNome]);return options;}
 function osOptions(d){return [['','Sem OS vinculada'],...S.os.filter(o=>!d.clienteId||String(o.clienteId||o.cliente_id||'')===String(d.clienteId)).map(o=>[o.id,o.osNumber||o.numero||o.id])];}
 function equipmentOptions(d){const physical=S.equipamentos.filter(p=>String(p.clienteId||p.cliente_id||'')===String(d.clienteId));return [['','Informar novo equipamento'],...physical.map(p=>[p.id,(p.modelo||p.nome||'Equipamento')+' · '+(p.numeroSerie||p.numero_serie||p.serial||'')]),...S.osEquip.filter(p=>p.osId===d.osId&&!physical.some(x=>x.id===(p.parqueId||p.parqueEquipamentoId))).map(p=>['os:'+p.id,(p.modelo||p.nome||'Equipamento da OS')+' · '+(p.numeroSerie||'')])];}
 async function editor(id){
  const entry=await R.entry(id);if(!entry||!canReadRecord(entry.record))throw new Error('Certificado não disponível para esta conta.');
  S.entry=entry;S.dirty=false;const r=entry.record,d=r.data,canEdit=editable(r)&&!entry.conflict,review=r.status!=='RASCUNHO'&&['PRONTO','EM_REVISAO','APROVADO'].includes(r.status),disabled=!canEdit;
  S.refs=D.clone(d.padroes||[]);const people=[['','Selecione o executante (opcional)'],...executantes().map(p=>[p.id,p.nome])];if(d.executanteId&&!people.some(([id])=>id===d.executanteId))people.push([d.executanteId,d.executanteNome||'Executante registrado']);
  let body=`<div class="cert-inline-actions">${button('back','← Voltar à central')}${button('history','Histórico')}${button('backup','Exportar cópia local')}</div><div class="cert-editor-head"><div><div class="cert-hint">${r.type==='PADRAO'?'Certificação de padrão de teste':'Certificação de equipamento'}</div><h2>${e(r.numero)}</h2><p class="cert-hint">Este é o número definitivo para a etiqueta.</p></div><div>${button('copy','Copiar número')}${button('label','Etiqueta')}</div></div><div class="cert-banner"><b id="cert-stage">${e(D.STATUS[r.status])}</b> · <span id="cert-save-status">${entry.dirty?'Salvo no aparelho; aguardando sincronização.':'Registro sincronizado.'}</span></div>`;
  if(entry.error)body+=`<div class="cert-banner error">${e(entry.error)}${entry.conflict?'<p>Exporte a cópia local antes de comparar com o servidor. Nenhum número será alterado automaticamente.</p>'+button('resolve','Consultar versão do servidor'):''}</div>`;
  body+=`<form id="cert-form" novalidate>${section('1. Cliente e atendimento',
   field('clienteId','Cliente',d.clienteId,{choices:clientOptions(d),required:true,disabled})+field('osId','OS vinculada',d.osId,{choices:osOptions(d),disabled})+
   field('clienteNome','Nome do cliente',d.clienteNome,{required:true,disabled})+field('cnpj','CNPJ',d.cnpj,{disabled})+field('unidade','Unidade',d.unidade,{disabled})+field('contato','Contato',d.contato,{disabled})+field('endereco','Endereço',d.endereco,{wide:true,disabled})+field('cidadeUF','Cidade / UF',d.cidadeUF,{disabled})+
   field('dataServico','Data do serviço',d.dataServico,{type:'date',disabled})+field('ambiente','Onde foi realizado',d.ambiente,{choices:[['','Não informado'],['CAMPO','Campo'],['LABORATORIO','Laboratório']],disabled})+field('localServico','Local do serviço',d.localServico,{disabled})+field('executanteId','Executante do serviço',d.executanteId,{choices:people,disabled,hint:'Escolha quem realizou o serviço. A conta do tablet não define o executante.'})+field('acompanhante','Acompanhado por',d.acompanhante,{disabled}))}`;
  body+=section(r.type==='PADRAO'?'2. Padrão do cliente a certificar':'2. Equipamento',
   (r.type==='EQUIPAMENTO'?field('equipamentoId','Equipamento cadastrado',d.equipamentoId||(d.equipamentoOSId?'os:'+d.equipamentoOSId:''),{choices:equipmentOptions(d),wide:true,disabled}):field('padraoAlvoId','Padrão cadastrado do cliente',d.padraoAlvoId,{choices:[['','Informar novo padrão'],...S.padroes.filter(p=>p.proprietario==='CLIENTE'&&p.clienteId===d.clienteId).map(p=>[p.id,p.nome+' · '+(p.numeroSerie||'')])],wide:true,disabled}))+
   field('equipamento',r.type==='PADRAO'?'Identificação do padrão':'Equipamento',d.equipamento,{required:true,disabled})+field('marca','Marca',d.marca,{required:true,disabled})+field('modelo','Modelo',d.modelo,{disabled})+field('numeroSerie','Número de série',d.numeroSerie,{required:true,disabled})+field('tag','TAG / identificação local',d.tag,{disabled})+field('tipo','Tipo',d.tipo,{disabled})+
   (r.type==='EQUIPAMENTO'?`<label class="cert-check wide"><input id="f-cadastrarEquipamento" type="checkbox" ${d.cadastrarEquipamento?'checked':''} ${disabled?'disabled':''}> Cadastrar o equipamento novo também no Parque de Máquinas deste cliente, ao concluir e sincronizar.</label>`:field('material','Material',d.material,{choices:[['','Não informado'],['Ferroso','Ferroso'],['Não ferroso','Não ferroso'],['Aço inox','Aço inox'],['Outro','Outro']],disabled})+field('diametroNominal','Diâmetro nominal (mm)',d.diametroNominal,{disabled})+field('formato','Formato / suporte',d.formato,{disabled})));
  if(r.type==='EQUIPAMENTO')body+=section('3. Configuração e linha',field('abertura','Abertura (mm)',d.abertura,{disabled})+field('fase','Fase / frequência / potência',d.fase,{disabled})+field('sensibilidade','Sensibilidade',d.sensibilidade,{disabled})+field('receita','Receita / programa',d.receita,{disabled})+field('produto','Produto',d.produto,{disabled})+field('temperaturaProduto','Temperatura do produto (°C)',d.temperaturaProduto,{disabled})+field('rejeicao','Sistema de rejeição',d.rejeicao,{disabled})+field('velocidade','Velocidade da linha',d.velocidade,{disabled})+field('posicaoPadrao','Posição do corpo de prova',d.posicaoPadrao,{disabled})+field('condicaoProduto','Condição do teste',d.condicaoProduto,{choices:[['','Não informado'],['Com produto','Com produto'],['Sem produto','Sem produto']],disabled}),false);
  body+=section('Padrões de referência utilizados *',`<div class="wide"><p class="cert-hint">Selecione os padrões do banco ou use o preenchimento manual. Os dados utilizados ficam preservados neste certificado.</p>${canEdit?`<div class="cert-inline-actions"><select id="cert-ref-select" aria-label="Selecionar padrão de referência"><option value="">Selecione um padrão</option>${S.padroes.filter(p=>p.ativo!==false).map(p=>`<option value="${p.id}">${e(p.nome)}${p.diametro?' · Ø '+e(p.diametro)+' mm':''}${p.validade&&p.validade<D.today()?' · VENCIDO':''}</option>`).join('')}</select>${button('add-ref','Adicionar')}${button('manual-ref','Informar manualmente')}</div>`:''}<div id="cert-refs"></div></div>`);
  if(r.type==='PADRAO')body+=section('Medições do padrão',field('leitura1','Leitura 1 (mm)',d.leitura1,{disabled})+field('leitura2','Leitura 2 (mm)',d.leitura2,{disabled})+field('leitura3','Leitura 3 (mm)',d.leitura3,{disabled})+field('media','Média (mm)',d.media,{disabled:true})+field('desvio','Desvio do nominal (mm)',d.desvio,{disabled:true})+field('incerteza','Incerteza expandida (mm)',d.incerteza,{disabled})+field('fatorK','Fator de abrangência k',d.fatorK,{disabled})+field('confianca','Nível de confiança (%)',d.confianca,{disabled}));
  body+=section('Condições, procedimento e conclusão',field('temperaturaAmbiente','Temperatura ambiente (°C)',d.temperaturaAmbiente,{disabled})+field('umidade','Umidade relativa (%)',d.umidade,{disabled})+field('procedimento','Procedimento / método',d.procedimento,{disabled})+field('revisaoProcedimento','Revisão do procedimento',d.revisaoProcedimento,{disabled})+field('criterio','Critério de aceitação',d.criterio,{area:true,wide:true,disabled})+field('conclusao','Conclusão técnica',d.conclusao,{choices:[['','Não informado'],['APROVADO','Aprovado'],['APROVADO_COM_RESSALVA','Aprovado com ressalva'],['REPROVADO','Reprovado']],disabled})+field('proximaAvaliacao','Próxima avaliação acordada',d.proximaAvaliacao,{type:'date',disabled})+field('observacoes','Observações',d.observacoes,{area:true,wide:true,disabled})+field('responsavelTecnico','Responsável técnico',d.responsavelTecnico,{disabled}));
  body+='</form>';
  if(review){const editReview=D.can(w.userProfile,'revisar',r.type);body+=section('Revisão interna e conteúdo do certificado',field('titulo','Título do certificado',r.titulo,{wide:true,disabled:!editReview})+field('dataEmissao','Data de emissão',r.dataEmissao,{type:'date',disabled:!editReview})+field('documentRevision','Revisão do documento',r.documentRevision||'00',{max:10,disabled:!editReview})+field('internalNotes','Notas internas — não aparecem no PDF',r.internalNotes,{area:true,wide:true,disabled:!editReview})+`<div class="wide"><p class="cert-hint">Marque as informações que devem aparecer no PDF. Campos em branco são omitidos. O número do certificado identifica sempre o documento.</p><div class="cert-inline-actions">${editReview?button('visible-all','Mostrar todos')+button('visible-none','Ocultar todos'):''}${button('preview','Atualizar prévia')}</div><div class="cert-toggle-grid">${D.fields(r.type).map(([key,name])=>`<label class="cert-check"><input type="checkbox" data-visible="${key}" ${r.visible?.[key]!==false?'checked':''} ${!editReview?'disabled':''}>${e(name)}</label>`).join('')}</div></div>`);
   body+=`<div class="cert-banner warning"><b>Conferência técnica</b><div id="cert-review-warnings"></div></div><div id="cert-preview" class="cert-preview"></div>`;
  }
  body+=`<div class="cert-sticky">${r.status==='RASCUNHO'&&canEdit?button('save','Salvar rascunho')+button('ready','Concluir serviço','green'):''}${review&&D.can(w.userProfile,'revisar',r.type)?button('review','Salvar revisão')+button('return','Devolver ao técnico'):''}${['PRONTO','EM_REVISAO'].includes(r.status)&&D.can(w.userProfile,'aprovar',r.type)?button('approve','Aprovar para emissão','green'):''}${r.status==='APROVADO'&&D.can(w.userProfile,'emitir',r.type)?button('issue','Gerar PDF oficial','primary'):''}${r.pdf?button('download','Baixar PDF','primary'):''}${r.status==='EMITIDO'&&D.can(w.userProfile,'enviar',r.type)?button('sent','Registrar envio ao cliente','green'):''}${r.status==='ENVIADO'&&D.can(w.userProfile,'faturar',r.type)?button('bill','Liberar faturamento','green'):''}${['RASCUNHO','PRONTO','EM_REVISAO','APROVADO'].includes(r.status)&&D.can(w.userProfile,'revisar',r.type)?button('cancel','Cancelar','danger'):''}${D.can(w.userProfile,'preencher',r.type)?button('another','Outro item na mesma OS'):''}</div>`;
  $('cert-body').innerHTML=body;renderRefs();preview();window.scrollTo({top:0,behavior:'smooth'});
 }
 function renderRefs(){
  const r=S.entry.record,canEdit=editable(r)&&!S.entry.conflict;
  $('cert-refs').innerHTML=S.refs.map((p,i)=>`<div class="cert-pattern-row" data-ref="${i}"><header><b>${e(p.nome||'Referência manual')}</b>${canEdit?button('remove-ref','Remover','small danger',`data-index="${i}"`):''}</header><p class="cert-hint">${p.manual?'Preenchimento manual':'Dados preservados do banco'}${p.validade&&p.validade<D.today()?' · Referência vencida':''}</p><div class="cert-fields">${[['nome','Identificação *'],['material','Material'],['diametro','Diâmetro (mm)'],['marca','Marca'],['numeroSerie','Nº de série'],['certNumero','Certificado de referência'],['certData','Data do certificado'],['certEmissor','Emissor / referência documental'],['validade','Validade']].map(([k,name])=>`<label><span>${e(name)}</span><input data-ref-field="${k}" value="${e(p[k]||'')}" ${!canEdit?'readonly':''} ${['validade','certData'].includes(k)?'type="date"':''}></label>`).join('')}</div>${p.certURL||p.certStoragePath?button('ref-document','Consultar certificado','small',`data-index="${i}"`):''}${r.type==='EQUIPAMENTO'?`<div class="cert-hint" style="margin-top:12px">Validação em três ciclos</div>${[1,2,3].map(n=>`<div class="cert-cycle"><b>Ciclo ${n}</b>${['sinal','rejeicao'].map(k=>`<label><span>${k==='sinal'?'Sinal / detecção':'Rejeição'}</span><select data-cycle="${k+n}" ${!canEdit?'disabled':''}><option value="">Não informado</option>${['OK','Falhou','Não aplicável'].map(v=>`<option value="${v}" ${(r.data.resultados||[])[i]?.[k+n]===v?'selected':''}>${v}</option>`).join('')}</select></label>`).join('')}</div>`).join('')}<label style="margin-top:12px"><span>Resultado individual (opcional)</span><input data-result-field="resultado" value="${e((r.data.resultados||[])[i]?.resultado||'')}" ${!canEdit?'readonly':''}></label>`:''}</div>`).join('')||'<div class="cert-empty">Nenhum padrão selecionado. Adicione ao menos uma referência antes de concluir o serviço.</div>';
 }
 function collect(){
  const record=D.clone(S.entry.record),d=record.data;
  if(['PRONTO','EM_REVISAO'].includes(record.status)&&D.can(w.userProfile,'revisar',record.type)&&S.config.issuer)record.issuer=D.clone(S.config.issuer);
  for(const input of root().querySelectorAll('#cert-form [id^="f-"]')){const k=input.id.slice(2);d[k]=input.type==='checkbox'?input.checked:input.value.trim();}
  if(d.equipamentoId?.startsWith('os:')){d.equipamentoOSId=d.equipamentoId.slice(3);const p=S.osEquip.find(x=>x.id===d.equipamentoOSId&&x.osId===d.osId);d.equipamentoId=p?.parqueId||p?.parqueEquipamentoId||'';}
  const person=executantes().find(p=>p.id===d.executanteId);if(person)d.executanteNome=person.nome;else if(!d.executanteId)d.executanteNome='';
  const os=S.os.find(o=>o.id===d.osId);d.osNumero=os?(os.osNumber||os.numero||os.id):(d.osId?d.osNumero||'':'');
  d.padroes=[];d.resultados=[];root().querySelectorAll('[data-ref]').forEach(row=>{
   const i=Number(row.dataset.ref),ref=D.clone(S.refs[i]);row.querySelectorAll('[data-ref-field]').forEach(input=>ref[input.dataset.refField]=input.value.trim());d.padroes.push(ref);
   const result={nome:ref.nome};row.querySelectorAll('[data-cycle]').forEach(input=>result[input.dataset.cycle]=input.value);row.querySelectorAll('[data-result-field]').forEach(input=>result[input.dataset.resultField]=input.value.trim());if(record.type==='EQUIPAMENTO')d.resultados.push(result);
  });D.readings(d);
  if($('f-titulo'))record.titulo=$('f-titulo').value.trim();if($('f-dataEmissao'))record.dataEmissao=$('f-dataEmissao').value;if($('f-documentRevision'))record.documentRevision=$('f-documentRevision').value.trim()||'00';if($('f-internalNotes'))record.internalNotes=$('f-internalNotes').value;
  root().querySelectorAll('[data-visible]').forEach(input=>record.visible[input.dataset.visible]=input.checked);return record;
 }
 function preview(){
  if(!$('cert-preview'))return;const r=collect();$('cert-preview').innerHTML=P.preview(r);$('cert-review-warnings').innerHTML=D.warnings(r).map(v=>`<p>${e(v)}</p>`).join('')||'<p>Nenhum alerta documental detectado. Confira os resultados e o procedimento aplicado.</p>';
 }
 function markDirty(){
  if(!S.entry||!editable(S.entry.record))return;S.dirty=true;
  if($('cert-save-status'))$('cert-save-status').textContent='Alterações ainda não salvas.';
  if(['leitura1','leitura2','leitura3','diametroNominal'].some(k=>$('f-'+k))){const d=D.readings(collect().data);if($('f-media'))$('f-media').value=d.media;if($('f-desvio'))$('f-desvio').value=d.desvio;}
  if(S.entry.record.status==='RASCUNHO'){clearTimeout(S.autosave);S.autosave=setTimeout(()=>{if(!S.busy)run(()=>saveDraft(false));},1800);}else preview();
 }
 async function saveDraft(message=true){
  clearTimeout(S.autosave);const current=collect();S.entry=await R.saveLocal(current,'save');S.dirty=false;
  $('cert-save-status').textContent='Salvo no aparelho.';if(message)toast('Rascunho salvo.');if(navigator.onLine!==false)R.sync().then(async()=>{await reload();await connection();const updated=await R.entry(current.id);if(S.entry?.record.id===current.id&&!S.dirty){S.entry=updated;if($('cert-save-status'))$('cert-save-status').textContent=updated.dirty?'Salvo no aparelho; aguardando sincronização.':'Registro sincronizado.';}}).catch(console.warn);await reload();await connection();
  const latest=await R.entry(current.id);S.entry=latest;if($('cert-save-status'))$('cert-save-status').textContent=latest.dirty?'Salvo no aparelho; aguardando sincronização.':'Registro sincronizado.';
 }
 function fillClient(){
  const c=S.clientes.find(c=>c.id===$('f-clienteId').value);if(!c)return;
  const values={clienteNome:clientName(c),cnpj:c.cnpj||'',endereco:[c.endereco||c.logradouro,c.numero,c.bairro].filter(Boolean).join(', '),cidadeUF:[c.cidade,c.estado||c.uf].filter(Boolean).join(' / '),contato:c.contatos?.find(x=>x.principal)?.nome||c.contato||'',equipamentoId:'',padraoAlvoId:'',equipamento:'',marca:'',modelo:'',numeroSerie:'',tag:''};
  Object.entries(values).forEach(([k,v])=>{if($('f-'+k))$('f-'+k).value=v;});const d=collect().data;$('f-osId').innerHTML=osOptions(d).map(([v,n])=>`<option value="${e(v)}">${e(n)}</option>`).join('');
  if($('f-equipamentoId'))$('f-equipamentoId').innerHTML=equipmentOptions(d).map(([v,n])=>`<option value="${e(v)}">${e(n)}</option>`).join('');
  if($('f-padraoAlvoId'))$('f-padraoAlvoId').innerHTML='<option value="">Informar novo padrão</option>'+S.padroes.filter(p=>p.proprietario==='CLIENTE'&&p.clienteId===d.clienteId).map(p=>`<option value="${p.id}">${e(p.nome)}</option>`).join('');
 }
 function fillEquipment(){
  const id=$('f-equipamentoId')?.value,p=id?.startsWith('os:')?S.osEquip.find(x=>x.id===id.slice(3)&&x.osId===$('f-osId').value):S.equipamentos.find(x=>x.id===id);if(!p){if(!id)for(const k of ['equipamento','marca','modelo','numeroSerie','tag'])$('f-'+k).value='';return;}
  const values={equipamento:p.modelo||p.nome||p.equipamento||'',marca:p.fabricante||p.marca||'',modelo:p.modelo||'',numeroSerie:p.numeroSerie||p.numero_serie||p.serial||p.serie||'',tag:p.tag||p.identificacaoLocal||''};Object.entries(values).forEach(([k,v])=>$('f-'+k).value=v);if($('f-cadastrarEquipamento'))$('f-cadastrarEquipamento').checked=false;
 }
 function fillSubjectPattern(){
  const p=S.padroes.find(x=>x.id===$('f-padraoAlvoId')?.value);if(!p)return;
  for(const [k,v] of Object.entries({equipamento:p.nome,marca:p.marca||'',numeroSerie:p.numeroSerie||'',material:p.material||'',diametroNominal:p.diametro||'',formato:p.formato||''}))if($('f-'+k))$('f-'+k).value=v;
 }
 function refSnapshot(p){return {id:p.id,nome:p.nome,material:p.material||'',marca:p.marca||'',numeroSerie:p.numeroSerie||'',diametro:p.diametro||'',certNumero:p.certNumero||'',certEmissor:p.certEmissor||'',certData:p.certData||'',validade:p.validade||'',certURL:p.certURL||'',certStoragePath:p.certStoragePath||'',revision:p.revision||0,manual:false};}
 async function newService(type,context={}){
  const entry=await R.newRecord(type);S.entry=entry;
  if(context.clienteId){const c=S.clientes.find(c=>c.id===context.clienteId);if(c)Object.assign(entry.record.data,{clienteId:c.id,clienteNome:clientName(c),cnpj:c.cnpj||'',endereco:[c.endereco||c.logradouro,c.numero,c.bairro].filter(Boolean).join(', '),cidadeUF:[c.cidade,c.estado||c.uf].filter(Boolean).join(' / ')});}
  if(context.osId){const os=S.os.find(o=>o.id===context.osId);if(os)Object.assign(entry.record.data,{osId:os.id,osNumero:os.osNumber||os.numero||os.id});}
  if(context.equipamentoId){const p=S.equipamentos.find(p=>p.id===context.equipamentoId);if(p)Object.assign(entry.record.data,{equipamentoId:p.id,equipamento:p.modelo||p.nome||'',marca:p.fabricante||p.marca||'',modelo:p.modelo||'',numeroSerie:p.numeroSerie||p.numero_serie||p.serial||'',tag:p.tag||''});}
  if(context.equipamentoOSId){let p=S.osEquip.find(p=>p.id===context.equipamentoOSId&&p.osId===context.osId);if(!p&&navigator.onLine!==false){const snap=await (w.fsGetDocFromServer||w.fsGetDoc)(w.fsDoc(w.AppDB,'artifacts','plataforma-cij','public','data','os_ordens',context.osId,'equipamentos',context.equipamentoOSId));if(snap.exists()){p={...snap.data(),id:snap.id,osId:context.osId};S.osEquip.push(p);}}if(p)Object.assign(entry.record.data,{equipamentoOSId:p.id,equipamentoId:p.parqueId||p.parqueEquipamentoId||'',equipamento:p.modelo||p.nome||'',marca:p.marca||p.fabricante||'',modelo:p.modelo||'',numeroSerie:p.numeroSerie||p.numero_serie||p.sn||'',tag:p.identificacaoLocal||p.tag||''});}
  if(context.padraoId){const p=S.padroes.find(p=>p.id===context.padraoId);if(p)Object.assign(entry.record.data,{padraoAlvoId:p.id,equipamento:p.nome,marca:p.marca||'',numeroSerie:p.numeroSerie||'',material:p.material||'',diametroNominal:p.diametro||'',formato:p.formato||''});}
  S.entry=await R.saveLocal(entry.record);await render();
 }
 function renderBank(){
  $('cert-body').innerHTML=`<div class="cert-inline-actions">${D.can(w.userProfile,'gerenciar_padroes','PADRAO')?button('new-pattern','+ Cadastrar padrão','primary'):''}</div><p class="cert-hint">Os certificados emitidos para padrões de clientes atualizam este banco. Os padrões de referência da CIJ podem receber seu documento de calibração no cadastro.</p><input id="cert-bank-search" aria-label="Pesquisar padrões" placeholder="Pesquisar padrão, material, série ou proprietário"><div class="cert-list" id="cert-bank-list" style="margin-top:15px"></div>`;renderBankRows();
 }
 function renderBankRows(){
  const search=($('cert-bank-search')?.value||'').toLowerCase();$('cert-bank-list').innerHTML=S.padroes.filter(p=>[p.nome,p.numeroSerie,p.material,p.clienteNome,p.certNumero].join(' ').toLowerCase().includes(search)).map(p=>`<article class="cert-record"><div><h3>${e(p.nome)}</h3><p>${e(p.material||'')} · Ø ${e(p.diametro||'não informado')} mm · Série ${e(p.numeroSerie||'')}</p><p>${p.proprietario==='CLIENTE'?'Cliente: '+e(p.clienteNome||''):'Padrão da CIJ'} · Certificado ${e(p.certNumero||'não informado')} · Validade ${e(p.validade||'não informada')}</p><span class="cert-pill ${p.ativo===false?'':'done'}">${p.ativo===false?'Inativo':p.validade&&p.validade<D.today()?'Vencido':'Ativo'}</span></div><div class="cert-record-actions">${D.can(w.userProfile,'gerenciar_padroes','PADRAO')?button('edit-pattern','Editar','',`data-id="${p.id}"`):''}${D.can(w.userProfile,'preencher','PADRAO')&&p.proprietario==='CLIENTE'?button('cert-pattern','Certificar','primary',`data-id="${p.id}"`):''}${p.certURL||p.certStoragePath?button('pattern-document','Certificado','',`data-id="${p.id}"`):''}</div></article>`).join('')||'<div class="cert-empty">Nenhum padrão cadastrado. O setor interno pode cadastrar padrões da CIJ e anexar seus certificados.</div>';
 }
 function dialog(html){$('cert-dialog')?.remove();const d=document.createElement('div');d.className='cert-dialog';d.id='cert-dialog';d.innerHTML='<div class="cert-dialog-card" role="dialog" aria-modal="true">'+html+'</div>';root().appendChild(d);}
 function patternDialog(id){
  const p=S.padroes.find(x=>x.id===id)||{id:'',proprietario:'CIJ',ativo:true};S.editPattern=p;
  dialog(`<h2>${p.id?'Editar':'Cadastrar'} padrão</h2><form id="cert-pattern-form"><div class="cert-fields">${[['nome','Identificação'],['marca','Marca'],['numeroSerie','Número de série'],['material','Material'],['diametro','Diâmetro (mm)'],['formato','Formato / suporte'],['certNumero','Certificado de calibração'],['certEmissor','Emissor / referência documental'],['certData','Data da calibração'],['validade','Validade']].map(([k,n])=>`<label><span>${n}</span><input id="p-${k}" value="${e(p[k]||'')}" type="${['certData','validade'].includes(k)?'date':'text'}"></label>`).join('')}<label><span>Proprietário</span><select id="p-proprietario"><option value="CIJ" ${p.proprietario==='CIJ'?'selected':''}>CIJ</option><option value="CLIENTE" ${p.proprietario==='CLIENTE'?'selected':''}>Cliente</option></select></label><label><span>Cliente proprietário</span><select id="p-clienteId">${clientOptions(p).map(([v,n])=>`<option value="${e(v)}" ${p.clienteId===v?'selected':''}>${e(n)}</option>`).join('')}</select></label><label><span>Documento de calibração (PDF, até 10 MB)</span><input id="p-file" type="file" accept="application/pdf,.pdf"><small class="cert-hint">O novo documento substitui a referência atual. Os certificados já feitos conservam a referência usada no serviço.</small></label><label class="cert-check"><input id="p-ativo" type="checkbox" ${p.ativo!==false?'checked':''}> Disponível na lista de referências</label></div></form><div class="cert-inline-actions">${button('save-pattern','Salvar padrão','primary')}${button('close-dialog','Cancelar')}</div>`);
 }
 async function savePattern(){
  const p=D.clone(S.editPattern);for(const k of ['nome','marca','numeroSerie','material','diametro','formato','certNumero','certEmissor','certData','validade','proprietario','clienteId'])p[k]=$('p-'+k).value.trim();p.ativo=$('p-ativo').checked;p.clienteNome=S.clientes.find(c=>c.id===p.clienteId)?clientName(S.clientes.find(c=>c.id===p.clienteId)):'';
  if(p.proprietario==='CLIENTE'&&!p.clienteId)throw new Error('Selecione o cliente proprietário.');if(p.proprietario==='CIJ'){p.clienteId='';p.clienteNome='';}
  if(!p.nome)throw new Error('Informe a identificação do padrão.');
  const f=$('p-file').files[0];if(f){if(f.size>10*1024*1024||(!/\.pdf$/i.test(f.name)&&f.type!=='application/pdf'))throw new Error('Selecione um PDF de até 10 MB.');if(navigator.onLine===false)throw new Error('O envio do documento exige internet.');
   const path='certificacao/padroes/'+(p.id||crypto.randomUUID())+'/'+crypto.randomUUID()+'.pdf';const ref=w.fbStorageRef(w.AppStorage,path);await w.fbUploadBytes(ref,f,{contentType:'application/pdf'});p.certURL=await w.fbGetDownloadURL(ref);p.certStoragePath=path;
  }
  await R.savePattern(p);$('cert-dialog').remove();await render();toast('Padrão salvo. Prepare o tablet para receber a versão atualizada.');
 }
 function renderAlerts(){
  $('cert-body').innerHTML=`<div class="cert-filters"><input id="cert-alert-search" class="cert-search" aria-label="Pesquisar alertas" placeholder="Pesquisar cliente, OS ou certificado"><select id="cert-alert-sector" aria-label="Filtrar setor"><option value="">Todos os setores</option><option value="INTERNO">Setor interno</option><option value="COMERCIAL">Comercial</option><option value="FATURAMENTO">Faturamento</option></select></div><div class="cert-banner">“Certificado enviado” é uma confirmação registrada pela empresa. O envio do arquivo ao cliente e a liberação para faturamento são etapas distintas.</div><div class="cert-list" id="cert-alert-list"></div>`;renderAlertRows();
 }
 function renderAlertRows(){
  const search=($('cert-alert-search')?.value||'').toLowerCase(),sector=$('cert-alert-sector')?.value||'';
  $('cert-alert-list').innerHTML=[...S.alertas].sort((a,b)=>b.createdAtISO.localeCompare(a.createdAtISO)).filter(a=>(!sector||a.setor===sector)&&[a.cliente,a.numero,a.osNumero,a.titulo].join(' ').toLowerCase().includes(search)).map(a=>`<article class="cert-record"><div><span class="cert-pill">${e(a.setor)}</span><h3>${e(a.titulo)}</h3><p>${e(a.numero)} · ${e(a.cliente)} · ${e(a.osNumero||'Sem OS')}</p><p>${new Date(a.createdAtISO).toLocaleString('pt-BR')}</p></div><div>${button('open','Ver certificado','',`data-id="${a.certificateId}"`)}</div></article>`).join('')||'<div class="cert-empty">Nenhum alerta encontrado. Os serviços offline aparecem aqui depois da sincronização.</div>';
 }
 function renderConfig(){
  const c=S.config,issuer=c.issuer||{};
  $('cert-body').innerHTML=section('Empresa emissora',`<p class="cert-hint wide">Estes dados serão propostos na revisão de novos certificados. A identidade da empresa fica preservada no documento aprovado.</p>${[['nome','Nome da empresa'],['cnpj','CNPJ'],['endereco','Endereço'],['telefone','Telefone'],['email','E-mail'],['site','Site']].map(([k,n])=>field('issuer_'+k,n,issuer[k]||({nome:'Grupo CIJ Soluções Industriais',site:'www.grupocij.com.br'})[k]||'')).join('')}`)+section('Executantes e alertas',field('extraExecutantes','Executantes adicionais (um nome por linha)',(c.executantesAdicionais||[]).join('\n'),{area:true,wide:true,hint:'A lista já inclui usuários ativos com perfil Técnico. Contas marcadas como tablet são excluídas.'})+['INTERNO','COMERCIAL','FATURAMENTO'].map(k=>field('dest_'+k,'E-mails do setor '+k,(c.destinatarios?.[k]||[]).join('\n'),{area:true,hint:'Um e-mail por linha. Os destinatários devem ter acesso aos módulos de certificação e alertas.'})).join(''))+button('save-config','Salvar configuração','primary');
 }
 async function saveConfig(){
  const config=D.clone(S.config);config.issuer={};for(const k of ['nome','cnpj','endereco','telefone','email','site'])config.issuer[k]=$('f-issuer_'+k).value.trim();config.executantesAdicionais=$('f-extraExecutantes').value.split('\n').map(v=>v.trim()).filter(Boolean);config.destinatarios={};for(const k of ['INTERNO','COMERCIAL','FATURAMENTO']){const mails=$('f-dest_'+k).value.split(/[\n;,]+/).map(v=>v.trim().toLowerCase()).filter(Boolean);if(mails.some(v=>!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)))throw new Error('Confira os e-mails do setor '+k);config.destinatarios[k]=[...new Set(mails)];}
  await R.saveSettings(config);toast('Configuração salva.');
 }
 async function issue(){
  clearTimeout(S.autosave);if(S.dirty)throw new Error('Salve a revisão e aprove novamente antes de gerar o PDF.');
  if(navigator.onLine===false)throw new Error('A emissão oficial exige internet.');const entry=await R.entry(S.entry.record.id),record=entry.record;
  if(!D.can(w.userProfile,'emitir',record.type)||entry.dirty||entry.conflict)throw new Error('Sem permissão ou registro ainda não sincronizado.');
  const blob=P.create(record),bytes=await blob.arrayBuffer(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
  const path='certificacao/certificados/'+record.id+'/r'+record.revision+'-'+hash.slice(0,16)+'-'+crypto.randomUUID()+'.pdf',ref=w.fbStorageRef(w.AppStorage,path);
  await w.fbUploadBytes(ref,blob,{contentType:'application/pdf'});const url=await w.fbGetDownloadURL(ref);
  await R.transition(record.id,'issue',{pdf:{url,storagePath:path,sha256:hash,size:blob.size,approvedRevision:record.revision,createdAtISO:new Date().toISOString()}});
  P.download(blob,record.numero+'.pdf');await render();toast('PDF emitido e arquivado. O envio ao cliente deve ser registrado separadamente.');
 }
 async function downloadOfficial(){
  const record=(await R.entry(S.entry.record.id)).record;if(!canReadRecord(record)||!record.pdf)throw new Error('PDF oficial não disponível para esta conta.');
  if(navigator.onLine===false)throw new Error('Conecte à internet para baixar o arquivo oficial arquivado.');
  const blob=await w.fbGetBlob(w.fbStorageRef(w.AppStorage,record.pdf.storagePath),10*1024*1024);P.download(blob,record.numero+'.pdf');
 }
 async function documentReference(p){
  const stored=p.id?await R.get('files',R.key('padrao:'+p.id+':'+p.revision)):null;
  let blob=stored?.blob;if(!blob){if(navigator.onLine===false)throw new Error('Documento não preparado neste aparelho. A identificação e o número da referência continuam disponíveis offline.');
   if(p.certStoragePath)blob=await w.fbGetBlob(w.fbStorageRef(w.AppStorage,p.certStoragePath),10*1024*1024);
   else if(p.certURL){const u=new URL(p.certURL);if(!['https:','http:'].includes(u.protocol))throw new Error('Link inválido.');const res=await fetch(u.href);if(!res.ok)throw new Error('Não foi possível consultar o documento.');blob=await res.blob();}
  }
  if(!blob)throw new Error('Documento de referência não disponível.');P.download(blob,(p.certNumero||p.nome||'certificado-padrao')+'.pdf');
 }
 async function openHistory(){
  if(navigator.onLine===false)throw new Error('O histórico completo exige internet.');
  const records=await R.history(S.entry.record.id);dialog('<h2>Histórico do certificado</h2>'+records.map(x=>`<details class="cert-section"><summary>${e(x.event)} · ${e(x.actorName||x.actorEmail)} · ${new Date(x.createdAtISO).toLocaleString('pt-BR')}</summary><div style="padding:15px"><p>${e(D.STATUS[x.beforeStatus]||'Novo')} → ${e(D.STATUS[x.afterStatus])} · revisão ${x.revision}</p><pre style="white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px">${e(JSON.stringify({antes:x.beforeData,depois:x.afterData,visibilidade:x.afterVisible,notas:x.internalNotes},null,2))}</pre></div></details>`).join('')+button('close-dialog','Fechar'));
 }
 const actions={
  new:()=>newService(page()==='padroes'?'PADRAO':'EQUIPAMENTO'),
  open:b=>editor(b.dataset.id),
  back:async()=>{clearTimeout(S.autosave);if(S.dirty&&S.entry.record.status==='RASCUNHO')await saveDraft(false);else if(S.dirty&&!confirm('Sair sem salvar as alterações da revisão?'))return;S.entry=null;S.dirty=false;await render();},
  tab:async b=>{S.tab=b.dataset.tab;S.entry=null;await render();},
  prepare:async()=>{const prepared=await R.prepare(message=>{$('cert-connection').textContent=message});await render();toast('Aparelho preparado.'+(prepared.unavailable?' '+prepared.unavailable+' documento(s) de referência não ficaram disponíveis offline.':''));},
  sync:async()=>{await R.sync();if(navigator.onLine!==false)await R.refresh();await render();toast(navigator.onLine===false?'Sem internet. Os registros continuam neste aparelho.':'Sincronização conferida.');},
  save:()=>saveDraft(),
  ready:async()=>{clearTimeout(S.autosave);const record=collect(),errors=D.validate(record);if(errors.length)throw new Error('Preencha: '+errors.join(', '));if(!confirm('Concluir este serviço e encaminhar para revisão interna?'))return;S.entry=await R.saveLocal(record,'ready');S.dirty=false;if(navigator.onLine!==false)await R.sync();await render();toast('Serviço concluído. O número da etiqueta foi preservado.');},
  review:async()=>{const record=collect();await R.transition(record.id,'review',{data:record.data,visible:record.visible,internalNotes:record.internalNotes,titulo:record.titulo,dataEmissao:record.dataEmissao,issuer:record.issuer,documentRevision:record.documentRevision||'00'});S.dirty=false;await render();toast('Revisão salva.');},
  approve:async()=>{const record=collect(),warnings=D.warnings(record);if(!confirm((warnings.length?'Confira antes de aprovar:\n'+warnings.join('\n')+'\n\n':'')+'Aprovar os dados e o conteúdo visível para emissão?'))return;const patch=D.can(w.userProfile,'revisar',record.type)?{data:record.data,visible:record.visible,internalNotes:record.internalNotes,titulo:record.titulo,dataEmissao:record.dataEmissao,issuer:record.issuer,documentRevision:record.documentRevision||'00'}:{};await R.transition(record.id,'approve',patch);S.dirty=false;await render();},
  return:async()=>{if(!confirm('Devolver o serviço para preenchimento do técnico?'))return;await R.transition(S.entry.record.id,'return',{internalNotes:$('f-internalNotes')?.value||''});S.dirty=false;await render();},
  issue,
  download:downloadOfficial,
  sent:async()=>{const via=prompt('Confirme o envio realizado ao cliente. Canal ou observação (opcional):','E-mail');if(via===null)return;await R.transition(S.entry.record.id,'sent',{sentVia:via});await render();},
  bill:async()=>{if(!confirm('Liberar este serviço para faturamento?'))return;await R.transition(S.entry.record.id,'bill');await render();toast('Setor de faturamento avisado.');},
  cancel:async()=>{if(!confirm('Cancelar este certificado? O número continuará reservado no histórico.'))return;await R.transition(S.entry.record.id,'cancel');S.dirty=false;await render();},
  another:async()=>{if(S.dirty&&S.entry.record.status==='RASCUNHO')await saveDraft(false);const r=S.entry.record;await newService(r.type,{clienteId:r.data.clienteId,osId:r.data.osId});},
  copy:async()=>{try{await navigator.clipboard.writeText(S.entry.record.numero);toast('Número copiado.');}catch(_){prompt('Copie este número para a etiqueta:',S.entry.record.numero);}},
  label:()=>{const r=S.entry.record;const box=document.createElement('div');box.className='cert-label-print';box.innerHTML=`<b>${e(r.numero)}</b><br>${e(r.data.equipamento||'')}<br>Série: ${e(r.data.numeroSerie||'')}<br>${e(r.data.dataServico||'')}`;root().appendChild(box);window.print();box.remove();},
  'add-ref':()=>{const p=S.padroes.find(x=>x.id===$('cert-ref-select').value);if(!p)throw new Error('Selecione um padrão.');const rec=collect();S.refs=rec.data.padroes;S.entry.record.data.resultados=rec.data.resultados;S.refs.push(refSnapshot(p));renderRefs();markDirty();},
  'manual-ref':()=>{const rec=collect();S.refs=rec.data.padroes;S.entry.record.data.resultados=rec.data.resultados;S.refs.push({id:'manual:'+crypto.randomUUID(),manual:true,nome:'',material:'',diametro:'',marca:'',numeroSerie:'',certNumero:'',certData:'',validade:''});renderRefs();markDirty();},
  'remove-ref':b=>{const rec=collect(),i=Number(b.dataset.index);S.refs=rec.data.padroes;S.refs.splice(i,1);rec.data.resultados.splice(i,1);S.entry.record.data.resultados=rec.data.resultados;renderRefs();markDirty();},
  'ref-document':b=>documentReference(collect().data.padroes[Number(b.dataset.index)]),
  'pattern-document':b=>documentReference(S.padroes.find(p=>p.id===b.dataset.id)),
  'visible-all':()=>{root().querySelectorAll('[data-visible]').forEach(i=>i.checked=true);markDirty();},
  'visible-none':()=>{root().querySelectorAll('[data-visible]').forEach(i=>i.checked=false);markDirty();},
  preview,
  'new-pattern':()=>patternDialog(),
  'edit-pattern':b=>patternDialog(b.dataset.id),
  'cert-pattern':b=>{const p=S.padroes.find(p=>p.id===b.dataset.id);return newService('PADRAO',{clienteId:p.clienteId,padraoId:p.id});},
  'save-pattern':savePattern,
  'close-dialog':()=>{$('cert-dialog')?.remove();},
  'save-config':saveConfig,
  history:openHistory,
  backup:async()=>P.download(new Blob([JSON.stringify(await R.backup(),null,2)],{type:'application/json'}),'cij-certificacao-copia-local-'+D.today()+'.json'),
  resolve:async()=>{const snap=await (w.fsGetDocFromServer||w.fsGetDoc)(R.doc('certificacoes',S.entry.record.id));if(!snap.exists())throw new Error('Não existe uma versão deste registro no servidor. Exporte a cópia local e solicite conferência do número.');const remote=snap.data();dialog(`<h2>Conferir divergência</h2><p class="cert-hint">A cópia local permanece preservada. Exporte antes de adotar a versão do servidor.</p><pre style="white-space:pre-wrap;font-size:12px">${e(JSON.stringify({local:S.entry.record.data,servidor:remote.data},null,2))}</pre>${button('backup','Exportar cópia local')}${button('adopt','Adotar versão do servidor')}${button('close-dialog','Fechar')}`);},
  adopt:async()=>{if(!confirm('Adotar a versão do servidor? A cópia local divergente ficará preservada no backup deste aparelho.'))return;await R.adoptServer(S.entry.record.id);await render();}
 };
 root().addEventListener('click',event=>{const b=event.target.closest('[data-action]');if(!b||b.disabled)return;event.preventDefault();if(actions[b.dataset.action])run(()=>actions[b.dataset.action](b));});
 root().addEventListener('input',event=>{if(['cert-search','cert-status','cert-from','cert-to'].includes(event.target.id))renderRows();else if(event.target.id==='cert-bank-search')renderBankRows();else if(event.target.id==='cert-alert-search')renderAlertRows();else if(event.target.closest('#cert-form')||event.target.closest('[data-visible]')||['f-titulo','f-dataEmissao','f-documentRevision','f-internalNotes'].includes(event.target.id))markDirty();});
 root().addEventListener('change',event=>{
  if(event.target.id==='f-clienteId'){fillClient();markDirty();}else if(event.target.id==='f-osId'){const d=collect().data;if($('f-equipamentoId'))$('f-equipamentoId').innerHTML=equipmentOptions(d).map(([v,n])=>`<option value="${e(v)}" ${v===d.equipamentoId?'selected':''}>${e(n)}</option>`).join('');markDirty();}else if(event.target.id==='f-equipamentoId'){fillEquipment();markDirty();}else if(event.target.id==='f-padraoAlvoId'){fillSubjectPattern();markDirty();}else if(event.target.id==='cert-status'||event.target.id==='cert-from'||event.target.id==='cert-to')renderRows();else if(event.target.id==='cert-alert-sector')renderAlertRows();else if(event.target.closest('#cert-form')||event.target.matches('[data-visible]'))markDirty();
 });
 w.addEventListener('cert-repo-changed',async()=>{if(!S.ready)return;await reload();await connection();if(!S.entry){if(S.tab==='certificados')renderRows();else if(S.tab==='banco'&&$('cert-bank-list'))renderBankRows();else if(S.tab==='alertas'&&$('cert-alert-list'))renderAlertRows();}else if(!S.dirty){const latest=await R.entry(S.entry.record.id);if(latest){const changed=latest.record.status!==S.entry.record.status;S.entry=latest;if(changed&&!S.busy)await editor(latest.record.id);else if($('cert-save-status'))$('cert-save-status').textContent=latest.dirty?'Salvo no aparelho; aguardando sincronização.':'Registro sincronizado.';}}});
 w.addEventListener('online',()=>{if(S.ready&&!S.busy)run(async()=>{await R.sync();await R.refresh();await reload();await connection();if(!S.entry)renderTab();});});w.addEventListener('offline',connection);
 w.addEventListener('beforeunload',event=>{if(S.dirty){event.preventDefault();event.returnValue='';}});
 w.addEventListener('portal-session-ended',()=>{S.unsubscribe?.();clearInterval(S.timer);clearTimeout(S.autosave);S.ready=false;S.entry=null;root().innerHTML='<div class="cert-empty">Sessão encerrada.</div>';});
 w.initModule=async function(){
  if(S.ready)return;S.tab=page()==='padroes'?'banco':page()==='alertas'?'alertas':'certificados';
  try{await reload();root().innerHTML=header()+tabs()+'<div id="cert-body"></div>';await connection();renderTab();
   if(navigator.onLine!==false){const prepared=await R.get('meta',R.key('prepared'));if(!prepared)await R.prepare(msg=>{$('cert-connection').textContent=msg;});else await R.refresh();}
   S.ready=true;await render();const params=new URLSearchParams(location.search),open=params.get('cert');
   if(open)await editor(open);else if(params.get('nova')==='1')await newService(page()==='padroes'?'PADRAO':'EQUIPAMENTO',{clienteId:params.get('clienteId')||'',osId:params.get('osId')||'',equipamentoId:params.get('equipamentoId')||'',equipamentoOSId:params.get('equipamentoOSId')||''});
   S.timer=setInterval(()=>{if(S.ready&&w.currentUser&&navigator.onLine!==false&&!S.busy)R.sync().catch(console.warn);},20000);
   S.unsubscribe=R.listen(err=>console.warn('[Certificação] atualização ao vivo',err));
  }catch(err){S.ready=true;console.warn('[Certificação] preparação',err);await render();toast(err.message||'Não foi possível atualizar. Os dados locais foram preservados.');}
 };
 w.CertUI={state:S,actions,collect,render,editor,reload,newService};
})(window);
