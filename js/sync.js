import { alertOK, alertERR } from './app.js';

const form = document.getElementById('sb-form');
const urlEl = document.getElementById('sb-url');
const keyEl = document.getElementById('sb-key');
const emailEl = document.getElementById('sb-email');
const passEl = document.getElementById('sb-pass');

// Load saved
urlEl.value = localStorage.getItem('sb_url') || '';
keyEl.value = localStorage.getItem('sb_key') || '';
emailEl.value = localStorage.getItem('sb_email') || '';

form?.addEventListener('submit', (e)=>{
  e.preventDefault();
  localStorage.setItem('sb_url', urlEl.value.trim());
  localStorage.setItem('sb_key', keyEl.value.trim());
  localStorage.setItem('sb_email', emailEl.value.trim());
  localStorage.setItem('sb_pass', passEl.value.trim());
  alertOK('تم حفظ إعدادات Supabase.');
});

document.getElementById('btn-logout-sb')?.addEventListener('click', ()=>{
  localStorage.removeItem('sb_pass');
  alertOK('تم حذف كلمة المرور المحفوظة محليًا.');
});
