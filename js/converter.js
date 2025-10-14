import { alertOK } from './app.js';

const sarEl = document.getElementById('sar');
const krwEl = document.getElementById('krw');
const usdEl = document.getElementById('usd');

const rateStamp = document.getElementById('rate-stamp');
const rUsdKrw = document.getElementById('rate-usd-krw');
const rUsdSar = document.getElementById('rate-usd-sar');
const rSarKrw = document.getElementById('rate-sar-krw');
const saveRates = document.getElementById('save-rates');
const resetRates = document.getElementById('reset-rates');

const DEF = { usd_krw: 1350, usd_sar: 3.75, sar_krw: 360 };
function loadRates(){
  const s = localStorage.getItem('rates');
  return s ? JSON.parse(s) : DEF;
}
function save(r){
  localStorage.setItem('rates', JSON.stringify(r));
  rateStamp.textContent = 'تم الحفظ محليًا';
  alertOK('تم حفظ أسعار الصرف.');
}
function setInputs(r){
  rUsdKrw.value = r.usd_krw;
  rUsdSar.value = r.usd_sar;
  rSarKrw.value = r.sar_krw;
}

let rates = loadRates(); setInputs(rates);

function format(n){ return (+n || 0).toString(); }

function convert(from){
  rates = loadRates();
  const usd_krw = +rates.usd_krw;
  const usd_sar = +rates.usd_sar;
  const sar_krw = +rates.sar_krw;

  let sar = +sarEl.value || 0;
  let krw = +krwEl.value || 0;
  let usd = +usdEl.value || 0;

  if (from === 'sar'){
    usd = sar / usd_sar;
    krw = sar * sar_krw;
  } else if (from === 'krw'){
    sar = krw / sar_krw;
    usd = sar / usd_sar;
  } else if (from === 'usd'){
    sar = usd * usd_sar;
    krw = usd * usd_krw;
  }
  sarEl.value = (Math.round(sar*100)/100).toFixed(2);
  usdEl.value = (Math.round(usd*100)/100).toFixed(2);
  krwEl.value = Math.round(krw).toString();
}

['input','change'].forEach(evt=>{
  sarEl.addEventListener(evt, ()=>convert('sar'));
  krwEl.addEventListener(evt, ()=>convert('krw'));
  usdEl.addEventListener(evt, ()=>convert('usd'));
});

saveRates.addEventListener('click', ()=>{
  const r = { usd_krw: +rUsdKrw.value, usd_sar: +rUsdSar.value, sar_krw: +rSarKrw.value };
  save(r);
});
resetRates.addEventListener('click', ()=>{ save(DEF); setInputs(DEF); convert('sar'); });

// Initialize
convert('sar');
