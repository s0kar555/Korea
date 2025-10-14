import './converter.js';
import './finance.js';
import './sync.js';

const VIEWS = ['login','converter','finance','sync'];
const show = (id) => {
  for (const v of VIEWS) {
    document.getElementById('view-' + v).classList.toggle('hidden', v !== id);
  }
  localStorage.setItem('route', id);
};

// Simple login gate (fixed credentials)
const VALID_USER = 'bayan';
const VALID_PASS = '5561742';

function isAuthed() {
  return localStorage.getItem('auth') === '1';
}
function requireAuth(id) {
  if (!isAuthed()) show('login'); else show(id);
}

document.getElementById('build-date').textContent = new Date().toLocaleString('ar');

// Nav
for (const btn of document.querySelectorAll('[data-route]')) {
  btn.addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.route;
    if (id === 'converter' || id === 'finance' || id === 'sync') return requireAuth(id);
    show(id);
  });
}

// Login form
const form = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout');
form.addEventListener('submit', (e)=>{
  e.preventDefault();
  const u = document.getElementById('username').value.trim();
  const p = document.getElementById('password').value.trim();
  if (u === VALID_USER && p === VALID_PASS) {
    localStorage.setItem('auth','1');
    alertOK('تم تسجيل الدخول بنجاح.');
    requireAuth('converter');
  } else {
    alertERR('بيانات الدخول غير صحيحة.');
  }
});
logoutBtn.addEventListener('click', ()=>{
  localStorage.removeItem('auth');
  alertOK('تم تسجيل الخروج.');
  show('login');
});

// Route restore
const saved = localStorage.getItem('route') || 'login';
requireAuth(saved);

// Alerts
const alertBox = document.getElementById('app-alert');
export function alertOK(msg){
  alertBox.className = 'mb-4 p-4 rounded-xl text-sm bg-green-50 text-green-700 border border-green-200';
  alertBox.textContent = msg;
  alertBox.classList.remove('hidden');
  setTimeout(()=>alertBox.classList.add('hidden'), 2500);
}
export function alertERR(msg){
  alertBox.className = 'mb-4 p-4 rounded-xl text-sm bg-rose-50 text-rose-700 border border-rose-200';
  alertBox.textContent = msg;
  alertBox.classList.remove('hidden');
}
