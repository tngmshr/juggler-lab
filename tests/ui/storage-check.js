'use strict';
// 保存データが古い形式・空・壊れた JSON のときに、実際のページが落ちずに動くかを確かめる（手動実行用。npm run test:ui）。
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('playwright');
const ROOT=path.resolve(process.env.APP_ROOT||path.join(__dirname,'..','..'));
const rec={model:'my5',date:'2026-10-01',shop:'店舗A',number:'123',g:6500,bb:24,rb:22,status:'final'};
const ses={model:'my6',date:'2026-10-02',shop:'店舗B',number:'7',g:4000,bb:16,rb:14,invest:12000,returns:8000,budget:20000,minutes:60,prior:'conservative',savedAt:''};
const D='jug-lab-data-v2',S='jug-lab-sessions-v2',L='jug-lab-live-draft-v1',O='juggler-assist-records-v1';
const cases=[
 ['保存なし',{}],
 ['空文字',{[D]:'',[S]:'',[L]:''}],
 ['壊れたJSON',{[D]:'[{"model":',[S]:'{',[L]:'{"values":'}],
 ['JSONだが配列でない',{[D]:'{"a":1}',[S]:'"x"',[L]:'[]'}],
 ['null',{[D]:'null',[S]:'null',[L]:'null'}],
 ['不正な行が混在',{[D]:JSON.stringify([rec,null,1,{...rec,model:'toString'},{...rec,g:'abc'}]),[S]:JSON.stringify([ses,{...ses,shop:999,g:'4000',bb:'16',rb:'14'}])}],
 ['機種名がtoString',{[D]:JSON.stringify([{...rec,model:'toString'}])}],
 ['店舗名が数値の実戦',{[S]:JSON.stringify([{...ses,shop:999}])}],
 ['下書きに選択肢外の値',{[L]:JSON.stringify({savedAt:'x',values:{liveModel:'zzz',livePrior:'?',liveDate:'2026-99-99',liveG:'4000',liveBB:'16',liveRB:'14',liveInvest:'abc'}})}],
 ['旧v1形式のみ',{[O]:JSON.stringify([{date:'2026-10-01',shop:'旧店',number:'5',model:'my5',g:5000,bb:20,rb:15},{broken:true}])}],
 ['旧v1形式が壊れている',{[O]:'{{{'}],
];
function serve(){const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://x').pathname);if(p.endsWith('/'))p+='index.html';const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return}res.writeHead(200,{'content-type':f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream'});fs.createReadStream(f).pipe(res)});return new Promise(r=>server.listen(0,'127.0.0.1',()=>r(server)))}
(async()=>{const server=await serve(),url=`http://127.0.0.1:${server.address().port}/index.html`;const browser=await chromium.launch();let fail=0;
 for(const [name,data] of cases){const ctx=await browser.newContext({viewport:{width:375,height:800}});await ctx.addInitScript(d=>{if(!sessionStorage.getItem('seeded')){localStorage.clear();for(const [k,v] of Object.entries(d))localStorage.setItem(k,v);sessionStorage.setItem('seeded','1')}},data);
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(url);await page.waitForTimeout(150);
  // 入力して分析できるか・各タブを開けるか
  await page.fill('#liveG','4000');await page.fill('#liveBB','16');await page.fill('#liveRB','14');await page.click('#analyzeLiveTop');
  const r=await page.evaluate(()=>({high:document.getElementById('liveHigh').textContent,err:document.getElementById('liveError').textContent,model:document.getElementById('liveModel').value,prior:document.getElementById('livePrior').value,notice:document.getElementById('recoveryNotice')?.hidden===false}));
  for(const t of ['before','data','live']){await page.click(`[data-tab="${t}"]`);await page.waitForTimeout(50)}
  const counts=await page.evaluate(()=>({hist:document.getElementById('historyCount').textContent,sessions:document.querySelectorAll('#sessionBody [data-session-view]').length}));
  // 退避があれば：削除ボタンで退避キーが消え、再読み込み後もお知らせが出ないこと
  let cleared='';if(r.notice){await page.click('[data-tab="data"]');await page.evaluate(()=>document.querySelectorAll('details').forEach(d=>d.open=true));const tools=await page.isVisible('#recoveryTools');await page.click('#clearRecovery');await page.reload();await page.waitForTimeout(150);const after=await page.evaluate(()=>({notice:!document.getElementById('recoveryNotice').hidden,keys:Object.keys(localStorage).filter(k=>k.endsWith('-recovery-v1')).length}));cleared=tools&&!after.notice&&!after.keys?' 退避削除OK':' 退避削除NG';}
  const okRun=!errors.length&&/%/.test(r.high)&&!r.err&&r.model&&['uniform','conservative'].includes(r.prior)&&!cleared.includes('NG');if(!okRun)fail++;
  console.log(`${okRun?'OK ':'NG '} ${name}：推定=${r.high||'(なし)'} 履歴=${counts.hist} 実戦=${counts.sessions}件${r.notice?' 退避通知あり':''}${cleared}${r.err?' 入力エラー='+r.err:''}${errors.length?' JSエラー='+errors.join(' | '):''}`);
  await ctx.close()}
 await browser.close();server.close();console.log(fail?`\n${fail} 件で問題あり`:'\nすべてのケースで落ちずに動作');process.exitCode=fail?1:0})().catch(e=>{console.error(e);process.exit(2)});
