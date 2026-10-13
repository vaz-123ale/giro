// Cenário exclusivamente local para vídeo: fixtures fictícias, sem dinheiro ou rede real.
// Nunca recebe GIRO_DATA_DIR: cada execução cria sua própria pasta isolada
// (ou recria GIRO_GRAVACAO_DIR, usado só por scripts/nuvem.mjs na demonstração pública).
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID,randomBytes} from 'node:crypto';
import {People} from '../../server/people.ts';
import {setPassword} from '../../server/auth.ts';
import {sendInvitation,decideInvitation,readNotification} from '../../server/invitation-service.ts';
import {notificationFeed} from '../../src/domain/notifications.ts';
import {createSale} from '../../server/financial-service.ts';
import {createPlan} from '../../server/planning-service.ts';

const dir=resolve(process.env.GIRO_GRAVACAO_DIR??`apresentacao/dados-demo/gravacao-${Date.now()}`);
if(process.env.GIRO_GRAVACAO_DIR)rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:300});
mkdirSync(dir,{recursive:true});
const db=new DatabaseSync(`${dir}/giro.sqlite`);
db.exec('CREATE TABLE local_state (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL)');
const s={schemaVersion:4,demo:false,sales:[],commitments:[],plans:[],members:[],contacts:[],shifts:[],paymentRequests:[]};
const people=new People(db),senha='giro-demo-2026';
people.setBusiness({name:'Barraca da Maria · demonstração'});
const account=(name,login,role,extra={})=>people.create(s,{name,login,role,...extra},{password:senha}).person;
const joao=account('João','joao','fornecedor');
const lia=account('Lia Santos','lia','ajudante',{commissionBps:1000});
people.changePassword(joao.id,senha,senha);people.changePassword(lia.id,senha,senha);
const member=s.members.find(m=>m.id===lia.memberId);member.schedule=[2,4,6];member.workLocation='Feira Central · corredor 2, barraca 14 (local fictício)';
const day=n=>new Date(Date.now()-3*3600000+n*864e5).toISOString().slice(0,10);
const propose=(p,amount,rate,date,accepted=true)=>{
 const i=sendInvitation(s,{contactId:p.contactId,debtAmount:amount,rateBps:rate,priority:1,due:date,acknowledged:true});
 const c=s.commitments.find(c=>c.id===i.commitmentId);
 if(accepted)decideInvitation(s,{token:i.token,decision:'accept',acknowledged:true});
 return c;
};
// 24 dias de atacado, espalhados por quatro meses: João recebe 20% e Lia 10% de cada venda, e cada acordo
// é quitado pela própria venda. Comissões, compras e quitações são calculadas pelos serviços do produto;
// não se inventam selos da blockchain. Os textos fictícios têm tradução em src/i18n/en3.ts.
for(let n=0;n<24;n++){
 const date=day(-120+n*5),startedAt=`${date}T09:00:00.000Z`,endedAt=`${date}T15:00:00.000Z`,amount=150000+(n*7%9)*20000;
 s.shifts.push({id:randomUUID(),memberId:member.id,name:member.name,rateBps:1000,startedAt,endedAt,compensation:'commission',participationMode:'automatic'});
 const c=propose(joao,amount*0.2,2000,day(-115+n*5));c.createdAt=date;
 const w=propose(lia,amount*0.1,1000,day(-115+n*5));w.createdAt=date;
 for(const x of [c,w]){
  x.sellerAcceptedAt=date;x.supplierAcceptedAt=date;x.activatedAt=date;
  for(const e of x.timeline??[])e.at=`${date}T08:00:00.000Z`;
  const inv=s.invitations.find(i=>i.commitmentId===x.id);inv.createdAt=`${date}T08:00:00.000Z`;inv.decidedAt=inv.createdAt;inv.sellerAcknowledgedAt=inv.createdAt;inv.recipientAcknowledgedAt=inv.createdAt;
 }
 createSale(s,{amount,method:'digital',soldAt:date,soldTime:'09:00',paidAt:date});
}
// Compras de cliente da Lia no QR da barraca, com valores de varejo variados.
s.paymentRequests=[];
for(let n=0;n<24;n++){
 const date=day(-24+n),sale=createSale(s,{amount:1250+(n*37%23)*175,method:'digital',soldAt:date,soldTime:'09:00',paidAt:date});
 s.paymentRequests.push({id:randomUUID(),token:randomBytes(24).toString('hex'),requestId:randomUUID(),saleId:sale.id,createdAt:`${date}T12:00:00.000Z`,origin:'barraca',buyerId:lia.id});
}
// Acordos ativos (um vencido há dois dias, para os filtros) e propostas aguardando aceite. A soma das regras
// ativas e propostas (com a comissão de 10% da Lia) fica abaixo de 100% das vendas, como o produto exige.
for(let n=0;n<4;n++){propose(joao,60000+n*15000,[1000,800,600,500][n],day(n===0?-2:7+n*7));propose(lia,25000+n*5000,[300,300,200,200][n],day(n===0?-2:7+n*7));}
for(let n=0;n<4;n++){propose(joao,40000+n*10000,500,day(20+n*3),false);propose(lia,15000+n*5000,200,day(20+n*3),false);}
const nomes=['Ana Ribeiro','Pedro Alves','Carla Mendes','Bruno Costa','Rosa Lima','Davi Souza','Júlia Rocha','Marcos Dias','Beatriz Nunes','Rafael Gomes','Camila Freitas','Thiago Lopes','Fernanda Reis','Lucas Pinto','Patrícia Melo','Gabriel Martins','Sofia Cardoso','Mateus Barros','Larissa Teixeira','Diego Moreira','Aline Castro','Vitor Ramos','Helena Duarte','Caio Fernandes'];
const busca=['Experiência em atendimento e reposição','Disponível aos fins de semana','Já trabalhei com hortifrúti','Procuro turnos pela manhã'];
const funcoes=['Ajudante de banca','Repositor(a)','Atendente','Ajudante de carga'],feiras=['Feira Central','Feira da Vila','Mercado Municipal'];
const turnos=['Terça, 6h às 12h','Quinta, 6h às 12h','Sábado, 6h às 12h','Domingo, 7h às 13h'],tarefas=['Atendimento e reposição','Montagem da banca','Carga e descarga','Caixa e troco'];
const metas=['Viagem em família','Reserva de emergência','Reposição de estoque','Balança nova','Toldo da banca','Curso de gestão','Embalagens','Manutenção da banca','Material escolar','Carrinho de feira','Reforma da cozinha','Presente de aniversário','Celular novo','Uniformes','Freezer novo','Fundo de férias'];
const contas=['Aluguel da banca','Conta de energia','Taxa da feira','Internet','Conta de água','Gás','Transporte','Contador','Seguro da banca','Mensalidade da associação'];
let meta=0,conta=0;
for(let n=0;n<24;n++){
 const person=account(nomes[n],`colega${n+1}`,n%3===0?'fornecedor':'cliente');
 people.setJob(person.id,{seeking:true,note:busca[n%4],contact:'Contato fictício para demonstração'});
 const owner=n%2?joao.id:'dona';
 const v=people.createVaga(owner,n%2?'João · Hortifrúti':'Barraca da Maria',{title:`${funcoes[n%4]} · ${feiras[n%3]}`,note:`${turnos[n%4]} · ${tarefas[(n+1)%4]} · Comissão de ${8+n%5}% · Setor ${n%4+1}, corredor ${n%3+1}`,minMonths:n%4,minDays:n%2?10:0});
 people.toggleInterest(v,person.id);if(n<8)people.toggleInterest(v,lia.id);
 const account_=n%3===0,name=account_?contas[conta++]:metas[meta++],target=account_?8000+(n*13%7)*4000:n===0?300000:n===1?200000:30000+(n*17%11)*15000;
 createPlan(s,{kind:account_?'account':'goal',name,target,amount:account_?0:Math.round(target*(0.2+(n*7%5)/10)/100)*100,mode:'manual',rateBps:0,priority:n+1,targetDate:day(10+n*3)});
}
people.setJob(lia.id,{seeking:true,note:'Experiência em atendimento e reposição. Busco turnos extras às quartas e sextas.',contact:'Contato fictício para demonstração'});
// Turno atual e caixa com saldo fictício; nenhuma carteira é abastecida.
member.active=true;s.shifts.push({id:randomUUID(),memberId:member.id,name:member.name,rateBps:1000,startedAt:new Date().toISOString(),compensation:'commission'});
s.cashSessions=[{id:randomUUID(),date:day(0),opening:35000,openedAt:new Date().toISOString(),responsible:'Maria'}];
s.cashMovements=[{id:randomUUID(),type:'OPENING',amount:35000,at:new Date().toISOString(),origin:'opening',sessionId:s.cashSessions[0].id,description:'Abertura fictícia para demonstração'}];
for(const [amount,time] of [[8450,'08:12'],[12300,'09:05'],[6780,'09:40'],[15500,'10:22'],[9900,'11:03']])createSale(s,{amount,method:'digital',soldAt:day(0),soldTime:time,paidAt:day(0)});
for(const note of notificationFeed(s).slice(3))readNotification(s,{id:note.id});
for(const note of (s.notifications??[]).slice(3))note.readAt??=new Date().toISOString();
db.prepare('INSERT INTO local_state VALUES(1,?)').run(JSON.stringify(s));
setPassword(dir,senha);
const invite=people.createInvite({role:'fornecedor',maxUses:0});
writeFileSync(`${dir}/demo.json`,JSON.stringify({usuario:'dona',senha,convite:invite.code,contas:[{tipo:'barraca',usuario:'dona',senha},{tipo:'fornecedor',usuario:'joao',senha},{tipo:'equipe',usuario:'lia',senha}]}));
db.close();
writeFileSync('apresentacao/dados-demo/gravacao-atual.json',JSON.stringify({dir,port:3060}));
console.log(JSON.stringify({dir,vendas:s.sales.length,acordos:s.commitments.length,vagas:24,compras:24,turnos:25,planos:s.plans.length}));
