/** Local QR Model 2, version 5-L, byte mode, mask 0. One RS block, 108 data + 26 ECC codewords.
 * Fixed version keeps the encoder small; links must be ASCII and <=106 bytes. No remote QR service. */
export function invitationQR(value:string):boolean[][]{
 const bytes=new TextEncoder().encode(value);if(bytes.length>106||bytes.some(b=>b>127))throw Error('Link local muito longo para este QR. Use o endereço 127.0.0.1.');
 const bits:number[]=[];const push=(v:number,n:number)=>{for(let k=n-1;k>=0;k--)bits.push((v>>>k)&1);};
 push(4,4);push(bytes.length,8);for(const b of bytes)push(b,8);push(0,Math.min(4,864-bits.length));while(bits.length%8)bits.push(0);
 const data:number[]=[];for(let k=0;k<bits.length;k+=8)data.push(bits.slice(k,k+8).reduce((a,b)=>a*2+b,0));
 for(let k=0;data.length<108;k++)data.push(k%2?0x11:0xec);
 const mul=(a:number,b:number)=>{let r=0;for(let k=7;k>=0;k--){r=(r<<1)^((r>>>7)*0x11d);r^=((b>>>k)&1)*a;}return r;};
 const divisor=Array<number>(26).fill(0);divisor[25]=1;let root=1;
 for(let k=0;k<26;k++){for(let j=0;j<26;j++){divisor[j]=mul(divisor[j],root);if(j<25)divisor[j]^=divisor[j+1];}root=mul(root,2);}
 const ecc=Array<number>(26).fill(0);for(const b of data){const factor=b^ecc.shift()!;ecc.push(0);for(let j=0;j<26;j++)ecc[j]^=mul(divisor[j],factor);}
 const n=37;const matrix=Array.from({length:n},()=>Array<boolean>(n).fill(false));const used=matrix.map(r=>r.map(()=>false));
 const set=(x:number,y:number,v:boolean)=>{if(x>=0&&x<n&&y>=0&&y<n){matrix[y][x]=v;used[y][x]=true;}};
 for(let k=0;k<n;k++){set(6,k,k%2===0);set(k,6,k%2===0);}
 for(const [cx,cy] of [[3,3],[n-4,3],[3,n-4]])for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const d=Math.max(Math.abs(dx),Math.abs(dy));set(cx+dx,cy+dy,d!==2&&d!==4);}
 for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(30+dx,30+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);
 const format=0x77c4;const f=(k:number)=>Boolean((format>>>k)&1);
 for(let k=0;k<=5;k++)set(8,k,f(k));set(8,7,f(6));set(8,8,f(7));set(7,8,f(8));for(let k=9;k<15;k++)set(14-k,8,f(k));
 for(let k=0;k<8;k++)set(n-1-k,8,f(k));for(let k=8;k<15;k++)set(8,n-15+k,f(k));set(8,n-8,true);
 const stream=[...data,...ecc].flatMap(b=>Array.from({length:8},(_,k)=>(b>>>(7-k))&1));let index=0;
 for(let right=n-1;right>=1;right-=2){if(right===6)right=5;for(let v=0;v<n;v++){const y=((right+1)&2)===0?n-1-v:v;for(let j=0;j<2;j++){const x=right-j;if(!used[y][x])matrix[y][x]=Boolean((stream[index++]??0)^((x+y)%2===0?1:0));}}}
 return matrix;
}
