/**
 * Importação de documentos (texto colado, CSV ou TXT), processada só neste computador.
 * Identifica linhas com valor e vencimento. Nada é gravado: o resultado vai para revisão do usuário.
 */
export interface ImportedItem {id:string;name:string;amount:number;due:string;recurring:boolean;line:string}

// "R$ 600", "R$ 1.234,56", "184,70" ou "184.70".
const MONEY=/R\$\s*(\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d+(?:,\d{2})?)|(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})|(\d+\.\d{2})(?![\d/])/;
const DATE=/\b(\d{4})-(\d{2})-(\d{2})\b|\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/;

export function parseMoneyText(text:string):number|null{
 const m=text.match(MONEY);if(!m)return null;let v=m[1]??m[2]??m[3];
 v=m[3]?v:v.replace(/\./g,'').replace(',','.');const n=Math.round(Number(v)*100);return Number.isFinite(n)&&n>0?n:null;
}
export function parseDateText(text:string,reference:string):string|null{
 const m=text.match(DATE);if(!m)return null;
 let y:number,mo:number,d:number;
 if(m[1]){y=+m[1];mo=+m[2];d=+m[3];}else{d=+m[4];mo=+m[5];y=m[6]?(m[6].length===2?2000+ +m[6]:+m[6]):+reference.slice(0,4);
  // Sem ano: assume o próximo vencimento a partir da data de referência.
  if(!m[6]&&`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`<reference)y+=1;}
 if(mo<1||mo>12||d<1||d>31)return null;const iso=`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
 return Number.isFinite(Date.parse(iso+'T00:00:00Z'))&&new Date(iso+'T00:00:00Z').getUTCDate()===d?iso:null;
}
const key=(name:string)=>name.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim();
function cleanName(line:string){
 return line.replace(new RegExp(MONEY.source,'g'),' ').replace(new RegExp(DATE.source,'g'),' ')
  .replace(/\b(vencimento|venc\.?|vence(?: em)?|valor|total|data|em|de)\b[:\s]*/gi,' ').replace(/[;,|\t—–-]+/g,' ').replace(/\s+/g,' ').trim().slice(0,120);
}
export function parseDocument(text:string,reference:string):ImportedItem[]{
 const rows:ImportedItem[]=[];
 for(const [index,raw] of text.split(/\r?\n/).entries()){
  const line=raw.trim();if(!line)continue;const amount=parseMoneyText(line),due=parseDateText(line,reference);if(!amount||!due)continue;
  const name=cleanName(line)||'Conta importada';rows.push({id:`linha-${index+1}`,name,amount,due,recurring:false,line});
 }
 // Mesmo nome em meses diferentes sugere conta recorrente (o usuário decide).
 for(const r of rows){const months=new Set(rows.filter(o=>key(o.name)===key(r.name)).map(o=>o.due.slice(0,7)));r.recurring=months.size>=2;}
 return rows;
}
