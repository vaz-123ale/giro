import type {ReactNode} from 'react';
import type {LucideIcon} from 'lucide-react';

/** Elementos visuais comuns aos apps de fornecedor e equipe/comprador. */
export function RoleHeading({icon:Icon,children,tone='green'}:{icon:LucideIcon;children:ReactNode;tone?:'green'|'amber'}){
 return <h2 className="role-section-heading"><span className={`role-section-icon ${tone}`} aria-hidden="true"><Icon size={30} strokeWidth={2.2}/></span><span>{children}</span></h2>;
}
export function RoleMetric({icon:Icon,label,value}:{icon:LucideIcon;label:string;value:ReactNode}){
 return <div className="role-metric"><dt><span className="role-metric-icon" aria-hidden="true"><Icon size={26} strokeWidth={2.2}/></span><span>{label}</span></dt><dd>{value}</dd></div>;
}
export function RoleEmpty({icon:Icon,children}:{icon:LucideIcon;children:ReactNode}){
 return <div className="role-empty"><span className="role-empty-icon" aria-hidden="true"><Icon size={48} strokeWidth={1.7}/></span><p>{children}</p></div>;
}
