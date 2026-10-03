// Gera o cliente TypeScript do programa giro_acordos a partir do IDL do Anchor (Codama → @solana/kit).
// Entrada: solana/target/idl/giro_acordos.json (gerado por solana/scripts/compilar-e-testar.sh no WSL).
// Saída:   solana/clients/giro/ — GERADO, não editar à mão.
// Uso: npm run solana:cliente
import {readFileSync,existsSync} from 'node:fs';
import {createFromRoot} from 'codama';
import {rootNodeFromAnchor} from '@codama/nodes-from-anchor';
import {renderVisitor} from '@codama/renderers-js';

const idlPath='solana/target/idl/giro_acordos.json';
if(!existsSync(idlPath)){console.error(`IDL não encontrado (${idlPath}). Compile antes no WSL: bash solana/scripts/compilar-e-testar.sh`);process.exit(1);}
const codama=createFromRoot(rootNodeFromAnchor(JSON.parse(readFileSync(idlPath,'utf8'))));
// erasableSyntax + extensão .ts: o código gerado roda direto no Node com --experimental-strip-types, como o resto do GIRO.
await codama.accept(renderVisitor('solana/clients/giro',{generatedFolder:'.',deleteFolderBeforeRendering:true,formatCode:false,syncPackageJson:false,erasableSyntax:true,importExtension:'ts',kitImportStrategy:'rootOnly'}));
console.log('Cliente gerado em solana/clients/giro/');
