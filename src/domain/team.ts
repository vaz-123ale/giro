import type {State} from './models.ts';
import {saleDistribution} from './finance.ts';
export function memberSummary(state:State,memberId:string){
 const member=state.members.find(m=>m.id===memberId);
 const belongs=(id:string,name:string)=>id===memberId||(!state.members.some(m=>m.id===id)&&name===member?.name);
 const sales=state.sales.filter(s=>!s.demo&&(s.participants?.some(p=>p.memberId===memberId)||s.commissions?.some(c=>belongs(c.memberId,c.name))||(!s.commissions&&s.participant===member?.name)));
 const rows=sales.map(s=>({sale:s,commission:saleDistribution(s).filter(e=>e.kind==='commission'&&belongs(e.recipientId,e.recipient)).reduce((a,e)=>a+e.amount,0)}));
 const percentGenerated=rows.reduce((a,r)=>a+(r.sale.commissions?.find(c=>belongs(c.memberId,c.name))?.fixedAmount!==undefined?0:r.commission),0);const fixedGenerated=rows.reduce((a,r)=>a+(r.sale.commissions?.find(c=>belongs(c.memberId,c.name))?.fixedAmount!==undefined?r.commission:0),0);const wages=(state.dailyWages??[]).filter(w=>w.memberId===memberId);const dailyGenerated=wages.reduce((a,w)=>a+w.amount,0);const generated=rows.reduce((a,r)=>a+r.commission,0);
 const paid=wages.reduce((a,w)=>a+w.paid,0)+(state.cashPayments??[]).filter(p=>p.kind==='commission'&&p.recipientId===memberId).reduce((a,p)=>a+p.amount,0);
 return {count:sales.length,volume:sales.reduce((a,s)=>a+s.amount,0),commission:generated,percentGenerated,fixedGenerated,dailyGenerated,generated:generated+dailyGenerated,paid,receivable:generated+dailyGenerated-paid,pendingSales:sales.filter(s=>!s.paidAt).length,rows};
}
