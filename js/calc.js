// ジャグラー分析ラボ：確率計算とランキング（DOM に依存しない部分）
// ブラウザでは通常の <script> として読み込み、トップレベルの const/function をそのまま使う。
// node では末尾の module.exports から読み込む（tests/ を参照）。
// 注意：数値・式は v1.3 の index.html から変更せずに移したもの。変更時は tests/calc.test.js の同値性テストが落ちる。
'use strict';
// 機種スペック（公表値）。b=BIG確率の分母、r=REG確率の分母（設定1〜6）。
const SPECS={my5:{name:'マイジャグラーV',b:[273.1,270.8,266.4,254,240.1,229.1],r:[409.6,385.5,336.1,290,268.6,229.1]},my6:{name:'マイジャグラーVI',b:[273.1,270.8,266.4,254,240.1,229.1],r:[409.6,385.5,336.1,290,268.6,229.1]},neo:{name:'ネオアイムジャグラーEX',b:[273.1,269.7,269.7,259,259,255],r:[439.8,399.6,331,315.1,255,255]}};
// BIG・REG・その他の3分類の多項尤度。ぶどう・単独REGは使わない。
function calc(r,prior='uniform'){
 const s=SPECS[r.model],non=r.g-r.bb-r.rb;
 const logs=s.b.map((b,i)=>r.bb*Math.log(1/b)+r.rb*Math.log(1/s.r[i])+non*Math.log1p(-1/b-1/s.r[i]));
 const w=prior==='conservative'?[.45,.25,.15,.08,.05,.02]:[1,1,1,1,1,1];
 const z=logs.map((v,i)=>v+Math.log(w[i]));const mx=Math.max(...z);const exp=z.map(v=>Math.exp(v-mx));const total=exp.reduce((a,b)=>a+b,0);const post=exp.map(v=>v/total);
 return {p:post,high:post.slice(3).reduce((a,b)=>a+b,0),best:1+post.indexOf(Math.max(...post))};
}
// 事前確率は結論を大きく動かすため、2つの仮定を常に並べて見せる。MIN_G未満は数値を出さない。
const PRIOR_NAMES={conservative:'低設定中心',uniform:'全設定同確率'},MIN_G=1000,STABLE_G=3000,SHRINK_DAYS=3;
function dayHigh(r){return calc(r,'conservative').high}
// 来店前ランキング：同じ店舗・機種・台番号で日をまとめ、各日の設定4〜6推定（低設定中心）を
// 「全台平均を SHRINK_DAYS 日分足して平均」することで、記録日数が少ない台ほど全台平均へ縮小する。
// records は表示条件で絞り込み済みの確定記録。groups は絞り込み後の全台（minDays 適用前）。
function rankCandidates(records,minDays){
 const groups=new Map();records.forEach(r=>{const key=[r.shop,r.model,r.number].join('\u001f');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r)});
 const candidates=[...groups.values()].filter(g=>g.length>=minDays).map(rows=>{rows.sort((a,b)=>a.date.localeCompare(b.date));const scores=rows.map(dayHigh);return {rows,shop:rows[0].shop,number:rows[0].number,model:rows[0].model,n:rows.length,meanG:rows.reduce((a,b)=>a+b.g,0)/rows.length,meanHigh:scores.reduce((a,b)=>a+b,0)/scores.length,sumHigh:scores.reduce((a,b)=>a+b,0),highDays:scores.filter(x=>x>=.5).length,rbTotal:rows.reduce((a,b)=>a+b.rb,0),gTotal:rows.reduce((a,b)=>a+b.g,0)}});
 const all=candidates.flatMap(c=>c.rows.map(dayHigh)),gm=all.length?all.reduce((a,b)=>a+b,0)/all.length:0;
 candidates.forEach(c=>c.shrunk=(c.sumHigh+SHRINK_DAYS*gm)/(c.n+SHRINK_DAYS));
 candidates.sort((a,b)=>b.shrunk-a.shrunk||b.n-a.n);
 return {groups,candidates,grandMean:gm};
}
if(typeof module==='object'&&module.exports)module.exports={SPECS,calc,PRIOR_NAMES,MIN_G,STABLE_G,SHRINK_DAYS,dayHigh,rankCandidates};
