import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Firebase web config is intentionally public — security is enforced via
// Firebase Security Rules, not by hiding this config. See:
// https://firebase.google.com/docs/projects/api-keys
const firebaseConfig = {
  apiKey:            'AIzaSyD8j0VKdy01gj0EANuUX3zILod3EH2de5g',
  authDomain:        'gb-driver-b7bec.firebaseapp.com',
  databaseURL:       'https://gb-driver-b7bec-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId:         'gb-driver-b7bec',
  storageBucket:     'gb-driver-b7bec.firebasestorage.app',
  messagingSenderId: '34555367242',
  appId:             '1:34555367242:web:38ca05f435ef02d2893bb3',
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
