'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {calc,SPECS,rankCandidates,MIN_G,STABLE_G}=require('../js/calc.js');
const {buildLivePrompt,buildCandidatesPrompt}=require('../js/prompt.js');
const live={model:'my5',shop:'匿名確認用ホール',number:'台番号秘密123号',date:'2026-11-05',g:4300,bb:17,rb:16,invest:12000,returns:15000,budget:20000,minutes:60,prior:'conservative'};
const pct=n=>(n*100).toFixed(1)+'%';
const ctx={shop:live.shop,model:'マイジャグラーV',period:'直近30日',weekday:'木曜日',minG:'2,000G以上',minDays:'3日以上'};
function candidates(n=7){
 const rows=Array.from({length:n},(_,i)=>({...live,number:live.number+i,status:'final',g:4300+i*100}));
 return rankCandidates(rows,1).candidates;
}

test('4300G/BIG17/REG16：両前提と選択中の設定別確率が calc の結果と一致',()=>{
 for(const prior of ['conservative','uniform']){
  const r={...live,prior},text=buildLivePrompt(r);
  assert.ok(text.includes(`低設定中心の前提 ${pct(calc(r,'conservative').high)} ／ 全設定同確率の前提 ${pct(calc(r,'uniform').high)}`));
  calc(r,prior).p.forEach((p,i)=>assert.ok(text.includes(`設定${i+1}：${pct(p)}`)));
 }
});

test('800G：数値推定を禁止し、設定確率のパーセントを出さない',()=>{
 const text=buildLivePrompt({...live,g:800});
 assert.ok(text.includes('1,000G未満のため、アプリは設定の数値を出していません。あなたも設定の確率を数値で推定しないでください。'));
 assert.doesNotMatch(text,/%/);
});

test('MIN_G・STABLE_G の境界に合わせて確率と不安定さを表示',()=>{
 const below=buildLivePrompt({...live,g:MIN_G-1}),start=buildLivePrompt({...live,g:MIN_G});
 assert.doesNotMatch(below,/設定1：\d+\.\d%/);
 assert.match(start,/設定1：\d+\.\d%/);
 assert.ok(start.includes('（3,000G未満のため特に不安定）'));
 assert.ok(buildLivePrompt({...live,g:STABLE_G-1}).includes('特に不安定'));
 assert.ok(!buildLivePrompt({...live,g:STABLE_G}).includes('特に不安定'));
});

test('実戦の店舗名・台番号は既定と false で非表示、true で表示',()=>{
 for(const opts of [undefined,{includeShop:false}]){
  const text=buildLivePrompt(live,opts);assert.ok(!text.includes(live.shop));assert.ok(!text.includes(live.number));
 }
 const text=buildLivePrompt(live,{includeShop:true});assert.ok(text.includes(live.shop));assert.ok(text.includes(live.number));
});

test('候補は条件文も含めて匿名化し、true の場合だけ店舗名・台番号を表示',()=>{
 const list=candidates();
 for(const opts of [undefined,{includeShop:false}]){
  const text=buildCandidatesPrompt(list,ctx,opts);
  assert.ok(!text.includes(live.shop));assert.ok(!text.includes(live.number));
  assert.ok(text.includes('候補A'));assert.ok(text.includes('候補E'));
 }
 const text=buildCandidatesPrompt(list,ctx,{includeShop:true});
 assert.ok(text.includes(`店舗：${ctx.shop}`));assert.ok(text.includes(list[0].number));
});

test('候補が7件でも上位5件だけを元の順序で表示し、入力を変えない',()=>{
 const list=candidates(),before=JSON.stringify(list),text=buildCandidatesPrompt(list,ctx,{includeShop:true});
 assert.equal((text.match(/記録日数：/g)||[]).length,5);
 let position=-1;
 list.slice(0,5).forEach(c=>{const next=text.indexOf(`台番号：${c.number}`);assert.ok(next>position);position=next});
 list.slice(5).forEach(c=>assert.ok(!text.includes(c.number)));
 assert.equal(JSON.stringify(list),before);
});

test('候補0件でも例外にならず、候補なしと注意文を返す',()=>{
 const text=buildCandidatesPrompt([]);
 assert.ok(text.includes('条件に一致する候補はありません。'));
 assert.ok(text.endsWith('数値はすべて確率的な推定で、結果を保証するものではありません。'));
});

test('候補の全条件とランキング集計値を表示',()=>{
 const c=candidates(1)[0],text=buildCandidatesPrompt([c],ctx);
 for(const key of ['model','period','weekday','minG','minDays'])assert.ok(text.includes(ctx[key]));
 assert.ok(text.includes(`平均G：${Math.round(c.meanG).toLocaleString('ja-JP')}G`));
 assert.ok(text.includes(`REG確率（通算G / 通算REG）：1/${(c.gTotal/c.rbTotal).toFixed(1)}`));
 assert.ok(text.includes(`設定4〜6推定の日平均（低設定中心の前提）：${pct(c.meanHigh)}`));
 assert.ok(text.includes(`50%以上だった日数 / 全日数：${c.highDays}日 / ${c.n}日`));
 assert.ok(text.includes(`ならし後の値：${pct(c.shrunk)}`));
 assert.ok(text.includes('全体平均へ寄せた値'));assert.ok(text.includes('必ず勝てる台はありません'));
});

test('全機種の公表値を SPECS から出し、収支・上限・残り時間を整形',()=>{
 for(const [model,s] of Object.entries(SPECS)){
  const text=buildLivePrompt({...live,model});assert.ok(text.includes(s.name));
  s.b.forEach((b,i)=>assert.ok(text.includes(`設定${i+1}：1/${b.toFixed(1)} ／ 1/${s.r[i].toFixed(1)}`)));
 }
 const text=buildLivePrompt(live);
 for(const line of ['総ゲーム数：4,300G','投資：12,000円','回収：15,000円','差：+3,000円','予算上限：20,000円','上限までの残り：8,000円','遊技時間（残り）：60分'])assert.ok(text.includes(line));
 assert.ok(buildLivePrompt({...live,returns:0}).includes('差：-12,000円'));
 assert.ok(buildLivePrompt({...live,returns:live.invest}).includes('差：+0円'));
 for(const budget of [live.invest,live.invest-1])assert.ok(buildLivePrompt({...live,budget}).includes('上限までの残り：上限に到達'));
});

test('当選0回も Infinity や NaN を出さずに説明',()=>{
 const text=buildLivePrompt({...live,bb:0,rb:0});assert.doesNotMatch(text,/Infinity|NaN/);
 const c={...candidates(1)[0],rbTotal:0};assert.doesNotMatch(buildCandidatesPrompt([c],ctx),/Infinity|NaN/);
});

test('通常の script の順で読み込み、DOM や module がなくても同じ文章を生成',()=>{
 const sandbox=vm.createContext({});
 for(const name of ['calc.js','prompt.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',name),'utf8'),sandbox);
 assert.equal(sandbox.buildLivePrompt(live),buildLivePrompt(live));
 assert.equal(sandbox.buildCandidatesPrompt(candidates(),ctx),buildCandidatesPrompt(candidates(),ctx));
});
