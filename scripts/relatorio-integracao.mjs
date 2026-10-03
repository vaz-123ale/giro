// Relatório de prontidão para integração. Lê o banco local SOMENTE PARA LEITURA e descreve o que,
// no futuro e com autorização, iria para a infraestrutura pública. Nada é enviado.
// Uso: npm run relatorio:integracao   (gera auditoria/PRONTIDAO_INTEGRACAO.md)
import {DatabaseSync} from 'node:sqlite';
import {writeFileSync,existsSync} from 'node:fs';
import {integrationPoints,ledgerSnapshot,attestationPayloads,localOnlyFields} from '../src/domain/integration.ts';

if(!existsSync('data/giro.sqlite')){console.log('Banco local não encontrado.');process.exit(0);}
const db=new DatabaseSync('data/giro.sqlite',{readOnly:true});const row=db.prepare('SELECT payload FROM local_state WHERE id=1').get();db.close();
const state=JSON.parse(row.payload);
const ledger=await ledgerSnapshot(state),attest=await attestationPayloads(state);
const leaked=localOnlyFields.filter(f=>JSON.stringify([ledger,attest]).includes(`"${f}"`));
const names=[...new Set(state.commitments.map(c=>c.supplier))].filter(n=>JSON.stringify([ledger,attest]).includes(n));
const brl=v=>(v/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const md=[`# Prontidão para integração — ${new Date().toLocaleString('pt-BR')}`,'',
'Situação: **tudo local**. Este relatório só descreve; nada foi enviado. Cada integração exige autorização explícita.','',
'## Pontos de integração','','| Área | Hoje (local) | Módulo | Depois (com autorização) | Pré-requisito |','|---|---|---|---|---|',
...integrationPoints.map(p=>`| ${p.title} | ${p.today} | \`${p.module}\` | ${p.future} | ${p.authorization} |`),'',
'## O que iria para a rede (prévia calculada dos dados atuais)','',
`- Acordos que teriam conta própria no programa: **${ledger.length}** (${ledger.filter(l=>l.status==='active').length} ativos, ${ledger.filter(l=>l.status==='completed').length} concluídos).`,
`- Comprovantes de conclusão que seriam atestados: **${attest.length}** (${attest.filter(a=>a.onTime).length} no prazo).`,
`- Campos pessoais encontrados nesses dados: **${leaked.length+names.length===0?'nenhum ✅':[...leaked,...names].join(', ')+' ❌'}**.`,'',
'Exemplo de conta de acordo (chave é hash; sem nome):','','```json',JSON.stringify(ledger[0]??{},null,1),'```','',
'Exemplo de comprovante a atestar:','','```json',JSON.stringify(attest[0]??{},null,1),'```','',
'## Permanece só neste computador','',`${localOnlyFields.map(f=>'`'+f+'`').join(', ')}, telefones, observações, caixa físico, equipe e histórico detalhado.`,'',
`Total ainda em aberto nos acordos ativos: ${brl(ledger.filter(l=>l.status==='active').reduce((a,l)=>a+l.remaining,0))}.`].join('\n');
writeFileSync('auditoria/PRONTIDAO_INTEGRACAO.md',md+'\n');console.log('Gerado auditoria/PRONTIDAO_INTEGRACAO.md');
