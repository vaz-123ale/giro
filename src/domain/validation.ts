export const MAX_AMOUNT=100000000;
export function validDate(value:unknown):value is string {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value);return !Number.isNaN(date.valueOf())&&date.toISOString().slice(0,10)===value;
}
export function requireAmount(value:unknown,allowZero=false):asserts value is number {
 if(typeof value!=='number'||!Number.isSafeInteger(value)||value<(allowZero?0:1)||value>MAX_AMOUNT)throw new Error('Informe um valor válido em centavos.');
}
export function parseMoney(value:string){
 if(!/^\d+([.,]\d{1,2})?$/.test(value.trim()))throw new Error('Use um valor como 35,50.');
 const [whole,decimal='']=value.trim().replace(',','.').split('.');
 const result=Number(whole)*100+Number(decimal.padEnd(2,'0'));requireAmount(result,true);return result;
}
export function parsePercent(value:string){const bps=parseMoney(value);if(bps>10000)throw new Error('O percentual deve estar entre 0 e 100.');return bps;}
