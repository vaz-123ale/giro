import {useEffect,useState} from 'react';

/** Entrada com senha (só existe quando o GIRO está acessível fora do PC, pelo túnel). */
export function LoginPage(){
 const [usuario,setUsuario]=useState('');const [senha,setSenha]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const [demo,setDemo]=useState<{usuario:string;senha:string;convite:string}>();
 useEffect(()=>{fetch('/api/demo').then(r=>r.ok?r.json():undefined).then(setDemo).catch(()=>{});},[]);
 return <main className="standalone"><img className="logo" src="/logo_giro.png" alt="GIRO"/><section className="panel"><h1>Entrar no GIRO</h1>
  {demo&&<div className="note demo-access"><strong>Public demo · fictional data · simulated Solana</strong><p>Demonstração pública com dados fictícios. User <b>{demo.usuario}</b> · password <b>{demo.senha}</b></p>
   <div className="form-actions"><button className="primary" type="button" onClick={()=>{setUsuario(demo.usuario);setSenha(demo.senha);}}>Fill in demo login</button><a className="secondary" href={`/participar/${demo.convite}`}>Try joining by invite link</a></div></div>}
  <form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({usuario,senha})});const v=await r.json();if(!r.ok)throw Error(v.error);location.replace(v.who==='pessoa'?'/eu':'/');}catch(err){setError((err as Error).message);}finally{setBusy(false);}}}>
   <label>Usuário<input value={usuario} onChange={e=>setUsuario(e.target.value.toLowerCase())} autoComplete="username" placeholder="dona (dona do negócio) ou seu usuário" required/></label>
   <label>Senha<input type="password" autoComplete="current-password" value={senha} onChange={e=>setSenha(e.target.value)} required/></label>
   {error&&<p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy}>Entrar</button>
  </form><p className="muted">Os links de convite, confirmação e cobrança enviados para outras pessoas continuam funcionando sem senha.</p></section></main>;
}
