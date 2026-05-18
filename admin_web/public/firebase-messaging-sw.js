importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyDQ-BAicFOcJUyvcoJOvLgSfUeERhEdvNE',
  authDomain:        'parentguard-98b6f.firebaseapp.com',
  projectId:         'parentguard-98b6f',
  storageBucket:     'parentguard-98b6f.firebasestorage.app',
  messagingSenderId: '131679405903',
  appId:             '1:131679405903:web:2c896242c0f7e7660f673a',
});

const messaging = firebase.messaging();

// Background message: show a browser notification when admin tab is not focused
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'ParentGuard';
  const body  = payload.notification?.body  ?? 'New activity detected';
  self.registration.showNotification(title, {
    body,
    icon:  '/icon.png',
    badge: '/icon.png',
    data:  payload.data,
  });
});
