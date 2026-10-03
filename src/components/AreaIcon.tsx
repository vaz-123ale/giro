import {Wallet,Target,Lightbulb,Plus,LayoutDashboard,Handshake,History,Users,ShieldCheck,Search,Bell,Settings,FileText,Accessibility,LayoutGrid} from 'lucide-react';
const originals:Record<string,string>={'':'receive',receber:'receive',vendas:'sales',pagamentos:'payments',pendentes:'pending',caixa:'cash'};
const symbols={contas:Wallet,metas:Target,sugestoes:Lightbulb,renegociar:Handshake,adicionar:Plus,resumo:LayoutDashboard,historico:History,consultar:Search,contatos:Users,equipe:Users,confianca:ShieldCheck,notificacoes:Bell,preferencias:Settings,acessibilidade:Accessibility,estrutura:LayoutGrid};
export function AreaIcon({name}:{name:string}){
 const key=name.split('/').at(-1)??name;
 if(key in originals)return <span aria-hidden="true" className={`area-icon original-icon original-${originals[key]}`}/>;
 const Icon=symbols[key as keyof typeof symbols]??FileText;
 return <Icon aria-hidden="true" className="area-icon" size={23} strokeWidth={1.9}/>;
}
