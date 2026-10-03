export type ReferenceIconName='income'|'outflow'|'receive'|'wallet'|'agreement'|'team'|'supplier'|'notification';
/** Original reference sheet, displayed through CSS viewports. No raster edits or remote assets. */
export function ReferenceIcon({name,className=''}:{name:ReferenceIconName;className?:string}){
 return <span className={`reference-icon reference-${name} ${className}`} aria-hidden="true"/>;
}
export function ReferenceNavigation({name}:{name:'inicio'|'receber'|'compromissos'|'equipe'}){return <span className={`reference-navigation navigation-${name}`} aria-hidden="true"/>;}
