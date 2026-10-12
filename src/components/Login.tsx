import {useEffect,useState} from 'react';

/**
 * Entrada com senha. A pessoa escolhe com qual conta vai entrar:
 * a barraca (vendedor/a, usuário "dona"), fornecedor(a) ou equipe/cliente (usuário próprio).
 */
type Kind='barraca'|'fornecedor'|'equipe';
const KINDS:{id:Kind;title:string;desc:string;icon:string}[]=[
 {id:'barraca',title:'Minha barraca',desc:'Sou quem vende',icon:'/icons/nav-inicio.png'},
 {id:'fornecedor',title:'Fornecedor(a)',desc:'Vendo para a barraca',icon:'/icons/nav-compromissos.png'},
 {id:'equipe',title:'Equipe ou cliente',desc:'Ajudo ou compro',icon:'/icons/nav-equipe.png'},
];
export function LoginPage(){
 const [kind,setKind]=useState<Kind>('barraca');
 const [usuario,setUsuario]=useState('');const [senha,setSenha]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const [demo,setDemo]=useState<{usuario:string;senha:string;convite:string}>();
 useEffect(()=>{fetch('/api/demo').then(r=>r.ok?r.json():undefined).then(setDemo).catch(()=>{});},[]);
 const login=kind==='barraca'?'dona':usuario;
 return <main className="standalone"><img className="logo" src="/logo_giro.png" alt="GIRO"/>
  <section className="login-hero"><h1>Entrar no GIRO</h1><p>Dinheiro organizado hoje, confiança para amanhã.</p></section>
  <section className="panel">
   {demo&&<div className="note demo-access"><strong>Public demo · fictional data · simulated Solana</strong><p>Demonstração pública com dados fictícios. User <b>{demo.usuario}</b> · password <b>{demo.senha}</b></p>
    <div className="form-actions"><button className="primary" type="button" onClick={()=>{setKind('barraca');setSenha(demo.senha);}}>Fill in demo login</button><a className="secondary" href={`/participar/${demo.convite}`}>Try joining by invite link</a></div></div>}
   <h2>Com qual conta você quer entrar?</h2>
   <div className="login-choice" role="radiogroup" aria-label="Tipo de conta">{KINDS.map(k=><button key={k.id} type="button" role="radio" aria-checked={kind===k.id} className={kind===k.id?'on':''} onClick={()=>{setKind(k.id);setError('');}}>
    <img src={k.icon} alt=""/><strong>{k.title}</strong><small>{k.desc}</small></button>)}</div>
   <form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({usuario:login,senha})});const v=await r.json();if(!r.ok)throw Error(v.error);location.replace(v.who==='pessoa'?'/eu':'/');}catch(err){setError((err as Error).message);}finally{setBusy(false);}}}>
    {kind!=='barraca'&&<label>Seu usuário<input value={usuario} onChange={e=>setUsuario(e.target.value.toLowerCase())} autoComplete="username" placeholder="o usuário que você criou no convite" required/></label>}
    <label>{kind==='barraca'?'Senha da barraca':'Sua senha'}<input type="password" autoComplete="current-password" value={senha} onChange={e=>setSenha(e.target.value)} required/></label>
    {error&&<p className="error" role="alert">{error}</p>}<button className="primary big-action" disabled={busy}>{busy?'Entrando…':'Entrar'}</button>
   </form>
   <p className="muted">{kind==='fornecedor'?'Você vê o que tem a receber, aceita acordos e confirma pagamentos em dinheiro.':kind==='equipe'?'Você vê seus turnos, comissões e acordos.':'Você vê o painel completo da barraca: vendas, acordos, equipe e confiança.'} Ainda não tem conta? Peça um link de convite.</p>
  </section></main>;
}
