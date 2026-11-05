// AI に貼り付けて相談する文章を生成する（DOM・通信に依存しない）。
'use strict';
const promptCalc=typeof module==='object'&&module.exports?require('./calc.js'):{calc,SPECS,PRIOR_NAMES,MIN_G,STABLE_G};
const promptFormat=n=>Number(n).toLocaleString('ja-JP');
const promptPct=n=>(n*100).toFixed(1)+'%';
const promptRate=(g,n)=>n?'1/'+(g/n).toLocaleString('ja-JP',{minimumFractionDigits:1,maximumFractionDigits:1}):'0回（確率は算出できません）';
const promptCaution='数値はすべて確率的な推定で、結果を保証するものではありません。';

function buildLivePrompt(r,opts={}){
 const {calc,SPECS,PRIOR_NAMES,MIN_G,STABLE_G}=promptCalc,s=SPECS[r.model];
 const lines=[
  '以下はジャグラーの実戦データと、確率計算アプリ『ジャグラー分析ラボ』の計算結果です。',
  '', '【お願い】',
  '・データから言えることと言えないことを分けて、短く説明してください。',
  '・高設定・低設定を断定しないでください。このゲーム数でどれくらい不確かかも書いてください。',
  '・続けるかやめるかは、下の予算・時間の上限を最優先にした「判断材料」として示してください。勝てる・取り返せるとは言わないでください。',
  '・ぶどう確率・単独/重複REGのデータは入っていません。推測で補わないでください。',
  '', '【機種】',s.name,'公表値（BIG確率 ／ REG確率）',
  ...s.b.map((b,i)=>`設定${i+1}：1/${b.toFixed(1)} ／ 1/${s.r[i].toFixed(1)}`),
  '', '【データ】',`日付：${r.date}`
 ];
 if(opts.includeShop)lines.push(`店舗：${r.shop}`,`台番号：${r.number}`);
 lines.push(`総ゲーム数：${promptFormat(r.g)}G`,
  `BIG：${promptFormat(r.bb)}回 ／ ${promptRate(r.g,r.bb)}`,
  `REG：${promptFormat(r.rb)}回 ／ ${promptRate(r.g,r.rb)}`,
  `合算確率：${promptRate(r.g,r.bb+r.rb)}`,'','【アプリの計算】');
 if(r.g>=MIN_G){
  lines.push(`設定4〜6である確率：低設定中心の前提 ${promptPct(calc(r,'conservative').high)} ／ 全設定同確率の前提 ${promptPct(calc(r,'uniform').high)}（前提の置き方で大きく変わります）`);
  if(r.g<STABLE_G)lines.push(`（${promptFormat(STABLE_G)}G未満のため特に不安定）`);
  lines.push(`選択中の前提：${PRIOR_NAMES[r.prior]}`,
   ...calc(r,r.prior).p.map((p,i)=>`設定${i+1}：${promptPct(p)}`));
 }else{
  lines.push(`${promptFormat(MIN_G)}G未満のため、アプリは設定の数値を出していません。あなたも設定の確率を数値で推定しないでください。`);
 }
 const net=r.returns-r.invest,left=r.budget-r.invest;
 lines.push('','【収支と上限】',`投資：${promptFormat(r.invest)}円`,
  `回収：${promptFormat(r.returns)}円`,`差：${net>=0?'+':''}${promptFormat(net)}円`,
  `予算上限：${promptFormat(r.budget)}円`,`上限までの残り：${left<=0?'上限に到達':promptFormat(left)+'円'}`,
  `遊技時間（残り）：${promptFormat(r.minutes)}分`,'',promptCaution);
 return lines.join('\n');
}

// ctx は表示用文字列のオブジェクト：shop / model / period / weekday / minG / minDays。
// 店舗は専用の項目で受け取り、匿名時に条件文からも除く。
function buildCandidatesPrompt(candidates,ctx={},opts={}){
 const lines=[
  '以下はジャグラーの過去の確定記録と、確率計算アプリ『ジャグラー分析ラボ』の上位候補（最大5件）です。',
  '', '【お願い】',
  '・記録日数が少ない候補は偶然の影響が大きいことを踏まえ、データから言えることと言えないことを分けて短く比べてください。',
  '・ランキングは、記録日数に応じて全体平均へ寄せた値（ならし後の値）で並べています。実際の高設定投入率ではありません。',
  '・どれが高設定かを断定しないでください。必ず勝てる台はありません。遊技や追加投資を勧めず、予算・時間の上限を優先してください。',
  '・ぶどう確率・単独/重複REGのデータは入っていません。推測で補わないでください。',
  '', '【条件】',`店舗：${opts.includeShop?(ctx.shop||'すべての店舗'):'非表示'}`,
  `機種：${ctx.model||'すべての機種'}`,`期間：${ctx.period||'指定なし'}`,
  `曜日：${ctx.weekday||'すべて'}`,`最低G：${ctx.minG||'制限なし'}`,
  `最低日数：${ctx.minDays||'指定なし'}`,'','【候補】'
 ];
 if(!candidates.length)lines.push('条件に一致する候補はありません。');
 candidates.slice(0,5).forEach((c,i)=>{
  lines.push(`${opts.includeShop?`店舗：${c.shop} ／ 台番号：${c.number}`:'候補'+String.fromCharCode(65+i)}`,
   `機種：${promptCalc.SPECS[c.model].name}`,`記録日数：${promptFormat(c.n)}日`,
   `平均G：${promptFormat(Math.round(c.meanG))}G`,`REG確率（通算G / 通算REG）：${promptRate(c.gTotal,c.rbTotal)}`,
   `設定4〜6推定の日平均（低設定中心の前提）：${promptPct(c.meanHigh)}`,
   `50%以上だった日数 / 全日数：${promptFormat(c.highDays)}日 / ${promptFormat(c.n)}日`,
   `ならし後の値：${promptPct(c.shrunk)}`,'');
 });
 lines.push(promptCaution);
 return lines.join('\n');
}
if(typeof module==='object'&&module.exports)module.exports={buildLivePrompt,buildCandidatesPrompt};
