# Estados Financieros · Agrupación Reserva del Mar P.H.

Aplicación web para generar, a partir de los balances de prueba mensuales de World Office, los estados financieros de la propiedad horizontal (ESF, ERI, ECP, EFE, indicadores, notas y certificación), además de presupuesto, retenciones, IVA, ICA, cartera, banco de manillas (ventas en Siigo frente a banco y Plink), banco de expensas (banco frente al libro auxiliar), verificación contable con el libro auxiliar y verificación DIAN.

Es un sitio estático: un solo `index.html` que se ejecuta completo en el navegador. Los archivos contables se procesan en el equipo de quien los carga y no se suben al repositorio.

## Publicar en GitHub Pages

1. Suba estos archivos a la rama `main` del repositorio `reserva-del-mar`.
2. En el repositorio: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, rama `main`, carpeta `/ (root)`. Guarde.
3. En uno o dos minutos la app queda en `https://aldairmelot-cyber.github.io/reserva-del-mar/`.

> En el plan gratuito de GitHub, Pages solo funciona con repositorios **públicos**. El código queda visible, pero los datos contables no, porque viven en Firebase y no en el repositorio.

## Reglamento de propiedad horizontal

En **Datos → Reglamento de PH** (y en **Reglamento** para los perfiles de consulta) están las escrituras que conforman el reglamento, los artículos de consulta frecuente con su página y los coeficientes revisados. El editor carga allí una vez el PDF de la Escritura 753 de 2023; queda en la base (colecciones `rph` y `rph_pdf`, no en este repositorio) y todos los perfiles lo pueden ver y descargar. No entra en los respaldos `.json`, por su tamaño: guarde aparte el PDF original.

## Comunicaciones

En **Comunicaciones → Comunicaciones emitidas** queda el consecutivo de las notas aclaratorias, conceptos y respuestas a solicitudes que emite Contabilidad (Consultoría Especializada S.A.S.), con la numeración `RDM-CONT-AAAA-NNN`. Cada comunicación se puede leer completa en la app (**Ver informe**) e imprimir o guardar en PDF con el membrete de Consultoría. El editor registra las nuevas con **Nueva comunicación** (el número se asigna solo) y puede adjuntar su PDF; todos los perfiles las ven. Las que se registran desde la app se guardan en la base (colecciones `comunicados` y `comunicados_pdf`), no en este repositorio.

## Cartera de propietarios y cuentas de cobro

En **Cartera → Cartera de propietarios** se ve lo que debe cada unidad al corte de la cartera cargada. Cada cuenta de cobro vence el último día de su mes: las del mes de corte están **por vencer** y las anteriores se clasifican por meses vencidos (1 mes = 1 a 30 días, 2 = 31 a 60, 3 = 61 a 90, 4 o más = más de 90). Con más de 2 meses vencidos la unidad pasa a **cobro jurídico** (reglamento, art. 42.2). Cada unidad tiene su estado de cuenta en PDF con un clic; para cobro jurídico el PDF anexa las cuentas de cobro pendientes que estén cargadas, y se pueden bajar todas juntas en un ZIP con el listado.

En **Cartera → Cuentas de cobro** el editor carga los PDF de las cuentas de cobro (sueltos, un PDF con varias, una por página, o un ZIP). La app lee el número, la unidad (`APTO 41433` = T4 1433), el mes y los valores, y las guarda en la base (colecciones `fv_idx` y `fv_pdf`). Si se carga otra vez una cuenta con el mismo número, se reemplaza.

El perfil **Cartera** (en **Datos → Usuarios y perfiles**) solo ve el módulo de Cartera: cartera de propietarios, cartera por edades y cuentas de cobro para descargar. No carga ni modifica nada.

## Recaudo de expensas (recibos de caja)

En **Conciliación bancaria → Recaudo de expensas** se carga el movimiento del banco de expensas (PDF de Bancolombia, cuenta 51748523433). La app identifica qué apartamento hizo cada abono y arma la relación en Excel para hacer los recibos de caja en World Office. Para identificar usa, en este orden:

1. el apartamento escrito en el banco ("ADMON APTO 1020A T3");
2. la cuenta de origen, la referencia o el documento con que ese apartamento pagó antes;
3. la referencia de consignación con la forma torre + apartamento (41327 = T4 1327; 01502 = T1 502);
4. el nombre de quien paga, comparado con los propietarios;
5. el valor, comparado con la cuota del último mes (con y sin el 10 % de descuento) y con lo que cada apartamento pagó antes.

La base sale del **libro auxiliar** cargado en Verificación contable (terceros "1606 T1 NOMBRE", cuota en 41701001 y recibos en 11200501) y de los meses del banco de expensas cargados en Conciliación bancaria (extracto + libro). Con **Aprender de extractos anteriores** se sueltan los PDF del banco de meses ya registrados para que la app aprenda de qué cuenta paga cada apartamento. Lo que el contador asigna o confirma queda como regla para los meses siguientes. Los abonos de Wompi agrupan varios pagos: con **Cargar reporte de Wompi (CSV)** (el reporte de desembolsos que descarga el panel de Wompi) cada abono se abre en sus pagos, con el valor pagado, la comisión y la cédula del pagador; el apartamento sale de la referencia del pago ("APARTAMENTOS 21325" = T2 1325) o de la cédula con que pagó antes. Los abonos del datáfono se dejan aparte. Todo se guarda en `cbl_seg` (`rec_reglas` y `rec_lote_…`), con los mismos permisos de la conciliación bancaria.

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
  - **Consejo de Administración**: estados financieros, presupuesto, aclaraciones e informe al Consejo. Sin cartera, impuestos ni descarga de los archivos cargados.
  - **Administración**: lo del Consejo más cartera e impuestos (retención, IVA, ICA, prorrateo).
  - **Revisoría Fiscal**: lo de la Administración más revisión del balance, auditoría del fondo de imprevistos, libro auxiliar, verificación DIAN, banco de manillas y banco de expensas.
  - **Cartera**: solo el módulo de Cartera (cartera de propietarios, cobro jurídico, estados de cuenta y cuentas de cobro). Sin estados financieros ni impuestos.

Cada persona de consulta puede tener además un papel de **firma** (representante legal, contador o revisor fiscal), que se asigna en **Usuarios y perfiles**. Cuando el mes está definitivo, cada uno firma su parte en **Estados financieros → Firmas** y la firma sale en el PDF y el Word de los estados financieros. El editor no firma (salvo que se ponga `editorFirma: "contador"` en `config.js`), pero puede retirar cualquier firma. Si el mes se reabre como borrador, las firmas se retiran.

Las reglas de `firestore.rules` hacen cumplir esos permisos en el servidor: un perfil de consulta no puede leer lo que no le corresponde ni escribir nada. Al cambiar las reglas, péguelas en **Firebase → Firestore Database → Reglas** y pulse **Publicar**. Para agregar otro editor, añada su correo en `config.js` y en `firestore.rules`.

Para probar los perfiles en modo local, abra la app con `?perfil=consejo`, `?perfil=admin`, `?perfil=revisor` o `?perfil=cartera` al final de la dirección.

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
