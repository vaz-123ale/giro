import {BarChart3,Users,ShieldCheck,Landmark,Target,FileText,Filter,Clock3} from 'lucide-react';
/** Mapa navegável das áreas do GIRO, exibido na aba principal de Receber. Cada cartão leva à área descrita. */
const areas=[
 {route:'organizar/resumo',title:'Organizar',text:'A aba Resumo é a última da seção.',icon:BarChart3,tone:'green'},
 {route:'compromissos',title:'Compromissos',text:'Separado em Fornecedores e Colaboradores.',icon:Users,tone:'purple'},
 {route:'confianca',title:'Confiança',text:'Inclui Fornecedores e Trabalhadores.',icon:ShieldCheck,tone:'blue'},
 {route:'organizar/contas',title:'Contas',text:'Inclui Pagar com saldo em conta.',icon:Landmark,tone:'green'},
 {route:'organizar/metas',title:'Metas',text:'Permite adicionar valor manualmente.',icon:Target,tone:'red'},
 {route:'mais/consultar',title:'Outros',text:'Permite consultar o ID e pedir mudança em compromisso.',icon:FileText,tone:'gray'},
 {route:'compromissos',title:'Filtros de compromissos',text:'Por data e status: aceitos, recusados e concluídos.',icon:Filter,tone:'blue'},
 {route:'compromissos',title:'Pedidos recusados',text:'Entram no histórico com o resumo da proposta.',icon:Clock3,tone:'purple'},
] as const;
export function StructureOverview({go,onHide}:{go:(route:string)=>void;onHide?:()=>void}){
 return <section className="panel structure-overview" aria-labelledby="structure-title"><div className="section-title"><h2 id="structure-title">Estrutura atualizada</h2>{onHide&&<button className="text-button structure-hide" onClick={onHide}>Ocultar<span className="sr-only"> esta seção (continua em Mais)</span></button>}</div><p className="muted">Veja como o GIRO está organizado para facilitar sua rotina.</p><ul className="structure-grid">{areas.map(a=><li key={a.title}><button className="structure-card" onClick={()=>go(a.route)}><span className={`structure-icon tone-${a.tone}`} aria-hidden="true"><a.icon size={26} strokeWidth={2}/></span><span className="structure-copy"><strong>{a.title}</strong><small>{a.text}</small></span></button></li>)}</ul></section>;
}
