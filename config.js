/*
 * Configuración de la app.
 *
 * MODO COMPARTIDO (activo, proyecto reserva-del-mar): pegue en `firebase` el objeto firebaseConfig de su proyecto
 *   (Firebase → Configuración del proyecto → Tus apps → Web). Los datos viven en
 *   Firestore y los ven todos los usuarios autorizados en firestore.rules. Cada
 *   persona entra con su cuenta de Google. Estos valores no son secretos: la
 *   seguridad la dan las reglas de Firestore.
 *
 * MODO LOCAL: deje `firebase: null`. Cada persona guarda sus datos en su propio
 *   navegador y los pasa con "Respaldar" / "Restaurar".
 */
window.APP_CONFIG = {
  titulo: "Estados Financieros · Agrupación Reserva del Mar P.H.",

  firebase: {
    apiKey: "AIzaSyBY_Q62P2opvttJJErWoYILAn7JVUdeDgY",
    authDomain: "reserva-del-mar.firebaseapp.com",
    projectId: "reserva-del-mar",
    storageBucket: "reserva-del-mar.firebasestorage.app",
    messagingSenderId: "842122654447",
    appId: "1:842122654447:web:b729daa4e2c3784663e11a",
  },
};
