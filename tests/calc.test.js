'use strict';
// 計算部分（js/calc.js）が v1.3 の index.html にあった実装と 1e-12 以内で一致することを確かめる。
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const cur=require('../js/calc.js'),legacy=require('./fixtures/legacy-v1.3.js');
const EPS=1e-12;

// 再現できる疑似乱数（mulberry32）
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const MODELS=Object.keys(legacy.SPECS);
function randomPlay(r){const model=MODELS[Math.floor(r()*MODELS.length)];const mode=r();let g;
 if(mode<.15)g=1+Math.floor(r()*999);else if(mode<.85)g=1000+Math.floor(r()*9000);else g=10000+Math.floor(r()*989999);
 const bb=Math.floor(r()*Math.min(g,g/150+20)),rb=Math.floor(r()*Math.min(g-bb,g/180+20)+0);return {model,g,bb:Math.min(bb,g),rb:Math.min(rb,g-Math.min(bb,g))}}
function close(a,b,msg){assert.ok(Math.abs(a-b)<=EPS,`${msg}: ${a} と ${b} の差 ${Math.abs(a-b)} が 1e-12 を超える`)}
function sameCalc(x,y,msg){assert.equal(x.p.length,6);for(let i=0;i<6;i++)close(x.p[i],y.p[i],`${msg} p[${i}]`);close(x.high,y.high,`${msg} high`);assert.equal(x.best,y.best,`${msg} best`)}

test('凍結コピーが v1.3（a4b8333）の index.html と一字一句同じ',t=>{
 let original;try{original=execFileSync('git',['show','a4b8333:index.html'],{cwd:path.join(__dirname,'..'),encoding:'utf8',stdio:['ignore','pipe','ignore']})}catch{t.skip('git 履歴が無いため照合を省略');return}
 const fx=fs.readFileSync(path.join(__dirname,'fixtures','legacy-v1.3.js'),'utf8');
 const block=fx.split('// @verbatim-begin\n')[1].split('\n// @verbatim-end')[0];
 const origLines=new Set(original.split('\n'));for(const l of block.split('\n'))assert.ok(origLines.has(l),'元の index.html に同じ行が無い：'+l.slice(0,60));
 const lines=[...fx.matchAll(/\/\/ @verbatim-line\n (.*)\n/g)].map(m=>m[1]);
 assert.equal(lines.length,3);for(const l of lines)assert.ok(original.includes(l),'renderBefore の断片が元と一致しない：'+l.slice(0,60));
});

test('機種スペックの数値と定数が変わっていない',()=>{
 assert.deepEqual(cur.SPECS,legacy.SPECS);
 assert.deepEqual(cur.PRIOR_NAMES,legacy.PRIOR_NAMES);
 assert.equal(cur.MIN_G,1000);assert.equal(cur.MIN_G,legacy.MIN_G);assert.equal(cur.STABLE_G,legacy.STABLE_G);assert.equal(cur.SHRINK_DAYS,legacy.SHRINK_DAYS);
});

test('calc()：境界値で切り出し前と一致',()=>{
 const cases=[];for(const model of MODELS){cases.push({model,g:1,bb:0,rb:0},{model,g:1,bb:1,rb:0},{model,g:1,bb:0,rb:1},{model,g:2,bb:1,rb:1},{model,g:999,bb:4,rb:3},{model,g:1000,bb:4,rb:3},{model,g:1000,bb:0,rb:0},{model,g:3000,bb:30,rb:30},{model,g:999999,bb:0,rb:0},{model,g:999999,bb:4000,rb:4000},{model,g:999999,bb:999999,rb:0},{model,g:8000,bb:29,rb:35})}
 for(const r of cases)for(const prior of [undefined,'uniform','conservative','その他']){const a=prior===undefined?cur.calc(r):cur.calc(r,prior),b=prior===undefined?legacy.calc(r):legacy.calc(r,prior);sameCalc(a,b,JSON.stringify(r)+prior);close(cur.dayHigh(r),legacy.dayHigh(r),'dayHigh')}
});

test('calc()：乱数 20,000 件で切り出し前と一致',()=>{
 const r=rng(20261102);for(let i=0;i<20000;i++){const play=randomPlay(r);for(const prior of ['uniform','conservative'])sameCalc(cur.calc(play,prior),legacy.calc(play,prior),JSON.stringify(play)+prior)}
});

test('calc()：事後確率は合計1で、有限値',()=>{
 const r=rng(7);for(let i=0;i<2000;i++){const play=randomPlay(r),x=cur.calc(play,'conservative');close(x.p.reduce((a,b)=>a+b,0),1,'合計');assert.ok(x.p.every(Number.isFinite));assert.ok(x.high>=0&&x.high<=1+EPS)}
});

function randomRecords(r,n){const shops=['店舗A','店舗B','とても長い店舗名'],out=[];for(let i=0;i<n;i++){const p=randomPlay(r);out.push({...p,shop:shops[Math.floor(r()*shops.length)],number:String(100+Math.floor(r()*12)),date:`2026-${String(1+Math.floor(r()*10)).padStart(2,'0')}-${String(1+Math.floor(r()*28)).padStart(2,'0')}`,status:'final'})}return out}
const clone=a=>a.map(x=>({...x}));
test('ランキング（日数による全台平均への縮小）：乱数 300 データセットで切り出し前と一致',()=>{
 const r=rng(42);
 for(let k=0;k<300;k++){const recs=randomRecords(r,Math.floor(r()*120));const minD=[1,3,5][k%3];
  const a=cur.rankCandidates(clone(recs),minD),b=legacy.legacyRank(clone(recs),minD);
  assert.equal(a.groups.size,b.groups.size);assert.equal(a.candidates.length,b.candidates.length);
  a.candidates.forEach((c,i)=>{const d=b.candidates[i];assert.equal(c.shop+c.model+c.number,d.shop+d.model+d.number,`順位${i+1}の台が違う`);for(const f of ['n','highDays','rbTotal','gTotal'])assert.equal(c[f],d[f]);for(const f of ['meanG','meanHigh','sumHigh','shrunk'])close(c[f],d[f],f);assert.deepEqual(c.rows.map(x=>x.date),d.rows.map(x=>x.date))});
 }
});

test('ランキング：記録日数が少ない台ほど全台平均に寄る',()=>{
 const base={shop:'S',model:'my5',status:'final'};
 const strong={g:8000,bb:40,rb:40},weak={g:8000,bb:25,rb:18};
 const recs=[{...base,number:'1',date:'2026-10-01',...strong}];
 for(let d=1;d<=9;d++)recs.push({...base,number:'2',date:`2026-10-0${d}`,...strong});
 for(let d=1;d<=9;d++)recs.push({...base,number:'3',date:`2026-10-0${d}`,...weak});
 const {candidates,grandMean}=cur.rankCandidates(recs,1);const one=candidates.find(c=>c.number==='1'),nine=candidates.find(c=>c.number==='2');
 assert.ok(Math.abs(one.meanHigh-nine.meanHigh)<EPS,'同じ成績なら補正前の平均は同じ');
 assert.ok(one.shrunk<nine.shrunk,'1日だけの台は9日の台より強く縮小される');
 close(one.shrunk,(one.sumHigh+3*grandMean)/(1+3),'縮小式');
 assert.equal(candidates[0].number,'2');
});

test('画面側の方針：1000G 未満は数値を出さない判定が残っている',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.ok(html.includes('enough=r.g>=MIN_G'));assert.ok(html.includes("enough?pct(lo)+'〜'+pct(hi):'判断材料不足'"));assert.ok(html.includes('enough?renderBars(a.p)'));
 assert.ok(html.includes('rankCandidates(arr,minD)'),'ランキングは rankCandidates を使う');
 assert.ok(!/function calc\(/.test(html),'calc() は js/calc.js にだけ置く');
 assert.ok(html.indexOf('src="./js/calc.js"')<html.indexOf('src="./js/storage.js"'),'calc.js を storage.js より先に読み込む');
});
