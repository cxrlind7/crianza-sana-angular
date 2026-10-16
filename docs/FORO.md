# Foro para padres

Ruta pública: `/foro` (lista) y `/foro/:id` (conversación). Moderación: Configuración → **Foro de padres**.

## Cómo funciona

- **Leer** es libre: cualquiera ve las preguntas y respuestas **aprobadas**.
- **Publicar** pide una cuenta con el **correo verificado** (registro normal del sitio en `/login`).
- Todo lo que envía un padre entra como **pendiente** y no se ve hasta que un admin lo aprueba.
  Lo que publica una cuenta admin sale aprobado y firmado como "Equipo Crianza Sana".
- La persona ve el estado de lo que envió en "Mis publicaciones" (en revisión, publicada o no publicada con el motivo).
- Se puede publicar como "Mamá o papá anónimo": el nombre no se muestra, pero el admin sí ve la cuenta.
- Cualquier cuenta puede **reportar** un mensaje; aparece en la pestaña "Reportados".

## Comentarios de blogs, programas y galería

Antes se escribían desde el navegador directo a Firestore; con las reglas vencidas (23/02/2026) dejaron
de funcionar sin avisar. Ahora van por `POST /api/foro/comentarios` con las mismas reglas que el foro:
cuenta verificada, límites, anti-spam y **moderación** (aparecen en Configuración → Foro y comentarios).
Los comentarios viejos (sin campo `estado`) se siguen mostrando; los nuevos solo cuando se aprueban.

Campos nuevos en `…/comments/{id}`: `estado`, `userEmail`, `alertas[]`, `motivo`, `contexto { tipo, titulo, enlace }`.

## Anti-spam (utils/foro.js)

| Medida | Detalle |
|---|---|
| Cuenta verificada | Sin correo verificado no se puede publicar. |
| Moderación previa | Nada se publica sin aprobación. |
| Trampa para bots | Campo oculto `sitioWeb`; si llega lleno, se finge éxito y no se guarda. |
| Tiempo mínimo | Formularios enviados en menos de 3 s se rechazan. |
| Límites por cuenta | 30 s entre publicaciones, 10 al día, máximo 5 en revisión a la vez. |
| Límite por conexión | 20 publicaciones por hora por IP. |
| Contenido | Longitudes mínimas y máximas, máximo 2 enlaces, sin enlaces en el título, sin caracteres repetidos. |
| Alertas | Palabras sensibles, mayúsculas sostenidas o enlaces: se marcan para que el admin revise con atención. |
| Bloqueo | El admin puede bloquear una cuenta; ya no podrá publicar. |
| Texto plano | Se quita cualquier HTML; los mensajes se muestran como texto. |

## Colecciones de Firestore

Solo el servidor (Admin SDK) lee y escribe estas colecciones; ver `firestore.rules`.

### `foroHilos/{id}`
`titulo`, `cuerpo`, `categoria` (`sueno` · `alimentacion` · `emociones` · `desarrollo` · `salud` · `escuela` · `familia` · `otro`),
`autor { uid, email, nombre, foto, rol: 'padre' | 'equipo', anonimo }`, `estado` (`pendiente` · `aprobado` · `rechazado`),
`motivo`, `alertas[]`, `reportes`, `reportadoPor[]`, `respuestas` (aprobadas), `respondidoPorEquipo`, `fijado`, `cerrado`,
`creadoEn`, `ultimaActividad`, `moderadoEn`, `moderadoPor`.

### `foroRespuestas/{id}`
`hiloId`, `hiloTitulo`, `cuerpo`, `autor {…}`, `estado`, `motivo`, `alertas[]`, `reportes`, `reportadoPor[]`, `creadoEn`, `moderadoEn`, `moderadoPor`.

### `foroUsuarios/{uid}`
`nombre`, `email`, `bloqueado`, `ultimaPublicacion`, `dia`, `publicacionesDia`, `publicacionesTotal`.

Las consultas usan solo filtros de igualdad y se ordenan en memoria, así que **no hace falta crear índices compuestos**.

## API

| Método | Ruta | Quién |
|---|---|---|
| GET | `/api/foro/hilos` | Público (solo aprobados) |
| GET | `/api/foro/hilos/:id` | Público (hilo y respuestas aprobadas) |
| POST | `/api/foro/hilos` | Cuenta verificada |
| POST | `/api/foro/hilos/:id/respuestas` | Cuenta verificada |
| GET | `/api/foro/mis-publicaciones` | Cuenta |
| POST | `/api/foro/reportar` | Cuenta |
| GET | `/api/foro/admin/moderacion?estado=` | Admin |
| GET | `/api/foro/admin/pendientes-total` | Admin |
| POST | `/api/foro/admin/moderar` | Admin (`aprobar`, `rechazar`, `eliminar`, `fijar`, `desfijar`, `cerrar`, `abrir`, `descartar-reportes`) |
| POST | `/api/foro/admin/bloquear` | Admin |
| POST | `/api/foro/comentarios` | Cuenta verificada (`tipo`: `blog` · `programa` · `foto`) |
| POST | `/api/foro/comentarios/borrar` | Autor del comentario o admin |
