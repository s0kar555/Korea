import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { alertERR } from './app.js';

const DB_NAME = 'travel_finance_db';
const STORE   = 'transactions';
let dbp;

function openDB(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = ()=>{
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)){
        const os = db.createObjectStore(STORE, { keyPath: 'id' });
        os.createIndex('by_date','date');
      }
    };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror   = ()=> reject(req.error);
  });
}
async function getDB(){ if (!dbp) dbp = openDB(); return dbp; }

export const db = {
  async getAll(){
    const db = await getDB();
    return new Promise((resolve, reject)=>{
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = ()=> resolve(req.result || []);
      req.onerror = ()=> reject(req.error);
    });
  },
  async put(item){
    const db = await getDB();
    return new Promise((resolve, reject)=>{
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(item);
      tx.oncomplete = resolve; tx.onerror = ()=> reject(tx.error);
    });
  },
  async get(id){
    const db = await getDB();
    return new Promise((resolve, reject)=>{
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = ()=> resolve(req.result);
      req.onerror = ()=> reject(req.error);
    });
  },
  async delete(id){
    const db = await getDB();
    return new Promise((resolve, reject)=>{
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = resolve; tx.onerror = ()=> reject(tx.error);
    });
  }
};

// ===== Optional Supabase Sync =====
function getCfg(){
  return {
    url: localStorage.getItem('sb_url') || '',
    key: localStorage.getItem('sb_key') || '',
    email: localStorage.getItem('sb_email') || '',
    pass: localStorage.getItem('sb_pass') || ''
  };
}
let supa;
function client(){
  const { url, key } = getCfg();
  if (!url || !key) return null;
  if (!supa) supa = createClient(url, key);
  return supa;
}

export async function syncPush(){
  const c = client(); if (!c) { alertERR('لم يتم إعداد Supabase.'); return; }
  const { email, pass } = getCfg();
  if (email && pass){
    await c.auth.signInWithPassword({ email, password: pass }).catch(()=>{});
  }
  const all = await db.getAll();
  const { data: userData } = await c.auth.getUser();
  const user_id = userData?.user?.id || null;
  const rows = all.map(x => ({
    id: x.id, user_id, type: x.type, amount: x.amount, currency: x.currency,
    category: x.category, note: x.note, date: x.date, updated_at: x.updated_at
  }));
  const { error } = await c.from('transactions').upsert(rows, { onConflict: 'id' });
  if (error) alertERR(error.message);
}

export async function syncPull(){
  const c = client(); if (!c) { alertERR('لم يتم إعداد Supabase.'); return; }
  const { email, pass } = getCfg();
  if (email && pass){
    await c.auth.signInWithPassword({ email, password: pass }).catch(()=>{});
  }
  const { data, error } = await c.from('transactions').select('*').order('date', { ascending: false }).limit(1000);
  if (error) { alertERR(error.message); return; }
  // Merge into IndexedDB
  for (const x of data){
    await db.put({ ...x });
  }
}
