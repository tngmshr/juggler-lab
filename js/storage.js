// ジャグラー分析ラボ：保存データの検証と読み込み（DOM に依存しない部分）
// localStorage の中身が古い形式・空・壊れた JSON でも例外を外へ出さず、読める行だけを返す。
'use strict';
// ブラウザでは calc.js が先に読み込まれて SPECS がグローバルにある。node では require する。
const specsTable=()=>typeof SPECS!=='undefined'?SPECS:require('./calc.js').SPECS;
const isModel=m=>Object.prototype.hasOwnProperty.call(specsTable(),m);
const format=n=>Number(n).toLocaleString('ja-JP');
const DRAFT_KEY='jug-lab-live-draft-v1';
function isDate(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T12:00:00');return !isNaN(d)&&`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`===v;}
function parseIntStrict(v,min=0,max=999999){if(!/^(0|[1-9]\d*)$/.test(String(v).trim()))throw Error('回転数・回数・金額には0以上の整数を入力してください。');const n=Number(v);if(!Number.isSafeInteger(n)||n<min||n>max)throw Error(`数値は${min}〜${format(max)}の範囲で入力してください。`);return n;}
function validateR(r){if(!r||!isModel(r.model))throw Error('対応していない機種です。');if(!isDate(r.date))throw Error('営業日を正しく入力してください。');if(!r.shop||!r.number||String(r.shop).length>70||String(r.number).length>20)throw Error('店舗名と台番号を入力してください（文字数制限あり）。');for(const k of ['g','bb','rb'])parseIntStrict(r[k],k==='g'?1:0);if(Number(r.bb)+Number(r.rb)>Number(r.g))throw Error('BIGとREGの合計は総回転数を超えられません。');if(!['final','partial','unknown'].includes(r.status))throw Error('記録区分が正しくありません。');return r;}
function validRecord(raw){try{if(!raw||typeof raw!=='object')return null;const r={model:String(raw.model),date:String(raw.date),shop:String(raw.shop??'').trim(),number:String(raw.number??'').trim(),g:Number(raw.g),bb:Number(raw.bb),rb:Number(raw.rb),status:String(raw.status||'unknown')};validateR(r);return r;}catch{return null}}
// 実戦記録。古い版や手で編集したデータでは数値が文字列・店舗名が数値のことがあるため、型をそろえてから検証する。
function validSession(raw){try{if(!raw||typeof raw!=='object')return null;const r={model:String(raw.model),date:String(raw.date),shop:String(raw.shop??'').trim(),number:String(raw.number??'').trim(),g:Number(raw.g),bb:Number(raw.bb),rb:Number(raw.rb),status:'partial'};validateR(r);const money={};for(const k of ['invest','returns','budget','minutes'])money[k]=parseIntStrict(raw[k],0,100000000);if(!['uniform','conservative'].includes(raw.prior))return null;return {model:r.model,date:r.date,shop:r.shop,number:r.number,g:r.g,bb:r.bb,rb:r.rb,...money,prior:raw.prior,savedAt:String(raw.savedAt||'')};}catch{return null}}
// 保存文字列 → 配列。broken=true は JSON として読めない、または配列でないことを表す（null/空は正常な「データなし」）。
function parseStoredArray(text){if(text===null||text===undefined||text==='')return {rows:[],broken:false};try{const x=JSON.parse(text);if(Array.isArray(x))return {rows:x,broken:false};return {rows:[],broken:x!==null}}catch{return {rows:[],broken:true}}}
// 保存文字列を検証済みの行に変換する。dropped は検証で除外した行数。
function loadRows(text,validator){const {rows,broken}=parseStoredArray(text);const valid=rows.map(validator).filter(Boolean);return {rows:valid,broken,dropped:rows.length-valid.length}}
// 実戦入力の下書き（jug-lab-live-draft-v1）。選択肢にない値・不正な日付・整数でない数値は捨てて既定値を残す。
const DRAFT_FIELDS=['liveModel','liveG','liveBB','liveRB','livePrior','liveShop','liveNumber','liveDate','liveInvest','liveReturn','liveBudget','liveMinutes'];
function sanitizeDraft(text){
 let draft;try{draft=JSON.parse(text)}catch{return null}
 if(!draft||typeof draft!=='object'||!draft.values||typeof draft.values!=='object'||Array.isArray(draft.values))return null;
 const values={},src=draft.values,has=k=>Object.prototype.hasOwnProperty.call(src,k)&&(typeof src[k]==='string'||typeof src[k]==='number');
 for(const id of DRAFT_FIELDS){if(!has(id))continue;const v=String(src[id]).trim();
  if(id==='liveModel'){if(isModel(v))values[id]=v}
  else if(id==='livePrior'){if(v==='uniform'||v==='conservative')values[id]=v}
  else if(id==='liveDate'){if(isDate(v))values[id]=v}
  else if(id==='liveShop'){values[id]=v.slice(0,70)}
  else if(id==='liveNumber'){values[id]=v.slice(0,20)}
  else if(v===''||/^(0|[1-9]\d{0,8})$/.test(v))values[id]=v;}
 const t=new Date(draft.savedAt);return {values,savedAt:typeof draft.savedAt==='string'&&!Number.isNaN(t.getTime())?t:null};
}
// JSON バックアップの検証。復元できない場合は日本語のエラーを投げる。
function parseBackup(text){let x;try{x=JSON.parse(text)}catch{throw Error('JSONとして読み込めません。')}if(!x||typeof x!=='object'||x.app!=='jug-lab'||x.version!==2||!Array.isArray(x.records)||!Array.isArray(x.sessions))throw Error('対応するバックアップ形式ではありません。');const records=x.records.map(validRecord),sessions=x.sessions.map(validSession);if(records.some(v=>!v)||sessions.some(v=>!v))throw Error('バックアップに不正な記録があります。');return {records,sessions}}
if(typeof module==='object'&&module.exports)module.exports={format,DRAFT_KEY,DRAFT_FIELDS,isDate,parseIntStrict,validateR,validRecord,validSession,parseStoredArray,loadRows,sanitizeDraft,parseBackup};
