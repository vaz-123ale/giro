/// <reference types="vite/client" />
/** Lê o texto de um PDF neste navegador (nada é enviado). Carregado só quando alguém escolhe um PDF. */
export async function pdfText(file:File){
 const pdfjs=await import('pdfjs-dist');
 pdfjs.GlobalWorkerOptions.workerSrc=(await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
 const doc=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise;
 const pages:string[]=[];
 for(let n=1;n<=Math.min(doc.numPages,30);n++){
  const {items}=await (await doc.getPage(n)).getTextContent();let line='';const lines:string[]=[];
  for(const i of items){if(!('str' in i))continue;line+=i.str;if(i.hasEOL){lines.push(line);line='';}else line+=' ';}
  if(line.trim())lines.push(line);pages.push(lines.map(l=>l.replace(/\s+/g,' ').trim()).filter(Boolean).join('\n'));
 }
 await doc.destroy();return pages.join('\n');
}
