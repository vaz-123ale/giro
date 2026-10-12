// Monta uma base de DEMONSTRAÇÃO fictícia (história do documento: Maria, fornecedor João, ajudante Pedro)
// em apresentacao/dados-demo, sobe a API local na porta 3019 e cadastra tudo pelas mesmas rotas do site.
// Os dados reais (data/giro.sqlite) não são tocados. Nada sai deste computador.
// Uso: node --experimental-strip-types apresentacao/ferramentas/montar-demo.mjs   (deixa o servidor rodando)
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';

const dir='apresentacao/dados-demo',port='3019',base=`http://127.0.0.1:${port}`;
try{await fetch(base+'/api/state');console.log('A demonstração já está rodando em '+base+'. Para recomeçar do zero, feche o processo node da porta '+port+' e rode de novo.');process.exit(0);}catch{}
rmSync(dir,{recursive:true,force:true});mkdirSync(dir,{recursive:true});
const db=new DatabaseSync(`${dir}/giro.sqlite`);db.exec('CREATE TABLE local_state (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL)');
db.prepare('INSERT INTO local_state VALUES(1,?)').run(JSON.stringify({schemaVersion:4,demo:false,sales:[],commitments:[],plans:[],members:[]}));db.close();

const api=spawn(process.execPath,['--experimental-strip-types','server/index.ts'],{env:{...process.env,GIRO_DATA_DIR:dir,GIRO_PORT:port},stdio:['ignore','pipe','inherit'],detached:true});
await new Promise(ok=>api.stdout.once('data',ok));
const post=async(path,body)=>{const r=await fetch(`${base}/api/${path}`,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(`${path}: ${d.error}`);return d;};
const get=async path=>(await fetch(`${base}/api/${path}`)).json();
const day=n=>{const d=new Date(Date.now()-3*3600000+n*86400000);return d.toISOString().slice(0,10);};

// Cadastros de pessoas
let s=await post('contacts',{name:'João',type:'supplier',note:'Fornecedor de hortifrúti'});const joao=s.contacts.at(-1);
s=await post('contacts',{name:'Distribuidora Sol',type:'supplier'});const sol=s.contacts.at(-1);
s=await post('contacts',{name:'Ana Embalagens',type:'supplier'});const ana=s.contacts.at(-1);
s=await post('members',{name:'Pedro',compensation:'commission',commissionBps:800,participationMode:'automatic'});const pedro=s.members.find(m=>m.name==='Pedro');
s=await post('members',{name:'Carla',compensation:'daily',dailyAmount:8000,commissionBps:0});const carla=s.members.find(m=>m.name==='Carla');
const today=new Date(day(0)+'T12:00:00Z').getUTCDay();
await post('members/schedule',{id:pedro.id,days:[1,2,3,4,5,6]});await post('members/schedule',{id:carla.id,days:[today,(today+3)%7]});

// Compromissos: João aceita 20% até quitar R$ 600; Sol aceita 50% até R$ 100; Ana ainda vai responder.
s=await post('invitations/send',{contactId:joao.id,debtAmount:60000,rateBps:2000,priority:1,due:day(7),acknowledged:true});const invJoao=s.invitations[0];
await post('invitations/decision',{token:invJoao.token,decision:'accept',acknowledged:true});
s=await post('invitations/send',{contactId:sol.id,debtAmount:10000,rateBps:5000,priority:2,due:day(3),acknowledged:true});
await post('invitations/decision',{token:s.invitations[0].token,decision:'accept',acknowledged:true});
s=await post('invitations/send',{contactId:ana.id,debtAmount:40000,rateBps:1000,priority:3,due:day(20),acknowledged:true});const invAna=s.invitations[0];

// Organização pessoal
await post('plans',{kind:'goal',name:'Reposição de estoque',target:50000,amount:0,mode:'automatic',rateBps:1000,priority:1,targetDate:day(14)});
await post('plans',{kind:'account',name:'Energia',target:18470,amount:0,category:'Contas fixas',recurrence:'monthly',priority:2,targetDate:day(11),mode:'manual',rateBps:0});
await post('plans',{kind:'goal',name:'Reserva do negócio',target:30000,amount:0,mode:'manual',priority:3,targetDate:day(30)});

// Pedro faz check-in pelo link e Maria confirma
s=await post('members/checkin-link',{id:pedro.id});const pedroToken=s.members.find(m=>m.id===pedro.id).checkinToken;
await post('checkin/request',{token:pedroToken,type:'start'});s=await get('state');await post('shift/decision',{id:s.shiftRequests[0].id,decision:'confirm'});
s=await post('members/checkin-link',{id:carla.id});const carlaToken=s.members.find(m=>m.id===carla.id).checkinToken;

// Dia de vendas
await post('cash/open',{opening:10000,responsible:'Maria'});
await post('sales/cash',{amount:35000,method:'cash',soldAt:day(0),paidAt:day(0)});
await post('sales',{amount:20000,method:'digital',soldAt:day(0),paidAt:day(0)});
await post('sales',{amount:15000,method:'digital',soldAt:day(0),paidAt:null});
await post('sales/cash',{amount:12000,method:'cash',soldAt:day(0),paidAt:day(0)});

// Pagamentos em dinheiro: Sol é quitada e confirma; João recebe parte e ainda vai confirmar
s=await get('state');const cSol=s.commitments.find(c=>c.supplier==='Distribuidora Sol'),cJoao=s.commitments.find(c=>c.supplier==='João');
const pend=id=>s.cashDestinations.filter(d=>d.recipientId===id).reduce((a,d)=>a+d.amount-d.paid,0);
s=await post('cash/pay',{kind:'supplier',recipientId:cSol.id,amount:pend(cSol.id),requestId:'demo-sol'});
let r=await post('receipts/request',{paymentId:s.cashPayments.at(-1).id});await post('receipts/decision',{token:r.receiptConfirmations[0].token,decision:'confirm'});
s=await get('state');s=await post('cash/pay',{kind:'supplier',recipientId:cJoao.id,amount:pend(cJoao.id),requestId:'demo-joao'});
r=await post('receipts/request',{paymentId:s.cashPayments.at(-1).id});const receiptJoao=r.receiptConfirmations.find(x=>x.recipient==='João').token;
await post('notifications/refresh',{});

writeFileSync('apresentacao/dados-demo/links.json',JSON.stringify({invitationAna:invAna.token,receiptJoao,pedroToken,carlaToken},null,1));
console.log(`Base de demonstração pronta em ${base} (pid ${api.pid}).`);
if(process.env.GIRO_DEMO_ENCERRAR==='sim'){process.kill(api.pid);process.exit(0);}
api.unref();process.exit(0);
