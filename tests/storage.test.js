'use strict';
// 保存データ（jug-lab-data-v2 / jug-lab-sessions-v2 / jug-lab-live-draft-v1 / JSONバックアップ）が
// 古い形式・空・壊れた JSON でも例外を出さず、読める分だけ使えることを確かめる。
const test=require('node:test'),assert=require('node:assert/strict');
const st=require('../js/storage.js'),{calc}=require('../js/calc.js');
const ok={model:'my5',date:'2026-10-01',shop:'店舗A',number:'123',g:6500,bb:24,rb:22,status:'final'};
const okSession={model:'my6',date:'2026-10-02',shop:'店舗B',number:'7',g:4000,bb:16,rb:14,invest:12000,returns:8000,budget:20000,minutes:60,prior:'conservative',savedAt:'2026-10-02T10:00:00.000Z'};

test('parseStoredArray：空・null・壊れた JSON・配列以外',()=>{
 for(const [text,broken] of [[null,false],[undefined,false],['',false],['null',false],['[]',false],['[1,{"a":1}]',false],['{}',true],['"文字列"',true],['123',true],['true',true],['[',true],['{"records":[',true],['\u0000',true],['undefined',true]]){
  const r=st.parseStoredArray(text);assert.ok(Array.isArray(r.rows),String(text));assert.equal(r.broken,broken,String(text));}
});

test('台データ：不正な行だけを除外し、残りは読める',()=>{
 const rows=[null,0,'文字列',[],{},ok,{...ok,model:'マイジャグラーV'},{...ok,model:'toString'},{...ok,model:'__proto__'},{...ok,model:'constructor'},{...ok,date:'2026-02-30'},{...ok,g:0},{...ok,g:-5},{...ok,g:1.5},{...ok,bb:100,rb:100,g:150},{...ok,shop:''},{...ok,shop:'x'.repeat(71)},{...ok,status:'done'},{...ok,g:'6500',bb:'24',rb:'22'},{...ok,number:123},{...ok,status:undefined}];
 const res=st.loadRows(JSON.stringify(rows),st.validRecord);
 assert.equal(res.broken,false);assert.equal(res.rows.length,4);assert.equal(res.dropped,rows.length-4);
 assert.deepEqual(res.rows[1],{...ok,g:6500,bb:24,rb:22});assert.equal(res.rows[2].number,'123');assert.equal(res.rows[3].status,'unknown','旧形式で区分が無い行は「不明」');
 for(const r of res.rows)assert.ok(Number.isFinite(calc(r).high),'読めた行は計算できる');
 assert.deepEqual(st.loadRows('[壊れた',st.validRecord),{rows:[],broken:true,dropped:0});
 assert.deepEqual(st.loadRows(null,st.validRecord),{rows:[],broken:false,dropped:0});
});

test('実戦記録：文字列の数値・数値の店舗名を型をそろえて読む',()=>{
 const s=st.validSession({...okSession,g:'4000',bb:'16',rb:'14',invest:'12000',shop:456,number:7});
 assert.deepEqual(s,{...okSession,shop:'456',number:'7'});
 assert.equal(typeof s.g,'number');assert.equal(typeof s.shop,'string','店舗名は文字列（並べ替えで localeCompare を使うため）');
 // 文字列のまま比べると "5"+"5"="55" < "9" となり、BIG+REG>G を見逃していた
 assert.equal(st.validSession({...okSession,g:'9',bb:'5',rb:'5'}),null);
 for(const bad of [null,'x',[],{},{...okSession,prior:'other'},{...okSession,prior:undefined},{...okSession,invest:-1},{...okSession,minutes:'abc'},{...okSession,model:'hasOwnProperty'}])assert.equal(st.validSession(bad),null);
 assert.equal(st.validSession({...okSession,savedAt:undefined}).savedAt,'');
 const res=st.loadRows(JSON.stringify([okSession,{...okSession,model:'xx'},null]),st.validSession);assert.equal(res.rows.length,1);assert.equal(res.dropped,2);
});

test('入力の下書き（jug-lab-live-draft-v1）：空・壊れた JSON・古い形式で落ちない',()=>{
 for(const text of ['','{','null','[]','"x"','123','{}','{"values":null}','{"values":[1,2]}','{"values":"liveG"}','{"savedAt":"2026-01-01"}'])assert.equal(st.sanitizeDraft(text),null,text);
 assert.deepEqual(st.sanitizeDraft('{"values":{}}'),{values:{},savedAt:null});
});

test('入力の下書き：選択肢にない値・不正な日付・整数でない値は捨てる',()=>{
 const d=st.sanitizeDraft(JSON.stringify({savedAt:'壊れた日時',values:{liveModel:'my9',livePrior:'',liveDate:'2026-13-01',liveG:'abc',liveBB:'-1',liveRB:'1.5',liveInvest:'1e5',liveReturn:{},liveBudget:null,liveMinutes:true,liveShop:'あ'.repeat(100),liveNumber:12345,unknownField:'x'}}));
 assert.equal(d.savedAt,null);
 assert.deepEqual(d.values,{liveShop:'あ'.repeat(70),liveNumber:'12345'});
});

test('入力の下書き：正しい下書きはそのまま戻る（数値型でも可）',()=>{
 const values={liveModel:'neo',liveG:'4321',liveBB:17,liveRB:'15',livePrior:'uniform',liveShop:'店舗A',liveNumber:'12',liveDate:'2026-10-31',liveInvest:'0',liveReturn:'1000',liveBudget:'',liveMinutes:'45'};
 const d=st.sanitizeDraft(JSON.stringify({savedAt:'2026-10-31T12:34:00.000Z',values}));
 assert.deepEqual(d.values,{...values,liveBB:'17'});assert.ok(d.savedAt instanceof Date);
 assert.deepEqual(Object.keys(d.values).sort(),[...st.DRAFT_FIELDS].sort());
 assert.equal(st.DRAFT_KEY,'jug-lab-live-draft-v1');
});

test('JSONバックアップ：壊れた・形式違いは日本語のエラー、正しいものは読める',()=>{
 for(const [text,msg] of [['{',/JSONとして読み込めません/],['null',/対応するバックアップ形式/],['[]',/対応するバックアップ形式/],['{"app":"jug-lab","version":1,"records":[],"sessions":[]}',/対応するバックアップ形式/],[JSON.stringify({app:'jug-lab',version:2,records:[{...ok,g:0}],sessions:[]}),/不正な記録/]])assert.throws(()=>st.parseBackup(text),msg);
 const b=st.parseBackup(JSON.stringify({app:'jug-lab',version:2,exportedAt:'',records:[ok],sessions:[okSession]}));
 assert.deepEqual(b,{records:[ok],sessions:[okSession]});
});

test('入力値の検証：parseIntStrict / isDate',()=>{
 assert.equal(st.parseIntStrict(' 42 '),42);for(const v of ['','-1','01','1.0','1e3','abc',null,undefined])assert.throws(()=>st.parseIntStrict(v));
 assert.throws(()=>st.parseIntStrict('1000000'),/0〜999,999/);
 assert.ok(st.isDate('2024-02-29'));for(const v of ['2025-02-29','2026-1-01','2026/01/01','',null,20260101])assert.ok(!st.isDate(v));
});
