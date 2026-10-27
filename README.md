# Estados Financieros · Agrupación Reserva del Mar P.H.

Aplicación web para generar, a partir de los balances de prueba mensuales de World Office, los estados financieros de la propiedad horizontal (ESF, ERI, ECP, EFE, indicadores, notas y certificación), además de presupuesto, retenciones, IVA, ICA, cartera, banco de manillas (ventas en Siigo frente a banco y Plink), banco de expensas (banco frente al libro auxiliar), verificación contable con el libro auxiliar y verificación DIAN.

Es un sitio estático: un solo `index.html` que se ejecuta completo en el navegador. Los archivos contables se procesan en el equipo de quien los carga y no se suben al repositorio.

## Publicar en GitHub Pages

1. Suba estos archivos a la rama `main` del repositorio `reserva-del-mar`.
2. En el repositorio: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, rama `main`, carpeta `/ (root)`. Guarde.
3. En uno o dos minutos la app queda en `https://aldairmelot-cyber.github.io/reserva-del-mar/`.

> En el plan gratuito de GitHub, Pages solo funciona con repositorios **públicos**. El código queda visible, pero los datos contables no, porque viven en Firebase y no en el repositorio.

## Dónde se guardan los datos

La app trae dos modos; se elige en `config.js`.

### Modo compartido (Firebase)

Todo el equipo ve y edita los mismos datos, con inicio de sesión de Google y una lista de correos autorizados.

1. Cree un proyecto gratuito en <https://console.firebase.google.com>.
2. **Authentication → Sign-in method**: active **Google**. En **Authentication → Settings → Authorized domains**, agregue `aldairmelot-cyber.github.io`.
3. **Firestore Database → Crear base de datos** (modo producción, región `southamerica-east1`).
4. **Firestore → Reglas**: pegue el contenido de `firestore.rules` y publique.
5. **Configuración del proyecto → Tus apps → Web (`</>`)**: registre la app y copie el objeto `firebaseConfig` en `config.js`, en el campo `firebase`.

### Perfiles

- **Editor** (el contador): los correos de `editores` en `config.js` y de la función `editor()` en `firestore.rules`. Carga, edita y configura todo.
- **Consulta**: se asignan dentro de la app, en **Datos → Usuarios y perfiles**, con el correo de Google de cada persona. Solo ven y descargan informes; al entrar ven una portada con el resumen del mes.
  - **Consejo de Administración**: estados financieros, presupuesto, cartera, aclaraciones e informe al Consejo. Sin impuestos ni descarga de los archivos cargados.
  - **Administración**: lo del Consejo más impuestos (retención, IVA, ICA, prorrateo).
  - **Revisoría Fiscal**: lo de la Administración más revisión del balance, auditoría del fondo de imprevistos, libro auxiliar, verificación DIAN, banco de manillas y banco de expensas.

Cada persona de consulta puede tener además un papel de **firma** (representante legal, contador o revisor fiscal), que se asigna en **Usuarios y perfiles**. Cuando el mes está definitivo, cada uno firma su parte en **Estados financieros → Firmas** y la firma sale en el PDF y el Word de los estados financieros. El editor no firma (salvo que se ponga `editorFirma: "contador"` en `config.js`), pero puede retirar cualquier firma. Si el mes se reabre como borrador, las firmas se retiran.

Las reglas de `firestore.rules` hacen cumplir esos permisos en el servidor: un perfil de consulta no puede leer lo que no le corresponde ni escribir nada. Al cambiar las reglas, péguelas en **Firebase → Firestore Database → Reglas** y pulse **Publicar**. Para agregar otro editor, añada su correo en `config.js` y en `firestore.rules`.

Para probar los perfiles en modo local, abra la app con `?perfil=consejo`, `?perfil=admin` o `?perfil=revisor` al final de la dirección.

En Firestore cada documento se guarda como texto JSON en un campo `j`, porque la app usa listas dentro de listas, que Firestore no admite directamente. Los archivos originales que se suben (para descargarlos después en **Archivos cargados**) se guardan en la misma base, en las colecciones `_archivos` y `_archivos_partes`; no hace falta activar Firebase Storage.

### Modo local

Con `firebase: null`, cada persona trabaja con los datos de su propio navegador (IndexedDB), sin servidor ni cuentas.

### Respaldar y restaurar

En ambos modos, los botones **Respaldar** y **Restaurar** (abajo a la derecha) descargan o cargan un archivo `.json` con toda la información. Sirven para copias de seguridad y para pasar datos de un modo a otro.

## Probar en su computador

```bash
npx serve .          # o: python -m http.server 8000
```

Abra la dirección que indique. No abra `index.html` con doble clic: algunos navegadores bloquean el almacenamiento con `file://`.

## Estructura

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La app completa (interfaz, motor de cálculo, exportación a PDF, Excel y Word). |
| `plataforma.js` | Adaptador de almacenamiento, usuarios, archivos y descargas (modo local o Firebase). |
| `config.js` | Elige el modo y guarda la configuración de Firebase. |
| `firestore.rules` | Reglas de seguridad para el modo compartido. |

No suba archivos contables (`.xlsx`, `.xls`, `.pdf`) ni respaldos (`respaldo-*.json`): el `.gitignore` ya los excluye.

## Instalar en el celular

La app se puede instalar como aplicación (sin tiendas):

- **Android (Chrome):** abra la dirección de la app, toque el menú **⋮** y elija **Instalar aplicación** o **Agregar a la pantalla principal**.
- **iPhone (Safari):** abra la dirección en **Safari**, toque **Compartir** (el cuadro con la flecha) y elija **Agregar a inicio**.

Queda un ícono "Reserva del Mar" que abre la app a pantalla completa. Siempre carga la versión más reciente; `sw.js` solo guarda una copia por si no hay conexión.
