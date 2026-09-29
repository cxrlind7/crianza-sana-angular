const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string | null | undefined): boolean {
  return !!email && EMAIL_PATTERN.test(email.trim());
}

/** Traduce los códigos de error de Firebase Auth a mensajes para el usuario. */
export function getAuthErrorMessage(error: unknown, mode: 'login' | 'register'): string {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      // Firebase ya no distingue usuario inexistente de contraseña incorrecta.
      return 'Correo o contraseña incorrectos.';
    case 'auth/invalid-email':
      return 'Correo no válido.';
    case 'auth/email-already-in-use':
      return 'Este correo ya está en uso.';
    case 'auth/weak-password':
      return 'La contraseña es muy débil. Usa al menos 6 caracteres.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
    case 'auth/network-request-failed':
      return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.';
    case 'auth/user-disabled':
      return 'Esta cuenta está deshabilitada.';
    default:
      return mode === 'login' ? 'No se pudo iniciar sesión. Inténtalo de nuevo.' : 'No se pudo crear la cuenta. Inténtalo de nuevo.';
  }
}
