import { alertOK, alertERR } from './app.js';
import { db, syncPush, syncPull } from './store.js';

const form = document.getElementById('tx-form');
const body = document.getElementById('tx-body');
const summary = document.getElementById('summary');
const clearBtn = document.getElementById('tx-clear');

function uid(){ return crypto.randomUUID(); }
function today(){ return new Date().toISOString().slice(0,10); }

document.getElementById('tx-date').value = today();

async function reload(){
  const items = await db.getAll();
  render(items);
}
function sum(items){
  let income = 0, expense = 0;
  for (const x of items){
    if (x.type === 'income') income += +x.amount;
    else expense += +x.amount;
  }
  return { income, expense, balance: income - expense };
}
function render(items){
  body.innerHTML = '';
  items.sort((a,b)=> new Date(b.date) - new Date(a.date));
  items.forEach((x, i)=>{
    const tr = document.createElement('tr');
    tr.className = i%2? 'bg-white' : 'bg-slate-50';
    tr.innerHTML = `
      <td class="p-2 text-center">${i+1}</td>
      <td class="p-2">${x.type==='income'?'دخل':'مصروف'}</td>
      <td class="p-2 font-semibold">${x.amount}</td>
      <td class="p-2">${x.currency}</td>
      <td class="p-2">${x.category||''}</td>
      <td class="p-2">${x.date}</td>
      <td class="p-2">${x.note||''}</td>
      <td class="p-2 flex gap-2">
        <button class="btn" data-edit="${x.id}">تعديل</button>
        <button class="btn" data-del="${x.id}">حذف</button>
      </td>`;
    body.appendChild(tr);
  });
  const s = sum(items);
  summary.textContent = `الدخل: ${s.income} — المصروف: ${s.expense} — الصافي: ${s.balance}`;
}

form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const x = {
    id: uid(),
    type: document.getElementById('tx-type').value,
    amount: +document.getElementById('tx-amount').value,
    currency: document.getElementById('tx-currency').value,
    category: document.getElementById('tx-category').value.trim(),
    date: document.getElementById('tx-date').value || today(),
    note: document.getElementById('tx-note').value.trim(),
    updated_at: new Date().toISOString(),
    _op: 'insert'
  };
  if (!x.amount) return alertERR('الرجاء إدخال مبلغ صحيح.');
  await db.put(x);
  alertOK('تمت الإضافة.');
  form.reset(); document.getElementById('tx-date').value = today();
  reload();
});

clearBtn.addEventListener('click', ()=> form.reset());

body.addEventListener('click', async (e)=>{
  const editId = e.target.getAttribute('data-edit');
  const delId  = e.target.getAttribute('data-del');
  if (editId){
    const row = await db.get(editId);
    if (!row) return;
    // Prefill form
    document.getElementById('tx-type').value = row.type;
    document.getElementById('tx-amount').value = row.amount;
    document.getElementById('tx-currency').value = row.currency;
    document.getElementById('tx-category').value = row.category||'';
    document.getElementById('tx-date').value = row.date;
    document.getElementById('tx-note').value = row.note||'';
    // Mark as update on next submit
    await db.put({ ...row, _op: 'update', updated_at: new Date().toISOString() });
    alertOK('يمكنك تعديل القيم ثم الضغط على إضافة لحفظ كتعديل.');
  }
  if (delId){
    await db.delete(delId);
    alertOK('تم الحذف.');
    reload();
  }
});

// Expose sync buttons
document.getElementById('btn-push')?.addEventListener('click', async ()=>{
  await syncPush(); alertOK('تم رفع البيانات (إن وُجد اتصال).');
});
document.getElementById('btn-pull')?.addEventListener('click', async ()=>{
  await syncPull(); await reload(); alertOK('تم سحب البيانات.');
});

reload();
