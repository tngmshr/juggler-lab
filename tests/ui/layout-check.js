'use strict';
// 画面崩れ・アクセシビリティの点検スクリプト（手動実行用。npm run test:ui）
// 375px／ズーム150%・200%相当／文字1.5倍・2倍 × ダーク・ライト配色で、
// 横はみ出し・文字の見切れ・要素の重なり・axe-core の検査結果を集計する。
// 前提：playwright が require できること。axe-core は AXE_PATH か node_modules にあれば使う。
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..','..');
const OUT=process.env.UI_OUT||path.join(ROOT,'tests','ui','out');
let axeSource=null;
for(const p of [process.env.AXE_PATH,(()=>{try{return require.resolve('axe-core/axe.min.js')}catch{return null}})()].filter(Boolean)){if(fs.existsSync(p)){axeSource=fs.readFileSync(p,'utf8');break}}

function serve(){const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'};
 const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://x').pathname);if(p.endsWith('/'))p+='index.html';const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return}res.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res)});
 return new Promise(r=>server.listen(0,'127.0.0.1',()=>r(server)));}

const longShop='とても長い店舗名のサンプル駅前第二ホール新館';
function seed(){const recs=[],models=['my5','my6','neo'];let d=new Date();
 for(let day=0;day<6;day++){const dt=new Date(d);dt.setDate(dt.getDate()-day-1);const date=dt.toISOString().slice(0,10);
  for(let m=0;m<6;m++)recs.push({date,shop:m%2?longShop:'店舗A',number:String(1100+m),model:models[m%3],g:3000+m*700+day*50,bb:12+m+day,rb:9+m*2,status:'final'});}
 const sessions=[{model:'my5',date:recs[0].date,shop:longShop,number:'1234',g:4300,bb:16,rb:14,invest:23000,returns:18000,budget:20000,minutes:0,prior:'conservative',savedAt:''}];
 const draft={savedAt:new Date().toISOString(),values:{liveModel:'my6',liveG:'4321',liveBB:'17',liveRB:'15',livePrior:'conservative',liveShop:longShop,liveNumber:'1234',liveInvest:'25000',liveReturn:'1000',liveBudget:'20000',liveMinutes:'45'}};
 return {'jug-lab-data-v2':JSON.stringify(recs),'jug-lab-sessions-v2':JSON.stringify(sessions),'jug-lab-live-draft-v1':JSON.stringify(draft),'jug-lab-install-dismissed-until-v1':String(Date.now()+864e5)};}

// ページ内で実行する検査
function inspect(){
 const vw=document.documentElement.clientWidth,issues=[];
 const visible=el=>{const s=getComputedStyle(el);if(s.display==='none'||s.visibility==='hidden'||el.closest('[hidden]'))return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0};
 const name=el=>{let s=el.tagName.toLowerCase();if(el.id)s+='#'+el.id;else if(el.className&&typeof el.className==='string')s+='.'+el.className.trim().split(/\s+/).join('.');const t=(el.textContent||'').trim().slice(0,24);return s+(t?` 「${t}」`:'')};
 if(document.documentElement.scrollWidth>vw+1)issues.push(`ページ全体が横にはみ出し（${document.documentElement.scrollWidth}px > ${vw}px）：`+[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>vw+1&&!e.parentElement.closest('.scroll')).slice(0,3).map(name).join(' / '));
 const all=[...document.querySelectorAll('main *, footer *')].filter(el=>!(el instanceof SVGElement)||el.tagName==='svg').filter(visible);
 for(const el of all){if(el.closest('.scroll,.svg-sprite,pre,select,option,datalist'))continue;const s=getComputedStyle(el),r=el.getBoundingClientRect();
  if(r.right>vw+1&&!el.closest('.scroll'))issues.push(`画面右端からはみ出し：${name(el)}（右端 ${Math.round(r.right)}px）`);
  const clips=['hidden','clip'].includes(s.overflowX)||['hidden','clip'].includes(s.overflowY);
  if(clips&&!['INPUT','TEXTAREA','IMG'].includes(el.tagName)&&!el.matches('.range-gauge,.track,.empty-state')){if(el.scrollWidth>el.clientWidth+1||el.scrollHeight>el.clientHeight+1)issues.push(`文字の見切れ：${name(el)}（${el.scrollWidth}x${el.scrollHeight} が ${el.clientWidth}x${el.clientHeight} に収まらない）`)}}
 // 重なり：テキストを直接持つ要素・ボタン・入力欄どうし
 const leaves=all.filter(el=>['BUTTON','INPUT','SELECT','LABEL','SUMMARY'].includes(el.tagName)||[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())).filter(el=>!el.closest('.scroll'));
 // 折り返したインライン要素は行ごとの矩形（getClientRects）で比べる。固定表示のタブは除外。
 const rects=leaves.filter(el=>!el.closest('.tabs')).map(el=>{let rs;if(['BUTTON','INPUT','SELECT'].includes(el.tagName))rs=[el.getBoundingClientRect()];else{const range=document.createRange();range.selectNodeContents(el);rs=[...range.getClientRects()].filter(r=>r.width>0&&r.height>0)}return {el,rs}});
 const hit=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2;
 for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const a=rects[i],b=rects[j];if(a.el.contains(b.el)||b.el.contains(a.el))continue;if(a.rs.some(x=>b.rs.some(y=>hit(x,y))))issues.push(`重なり：${name(a.el)} と ${name(b.el)}`)}
 return [...new Set(issues)];
}
function scaleFonts(f){const els=[...document.querySelectorAll('body *')].filter(e=>!(e instanceof SVGElement));const sizes=els.map(e=>parseFloat(getComputedStyle(e).fontSize));els.forEach((e,i)=>e.style.setProperty('font-size',sizes[i]*f+'px','important'))}

async function run(){
 fs.mkdirSync(OUT,{recursive:true});const server=await serve();const base=`http://127.0.0.1:${server.address().port}/index.html`;
 const browser=await chromium.launch();const report=[];let total=0;
 const scenarios=[{w:375,zoom:1,font:1},{w:375,zoom:1,font:1.5},{w:375,zoom:1,font:2},{w:250,zoom:1.5,font:1},{w:188,zoom:2,font:1},{w:768,zoom:1,font:1}];
 for(const scheme of ['dark','light'])for(const sc of scenarios){
  const ctx=await browser.newContext({viewport:{width:sc.w,height:800},deviceScaleFactor:sc.zoom,colorScheme:scheme,isMobile:true,hasTouch:true});
  await ctx.addInitScript(data=>{if(!sessionStorage.getItem('seeded')){for(const [k,v] of Object.entries(data))localStorage.setItem(k,v);sessionStorage.setItem('seeded','1')}},seed());
  const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.dismiss());
  for(const tab of ['live','before','data']){
   await page.goto(base+'?view='+tab+'#'+tab);await page.waitForTimeout(200);
   if(tab==='live'){await page.click('#analyzeLiveTop');await page.evaluate(()=>document.querySelectorAll('details').forEach(d=>d.open=true))}
   if(tab==='before'){await page.evaluate(()=>{document.getElementById('filterMinDays').value='1';document.getElementById('filterMinDays').dispatchEvent(new Event('change'))});const b=await page.$('[data-candidate="0"]');if(b)await b.click()}
   if(tab==='data')await page.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);document.getElementById('ocrOutput').hidden=false});
   await page.waitForTimeout(250);
   if(sc.font!==1)await page.evaluate(scaleFonts,sc.font);
   const issues=await page.evaluate(inspect);
   let axe=[];if(axeSource&&sc.font===1&&sc.zoom===1&&sc.w===375){await page.addScriptTag({content:axeSource});axe=await page.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','best-practice']},resultTypes:['violations']});return r.violations.map(v=>`${v.id}（${v.impact}）×${v.nodes.length}：${v.nodes.slice(0,4).map(n=>n.target.join(' ')).join(' / ')}`)})}
   const label=`${scheme}/${sc.w}px/zoom${sc.zoom}/文字${sc.font}x/${tab}`;
   await page.screenshot({path:path.join(OUT,label.replace(/\//g,'_')+'.png'),fullPage:true});
   const all=[...issues,...axe.map(a=>'axe：'+a),...errors.map(e=>'JSエラー：'+e)];total+=all.length;report.push({label,issues:all});
  }
  await ctx.close();
 }
 await browser.close();server.close();
 for(const r of report){console.log(`\n■ ${r.label}：${r.issues.length?r.issues.length+'件':'問題なし'}`);r.issues.slice(0,30).forEach(i=>console.log('  - '+i))}
 console.log(`\n合計 ${total} 件${axeSource?'':'（axe-core 未検出のため aria/コントラスト検査は省略）'}`);process.exitCode=total?1:0;
}
run().catch(e=>{console.error(e);process.exit(2)});
