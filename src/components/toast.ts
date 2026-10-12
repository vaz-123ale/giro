/** Confirmação bem visível (aparece embaixo da tela por alguns segundos). */
export function toast(message:string){
 if(typeof document==='undefined')return;
 document.querySelectorAll('.giro-toast').forEach(t=>t.remove());
 const el=document.createElement('div');el.className='giro-toast';el.setAttribute('role','status');
 el.innerHTML='<span aria-hidden="true">✓</span>';el.append(message);document.body.append(el);
 setTimeout(()=>el.remove(),3800);
}
