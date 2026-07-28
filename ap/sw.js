// مِشوار Service Worker — يدعم إشعارات النظام الحقيقية عند الإضافة للشاشة الرئيسية
const CACHE = 'mishwar-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
});

// عند النقر على الإشعار، افتح/ركّز التطبيق
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./index.html');
    })
  );
});

// (اختياري) استقبال Push من خادم حقيقي مستقبلاً
self.addEventListener('push', e => {
  let data = { title: 'مِشوار', body: 'لديك تنبيه جديد' };
  try { if (e.data) data = e.data.json(); } catch (_) {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body, icon: 'icon.png', badge: 'icon.png',
      vibrate: [80,40,80], dir: 'rtl', lang: 'ar', tag: 'mishwar-push', renotify: true
    })
  );
});
