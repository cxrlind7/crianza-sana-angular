# Pendientes

Lista viva de lo que falta. Al terminar algo, se borra de aquí.

## Propuestas en curso (en orden)

- [x] 1. Ocultar a Paty, Andrea y Karen (`0fc6a65`)
- [x] 2. Cómo nos encontró + analytics para todo (`d03bb05`)
- [x] 3. Videos en perfiles: "Conociendo a…", su espacio/negocio y clips educativos (`ea87d5d`)
- [x] 4. Perfil tipo Doctoralia + ficha técnica / tarjeta digital descargable
  - [ ] Pedir a cada especialista: cédula profesional, formación, años de experiencia, a quién atiende, modalidad (presencial / en línea) y horario. Se capturan en `ficha` de `core/data/people-data.ts`.
- [ ] 5. Colaboradores temporales o permanentes (patrocinio): pasar especialistas a Firestore para darlos de alta desde Configuración
- [x] 6. Calendario unificado en Configuración: efemérides, días festivos y programar blogs, eventos, programas y galerías
- [x] 7. Foro / sección para padres con revisión antes de publicar (ver `docs/FORO.md`)
  - [ ] Publicar `firestore.rules` en Firebase (las reglas actuales vencieron el 23/02/2026).
  - [ ] Probar con una cuenta real de padre/madre: registro, verificación de correo, pregunta y "Mis publicaciones".
  - [ ] Idea: avisar por correo al admin cuando haya mensajes por aprobar.

## Arreglos y deuda técnica

- **Proteger `/analytics`**: guard de admin en la ruta, `requireAdmin` en los endpoints de GA y usar `HttpClient` en vez de `fetch`.
- **Archivos huérfanos en R2.** Al borrar o reemplazar un video de especialista, o al borrar una foto o un álbum de galería, solo se borra el registro de Firestore; los archivos se quedan en R2 ocupando espacio. El servidor debería borrarlos también (solo si la URL es del bucket propio).
- **Panel de analytics lento**: `/api/firestore/blogs` pesa ~718 KB (6–10 s). Hacer un endpoint ligero solo con los campos que usa la tabla.
- **Spotify 403** ("Active premium subscription required for the owner of the app"): la cuenta dueña de la app de Spotify necesita Premium o cambiar de app.
- **`.env` local**: `FIREBASE_SERVICE_ACCOUNT` es distinta a la de Railway (funciona, pero conviene igualarla).
- **Build: advertencia `dijkstrajs` is not ESM** (dependencia de `qrcode`); se quita agregándolo a `allowedCommonJsDependencies` en `angular.json`.
- **Imágenes del bucket S3 viejo rotas** (`csdkids-images.s3.us-east-2.amazonaws.com` responde 403): fotos de galerías antiguas, avatares por defecto, servicios de Ana Laura y foto de Martha Elena. Hay que copiarlas a R2 y actualizar las URLs.
- **Blogs sin botón de eliminar** en Configuración (solo se pueden editar).
- **Programación del lado del servidor**: lo programado se oculta en el front, pero la API pública sí lo devuelve (alguien técnico podría ver un blog antes de su fecha).
- **Comentarios con muchos documentos**: la moderación lee todos los comentarios (`collectionGroup`) y filtra en memoria. Si crecen mucho, crear un índice de grupo sobre `estado`.
- **Presupuestos del build**: el bundle inicial (1.58 MB) y `gallery.scss` / `programs.scss` pasan el límite configurado.
