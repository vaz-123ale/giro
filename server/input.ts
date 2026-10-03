export function inputRecord(input:unknown):Record<string,unknown>{if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Dados inválidos.');return input as Record<string,unknown>;}
