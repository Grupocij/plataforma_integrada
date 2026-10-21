(()=>{'use strict';
const BASE=['artifacts','plataforma-cij','public','data'];
const $=id=>document.getElementById(id);
let clientes=[],loaded=false;
function status(message){$('firebase-status').textContent=message;}
function dbCollection(name){return window.fsCollection(window.AppDB,...BASE,name)}
function currentValues(){const form=$('f'),fd=new FormData(form),data={};for(const [k,v] of fd.entries()){if(k==='mensagem')continue;data[k]=String(v)};data.mensagem=[...form.querySelectorAll('input[name="mensagem"]:checked')].map(x=>x.value);return data;}
async function init(){if(loaded||!window.currentUser||!window.AppDB)return;loaded=true;
 const user=window.currentUser;
 try{const snap=await window.fsGetDocs(dbCollection('cadastros_clientes'));clientes=[];
 snap.forEach(d=>{const c=d.data();if(c.is_deleted===true||c.ativo===false)return;const name=String(c.fantasia||c.razao_social||c.razaoSocial||'').trim();if(name)clientes.push({id:d.id,name})});
 clientes.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));const dl=$('clientes-cij');for(const c of clientes){const o=document.createElement('option');o.value=c.name;dl.appendChild(o)};
 status('Cadastro de clientes carregado. As fichas podem ser salvas somente se as regras atuais do Firebase autorizarem.');
 }catch(e){status('Cadastro de clientes indisponível para este perfil. Você pode preencher manualmente. '+(e.code||''));}
 const seller=String(window.nomeUsuarioLogado||'').toLowerCase();const sel=$('f').elements.namedItem('vendedor');
 for(const o of sel.options){if(o.value&&seller.includes(o.value.toLowerCase())){sel.value=o.value;break}}
 }
window.initModule=()=>{init().catch(e=>status('Falha ao iniciar: '+e.message))};
$('salvar-cloud').addEventListener('click',async()=>{
 if(!$('f').reportValidity())return;
 if(!window.currentUser||!window.AppDB){status('É necessário entrar na Plataforma CIJ para salvar.');return}
 const btn=$('salvar-cloud');btn.disabled=true;btn.textContent='Salvando...';
 try{const v=currentValues(),selected=clientes.find(c=>c.name===v.cliente);
 const id=crypto.randomUUID(),now=new Date().toISOString();const data={...v,clienteId:selected?.id||null,tipo:'LASER',status:'AGUARDANDO_ANALISE',createdAtISO:now,updatedAtISO:now,createdByUid:window.currentUser.uid,createdByEmail:String(window.currentUser.email||'').toLowerCase(),createdByName:window.nomeUsuarioLogado||'',id};
 await window.fsSetDoc(window.fsDoc(dbCollection('pre_vendas_tecnicas'),id),data);
 status('Ficha registrada na Plataforma CIJ, referência: '+id+'. Fotos não foram enviadas.');
 }catch(e){console.error('[PreVendaLaser]',e);status('Não foi possível salvar. A regra de segurança do Firestore pode precisar de autorização específica para pre_vendas_tecnicas. Erro: '+(e.code||e.message));}
 finally{btn.disabled=false;btn.textContent='Salvar na Plataforma CIJ'}
});
})();