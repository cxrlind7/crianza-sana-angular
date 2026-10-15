/**
 * Saca una miniatura (JPG) de un video local, para no pedirle al admin que suba una aparte.
 * Toma el cuadro en el segundo 1 (o a la mitad si el video dura menos). Si el navegador no
 * puede decodificar el video (p. ej. HEVC de iPhone en Chrome), regresa null.
 */
export function captureVideoPoster(file: File): Promise<{ poster: File; width: number; height: number; duration: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = url;

    const done = (value: { poster: File; width: number; height: number; duration: number } | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => done(null), 15000);

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, (video.duration || 2) / 2);
    };
    video.onseeked = () => {
      clearTimeout(timer);
      const canvas = document.createElement('canvas');
      // Máximo 720 px de lado: suficiente para la miniatura y ligera.
      const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return done(null);
          const name = file.name.replace(/\.[^.]+$/, '') + '-miniatura.jpg';
          done({
            poster: new File([blob], name, { type: 'image/jpeg' }),
            width: video.videoWidth,
            height: video.videoHeight,
            duration: video.duration,
          });
        },
        'image/jpeg',
        0.8,
      );
    };
    video.onerror = () => {
      clearTimeout(timer);
      done(null);
    };
  });
}
