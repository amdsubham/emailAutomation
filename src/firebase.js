import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDZDU6QCqb8BDtCbAVnKY_NNP5lX6pXAJc",
    authDomain: "email-scheduler-app-c8bd3.firebaseapp.com",
    projectId: "email-scheduler-app-c8bd3",
    storageBucket: "email-scheduler-app-c8bd3.firebasestorage.app",
    messagingSenderId: "796333674769",
    appId: "1:796333674769:web:123109d4714c860765bcb0",
    measurementId: "G-2R01V0X6XK"
};
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
