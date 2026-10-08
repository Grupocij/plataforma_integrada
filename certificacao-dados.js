/* Grupo CIJ — Certificação 1.1.0. Dados, validação e transições. */
(function(w){
 'use strict';
 const STATUS={RASCUNHO:'Em preenchimento',PRONTO:'Pronto para revisão',EM_REVISAO:'Em revisão',APROVADO:'Aprovado para emissão',EMITIDO:'PDF emitido',ENVIADO:'Certificado enviado',LIBERADO_FATURAR:'Pode faturar',CANCELADO:'Cancelado'};
 const PERMS=['preencher','revisar','aprovar','emitir','enviar','faturar','gerenciar_padroes','configurar'];
 const FIELDS=[
  ['clienteNome','Cliente','Cliente'],['cnpj','CNPJ','Cliente'],['unidade','Unidade','Cliente'],['endereco','Endereço','Cliente'],['cidadeUF','Cidade / UF','Cliente'],['contato','Contato','Cliente'],['osNumero','Número da OS','Atendimento'],['dataServico','Data do serviço','Atendimento'],['ambiente','Laboratório / Campo','Atendimento'],['localServico','Local do serviço','Atendimento'],['executanteNome','Executante','Atendimento'],['acompanhante','Acompanhado por','Atendimento'],
  ['equipamento','Equipamento / padrão','Identificação'],['marca','Marca','Identificação'],['modelo','Modelo','Identificação'],['numeroSerie','Número de série','Identificação'],['tag','TAG','Identificação'],['tipo','Tipo','Identificação'],
  ['abertura','Abertura (mm)','Configuração'],['fase','Fase / frequência / potência','Configuração'],['sensibilidade','Sensibilidade','Configuração'],['receita','Receita / programa','Configuração'],['produto','Produto','Linha'],['temperaturaProduto','Temperatura do produto (°C)','Linha'],['rejeicao','Sistema de rejeição','Linha'],['velocidade','Velocidade da linha','Linha'],['posicaoPadrao','Posição do corpo de prova','Linha'],['condicaoProduto','Condição: com / sem produto','Linha'],
  ['material','Material','Padrão de teste'],['diametroNominal','Diâmetro nominal (mm)','Padrão de teste'],['formato','Formato / suporte','Padrão de teste'],['leitura1','Leitura 1 (mm)','Medição'],['leitura2','Leitura 2 (mm)','Medição'],['leitura3','Leitura 3 (mm)','Medição'],['media','Média (mm)','Medição'],['desvio','Desvio do nominal (mm)','Medição'],['incerteza','Incerteza expandida (mm)','Medição'],['fatorK','Fator de abrangência k','Medição'],['confianca','Nível de confiança (%)','Medição'],
  ['temperaturaAmbiente','Temperatura ambiente (°C)','Condições'],['umidade','Umidade relativa (%)','Condições'],['procedimento','Procedimento / método','Procedimento'],['revisaoProcedimento','Revisão do procedimento','Procedimento'],['criterio','Critério de aceitação','Procedimento'],['padroes','Padrões de referência utilizados','Referências'],['ref_nome','Nome das referências','Referências'],['ref_material','Material das referências','Referências'],['ref_diametro','Diâmetro das referências','Referências'],['ref_numeroSerie','Série das referências','Referências'],['ref_certNumero','Nº de certificado das referências','Referências'],['ref_validade','Validade das referências','Referências'],['ref_certData','Emissão das referências','Referências'],['ref_emissor','Emissor das referências','Referências'],['resultados','Resultados dos três ciclos','Resultados'],['resultado_sinal','Sinal nos ciclos','Resultados'],['resultado_rejeicao','Rejeição nos ciclos','Resultados'],['resultado_final','Resultado individual do padrão','Resultados'],['conclusao','Conclusão técnica','Conclusão'],['observacoes','Observações','Conclusão'],['proximaAvaliacao','Próxima avaliação acordada','Conclusão'],['responsavelTecnico','Responsável técnico','Responsáveis'],['emissorNome','Autorização da emissão','Responsáveis'],['assinaturas','Espaços para assinaturas','Responsáveis']
 ];
 const ONLY_E=new Set(['abertura','fase','sensibilidade','receita','posicaoPadrao','condicaoProduto','produto','temperaturaProduto','rejeicao','velocidade','resultados','resultado_sinal','resultado_rejeicao','resultado_final']);
 const ONLY_P=new Set(['material','diametroNominal','formato','leitura1','leitura2','leitura3','media','desvio','incerteza','fatorK','confianca']);
 const clone=x=>JSON.parse(JSON.stringify(x));
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const text=v=>String(v??'').trim();
 const number=v=>{if(text(v)==='')return null;const n=Number(text(v).replace(',','.'));return Number.isFinite(n)?n:null;};
 function today(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),v=Object.fromEntries(parts.map(p=>[p.type,p.value]));return v.year+'-'+v.month+'-'+v.day;}
 function formatDate(v){const s=text(v);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4):s;}
 function can(profile,permission,type='EQUIPAMENTO'){
  if(!profile)return false;if(profile.perfil==='Master')return true;
  const module=type==='PADRAO'?'padroes_teste.html':'certificacao.html';
  return (profile.modulos||[]).includes(module)&&profile.permissoesCertificacao?.[permission]===true;
 }
 function fields(type){return FIELDS.filter(([id])=>type==='PADRAO'?!ONLY_E.has(id):!ONLY_P.has(id));}
 function defaults(type){return Object.fromEntries(fields(type).map(([id])=>[id,true]));}
 function readings(data){
  const values=['leitura1','leitura2','leitura3'].map(k=>number(data[k]));
  if(values.every(n=>n!==null)){const mean=values.reduce((a,b)=>a+b,0)/3;data.media=mean.toFixed(4);const nominal=number(data.diametroNominal);data.desvio=nominal===null?'':(mean-nominal).toFixed(4);}
  else{data.media='';data.desvio='';}
  return data;
 }
 function validate(record){
  const d=record.data||{},errors=[];
  if(!text(d.clienteNome)||!text(d.clienteId))errors.push('Cliente (selecione o cadastro)');
  for(const [k,label] of [['equipamento',record.type==='PADRAO'?'Padrão a certificar':'Equipamento'],['marca','Marca'],['numeroSerie','Número de série']])if(!text(d[k]))errors.push(label);
  if(!Array.isArray(d.padroes)||!d.padroes.length||d.padroes.some(p=>!text(p.nome)))errors.push('Padrões utilizados (selecione ou informe manualmente)');
  if((d.padroes||[]).length>50)errors.push('Use no máximo 50 referências por certificado');
  return errors;
 }
 function warnings(record){
  const d=record.data||{},list=[];
  (d.padroes||[]).forEach(p=>{if(p.validade&&p.validade<today())list.push('Padrão vencido: '+p.nome);if(!p.certNumero)list.push('Certificado de referência não informado: '+p.nome);if(p.manual)list.push('Referência informada manualmente: '+p.nome);});
  if(!d.executanteNome)list.push('Executante não informado.');
  if(!d.conclusao)list.push('Conclusão técnica não informada.');
  if(record.type==='PADRAO'&&!d.incerteza)list.push('Incerteza expandida não informada.');
  return list;
 }
 function deviceLabel(code){if(!Number.isSafeInteger(code)||code<1)throw new Error('Identificação de aparelho inválida.');let label='';while(code>0){code--;label=String.fromCharCode(65+code%26)+label;code=Math.floor(code/26);}return label;}
 function make(type,id,device,seq,user){
  const now=new Date().toISOString(),year=Number(today().slice(0,4)),prefix=type==='PADRAO'?'CP':'CE';
  const numero=prefix+'-'+String(year).slice(-2)+'-'+deviceLabel(device.code)+String(seq).padStart(3,'0');
  return {id,type,numero,numberFormat:2,documentRevision:'00',deviceId:device.id,deviceCode:device.code,sequence:seq,ownerUid:user.uid,ownerEmail:user.email||'',createdAtISO:now,updatedAtISO:now,updatedByUid:user.uid,updatedByEmail:user.email||'',revision:0,status:'RASCUNHO',data:{dataServico:today(),ambiente:'CAMPO',padroes:[],resultados:[]},visible:defaults(type),internalNotes:'',issuer:{nome:'Grupo CIJ Soluções Industriais',site:'www.grupocij.com.br'},titulo:type==='PADRAO'?'Certificado de Calibração de Padrão de Teste':'Certificado de Verificação de Desempenho',dataEmissao:today(),approvedByUid:'',approvedAtISO:'',pdf:null};
 }
 function actionPermission(action){return {save:'preencher',ready:'preencher',review:'revisar',approve:'aprovar',return:'revisar',issue:'emitir',sent:'enviar',bill:'faturar',cancel:'revisar'}[action];}
 function nextStatus(record,action,profile){
  const s=record.status;if(!can(profile,actionPermission(action),record.type))throw new Error('Você não tem permissão para esta ação.');
  if(action==='save'&&s==='RASCUNHO')return s;
  if(action==='ready'&&s==='RASCUNHO'){const e=validate(record);if(e.length)throw new Error('Preencha: '+e.join(', '));return 'PRONTO';}
  if(action==='review'&&['PRONTO','EM_REVISAO','APROVADO'].includes(s))return 'EM_REVISAO';
  if(action==='approve'&&['PRONTO','EM_REVISAO'].includes(s)){const e=validate(record);if(e.length)throw new Error('Preencha: '+e.join(', '));return 'APROVADO';}
  if(action==='return'&&['PRONTO','EM_REVISAO','APROVADO'].includes(s))return 'RASCUNHO';
  if(action==='issue'&&s==='APROVADO')return 'EMITIDO';
  if(action==='sent'&&s==='EMITIDO')return 'ENVIADO';
  if(action==='bill'&&s==='ENVIADO')return 'LIBERADO_FATURAR';
  if(action==='cancel'&&['RASCUNHO','PRONTO','EM_REVISAO','APROVADO'].includes(s))return 'CANCELADO';
  throw new Error('Esta ação não está disponível na etapa atual.');
 }
 function value(record,key){
  const d=record.data||{};if(key==='emissorNome')return record.approvedByName||text(d[key]);if(key==='ambiente')return d[key]==='LABORATORIO'?'Laboratório':d[key]==='CAMPO'?'Campo':text(d[key]);
  if(['dataServico','proximaAvaliacao'].includes(key))return formatDate(d[key]);
  if(key==='conclusao')return ({APROVADO:'Aprovado',APROVADO_COM_RESSALVA:'Aprovado com ressalva',REPROVADO:'Reprovado'})[d[key]]||text(d[key]);
  if(key==='padroes')return (d.padroes||[]).map(p=>[['ref_nome',p.nome],['ref_material',p.material],['ref_diametro',p.diametro?'Ø '+p.diametro+' mm':''],['ref_numeroSerie',p.numeroSerie?'SN '+p.numeroSerie:''],['ref_certNumero',p.certNumero?'Certificado '+p.certNumero:''],['ref_validade',p.validade?'Validade '+formatDate(p.validade):'']].filter(([k,v])=>record.visible?.[k]!==false&&v).map(([,v])=>v).join(' · ')).filter(Boolean);
  if(key==='resultados'){const sinal=record.visible?.resultado_sinal!==false,rejeicao=record.visible?.resultado_rejeicao!==false;if(!sinal&&!rejeicao)return [];return (d.resultados||[]).map(r=>[r.nome,...[1,2,3].map(n=>'Ciclo '+n+': '+[sinal?'sinal '+(r['sinal'+n]||'não informado'):'',rejeicao?'rejeição '+(r['rejeicao'+n]||'não informada'):''].filter(Boolean).join(', '))].join(' | '));}
  return text(d[key]);
 }
 function visibleRows(record){return fields(record.type).filter(([key])=>record.visible?.[key]!==false).map(([key,label,group])=>({key,label,group,value:value(record,key)})).filter(r=>Array.isArray(r.value)?r.value.length:text(r.value));}
 w.CertDados={STATUS,PERMS,FIELDS,clone,esc,text,number,today,formatDate,can,fields,defaults,readings,validate,warnings,make,deviceLabel,nextStatus,actionPermission,visibleRows,value};
})(window);
