# MONEO+ para Android

App de Google Play que abre https://moneo.plus a pantalla completa en Chrome
(Trusted Web Activity, con `androidbrowserhelper`). Lo que se publica en la web llega a la app
sin sacar una versión nueva. Solo hace falta publicar una versión nueva al cambiar este
proyecto (ícono, colores, permisos o funciones nativas).

- Paquete: `plus.moneo.app`. No se puede cambiar después de la primera subida.
- Abre `/finanzas?source=android`. La web reconoce la app (`src/lib/appShell.ts`) y oculta el
  cobro de MONEO PLUS: Google Play no permite otro medio de pago para planes digitales.
- `public/.well-known/assetlinks.json` vincula el dominio con la app. Debe llevar el SHA-256
  de la llave de subida y el de la **llave de firma de Play**
  (Play Console → Probar y publicar → Configuración → Integridad de la app). Sin él, la app
  muestra la barra de dirección de Chrome.

## Compilar

No hace falta Android Studio: el workflow `.github/workflows/android.yml` compila en GitHub.
- Siempre: un APK de prueba (`moneo-debug-apk`) para instalarlo directo en un teléfono.
- Con los secrets de firma (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
  `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`): el `.aab` firmado para subirlo a Play.
  El `versionCode` es el número de ejecución del workflow, así que cada compilación sirve para
  subirla.

Con Android Studio también se compila en local: abre la carpeta `android/`.

## Material para la ficha de Play

En `store/` están el ícono de 512×512 y un gráfico de funciones básico de 1024×500.
