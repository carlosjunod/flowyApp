# Flowy for Mac — v1.1 (After soft launch)

v1.0 = iOS + Android + webapp. Esta utilidad macOS se incorpora en v1.1.

Abrir `Flowy.xcodeproj`, esquema `FlowyMac`, My Mac. Proyecto SwiftUI independiente de Expo, dos targets: host mínimo y Share Extension. macOS 13+, Intel/Apple Silicon. Configuración, contratos, capabilities, seguridad, pruebas desde Safari/Finder y distribución: [runbook del servidor](../../Flowy/docs/MACOS_SHARE_V1_1.md) (en un worktree, usar `docs/MACOS_SHARE_V1_1.md` del worktree Flowy activo).

```sh
python3 generate-project.py
xcodebuild -project Flowy.xcodeproj -scheme FlowyMac -configuration Release -derivedDataPath /tmp/flowy-mac-build CODE_SIGNING_ALLOWED=NO build
swiftc -parse-as-library Shared/SharedItem.swift Shared/APIConfiguration.swift FlowyShareExtension/SharedItemLoader.swift Tests/LoaderHarness.swift -o /tmp/flowy-mac-loader-test
/tmp/flowy-mac-loader-test
```

La generación solo reemplaza `Flowy.xcodeproj/project.pbxproj` y el esquema compartido. Editar settings persistentes en `generate-project.py`; entitlements y plists son fuentes versionadas. La carpeta macOS no la genera Expo prebuild.

La firma real requiere registrar los nuevos IDs `app.tryflowy.mac` y `app.tryflowy.mac.ShareExtension`, con App Group `group.app.tryflowy` y Keychain Sharing `$(AppIdentifierPrefix)app.tryflowy.mac.shared` en ambos. El equipo está tomado de la configuración nativa existente. No se han creado certificados ni perfiles.

El API base se define en Build Settings de ambos targets (`FLOWY_API_BASE_URL`, HTTPS). El contrato previsto del backend requiere `/mac/connect`, `/api/mac/authorize`, `/api/mac/token`, `/api/mac/capture`; esas rutas aún no están en el main del servidor y deben integrarse/desplegarse antes de usar la app contra ese origen. Ningún token en UserDefaults: Data Protection Keychain compartido. Los temporales son privados de la extensión y se limpian al finalizar/cancelar. No hay cola offline.

Límites iniciales: 10 elementos, 5 MiB por archivo, 256 KiB de texto. Texto se guarda como `.txt`; el procesador genérico actual no indexa su cuerpo. Guardado confirma aceptación/encolado, no finalización AI. La descarga web queda deshabilitada hasta configurar `FLOWY_MAC_DOWNLOAD_URL` con un DMG firmado y notarizado.
