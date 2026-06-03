// Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyDtrEyAnVMhCZWnSaUYut9LxNC17C3So1Y",
  authDomain: "parasha-site-links.firebaseapp.com",
  projectId: "parasha-site-links",
  storageBucket: "parasha-site-links.firebasestorage.app",
  messagingSenderId: "799400165769",
  appId: "1:799400165769:web:1b5cf70eee80e772df6158",
measurementId: "G-2MGXGC1KB8"
  measurementId: "G-2MGXGC1KB8"
};

export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
