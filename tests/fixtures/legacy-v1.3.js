// v1.3（コミット a4b8333）の index.html から計算部分を一字一句そのまま写した凍結コピー。
// 切り出し後の js/calc.js と結果が一致することを確かめる基準として使う。編集しないこと。
// tests/calc.test.js が、各断片が a4b8333:index.html に含まれていることを git で照合する。
'use strict';
// @verbatim-begin
const SPECS={my5:{name:'マイジャグラーV',b:[273.1,270.8,266.4,254,240.1,229.1],r:[409.6,385.5,336.1,290,268.6,229.1]},my6:{name:'マイジャグラーVI',b:[273.1,270.8,266.4,254,240.1,229.1],r:[409.6,385.5,336.1,290,268.6,229.1]},neo:{name:'ネオアイムジャグラーEX',b:[273.1,269.7,269.7,259,259,255],r:[439.8,399.6,331,315.1,255,255]}};
function calc(r,prior='uniform'){
 const s=SPECS[r.model],non=r.g-r.bb-r.rb;
 const logs=s.b.map((b,i)=>r.bb*Math.log(1/b)+r.rb*Math.log(1/s.r[i])+non*Math.log1p(-1/b-1/s.r[i]));
 const w=prior==='conservative'?[.45,.25,.15,.08,.05,.02]:[1,1,1,1,1,1];
 const z=logs.map((v,i)=>v+Math.log(w[i]));const mx=Math.max(...z);const exp=z.map(v=>Math.exp(v-mx));const total=exp.reduce((a,b)=>a+b,0);const post=exp.map(v=>v/total);
 return {p:post,high:post.slice(3).reduce((a,b)=>a+b,0),best:1+post.indexOf(Math.max(...post))};
}
const PRIOR_NAMES={conservative:'低設定中心',uniform:'全設定同確率'},MIN_G=1000,STABLE_G=3000,SHRINK_DAYS=3;
function dayHigh(r){return calc(r,'conservative').high}
// @verbatim-end
// renderBefore() の並べ替え部分（DOM 読み取り以外を逐語で移植）
function legacyRank(arr,minD){
 const groups=new Map();
 // @verbatim-line
 arr.forEach(r=>{const key=[r.shop,r.model,r.number].join('\u001f');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r)});
 // @verbatim-line
 let candidates=[...groups.values()].filter(g=>g.length>=minD).map(rows=>{rows.sort((a,b)=>a.date.localeCompare(b.date));const scores=rows.map(dayHigh);return {rows,shop:rows[0].shop,number:rows[0].number,model:rows[0].model,n:rows.length,meanG:rows.reduce((a,b)=>a+b.g,0)/rows.length,meanHigh:scores.reduce((a,b)=>a+b,0)/scores.length,sumHigh:scores.reduce((a,b)=>a+b,0),highDays:scores.filter(x=>x>=.5).length,rbTotal:rows.reduce((a,b)=>a+b.rb,0),gTotal:rows.reduce((a,b)=>a+b.g,0)}});
 // @verbatim-line
 const all=candidates.flatMap(c=>c.rows.map(dayHigh)),gm=all.length?all.reduce((a,b)=>a+b,0)/all.length:0;candidates.forEach(c=>c.shrunk=(c.sumHigh+SHRINK_DAYS*gm)/(c.n+SHRINK_DAYS));candidates.sort((a,b)=>b.shrunk-a.shrunk||b.n-a.n);
 return {groups,candidates};
}
module.exports={SPECS,calc,PRIOR_NAMES,MIN_G,STABLE_G,SHRINK_DAYS,dayHigh,legacyRank};
