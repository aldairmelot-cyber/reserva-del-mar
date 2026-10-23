/*
 * Configuración de la app.
 *
 * MODO COMPARTIDO: pegue en `firebase` el objeto firebaseConfig de su proyecto
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

  firebase: null,
};
