import type { Dictionary } from '../en';

export const auth: Dictionary['auth'] = {
  login: {
    subtitle: 'Inicia sesión en tu bandeja',
    submit: 'Iniciar sesión',
    submitting: 'Iniciando sesión…',
    noAccount: '¿No tienes cuenta?',
    createOne: 'Crea una',
    missingCredentials: 'El correo y la contraseña son obligatorios',
    googleUnavailable:
      'El inicio de sesión con Google se está configurando; usa tu correo por ahora.',
  },
  signup: {
    title: 'Crear cuenta',
    subtitle: 'Únete a Flowy',
    submit: 'Crear cuenta',
    submitting: 'Creando cuenta…',
    haveAccount: '¿Ya tienes cuenta?',
    signIn: 'Iniciar sesión',
    missingCredentials: 'El correo y la contraseña son obligatorios',
    passwordTooShort: 'La contraseña debe tener al menos 8 caracteres',
    passwordMismatch: 'Las contraseñas no coinciden',
    termsRequired:
      'Acepta los Términos del Servicio y la Política de Privacidad para crear una cuenta.',
    consentRequired: 'Acepta el aviso sobre el procesamiento con IA para crear una cuenta.',
    failed: 'No se pudo crear la cuenta. Inténtalo de nuevo.',
  },
  fields: {
    email: 'Correo',
    password: 'Contraseña',
    passwordMin: 'Contraseña (mín. 8 caracteres)',
    confirmPassword: 'Confirmar contraseña',
  },
  consent: {
    modalTitle: 'Crea tu cuenta de Flowy',
    modalBody: 'Un paso más antes de crear tu cuenta con {provider}.',
    modalAi: 'Acepto que Flowy envíe el contenido que guarde y mis peticiones de chat a Anthropic, OpenAI y Voyage AI para resumir, transcribir, buscar y responder preguntas.',
    accept: 'Crear cuenta',
    cancel: 'Cancelar',
    termsLabel: 'Aceptar los Términos del Servicio y la Política de Privacidad',
    terms: 'Acepto los Términos del Servicio y la Política de Privacidad.',
    termsLink: 'Términos del Servicio',
    privacyLink: 'Política de Privacidad',
    aiLabel: 'Aceptar el procesamiento con IA',
    ai: 'Acepto que Flowy envíe el contenido que guarde y mis peticiones de chat a Anthropic, OpenAI y Voyage AI para resumir, transcribir, buscar y responder preguntas.',
  },
  social: {
    divider: 'o',
    continueApple: 'Continuar con Apple',
    continueGoogle: 'Continuar con Google',
    signingIn: 'Iniciando sesión…',
    appleUnavailable: 'Inicio de sesión con Apple no disponible',
    appleNoToken: 'Apple no devolvió ningún id_token',
    appleFailed: 'No se pudo iniciar sesión con Apple. Inténtalo de nuevo.',
    googleFailed: 'No se pudo conectar. Inténtalo de nuevo con Google.',
    retryFailed: 'No se pudo conectar. Intenta iniciar sesión de nuevo.',
    errors: {
      notConfigured:
        'El inicio de sesión con {provider} no está disponible en esta versión. Usa tu correo.',
      playServices:
        'El inicio de sesión con {provider} necesita los servicios de Google Play. Actualízalos o actívalos e inténtalo de nuevo.',
      network: 'No se pudo conectar. Revisa tu conexión e inténtalo de nuevo con {provider}.',
      emailInUse:
        'Este correo ya tiene una cuenta. Inicia sesión con tu contraseña o restabléceela primero.',
      expiredToken:
        'El inicio de sesión con {provider} caducó. Vuelve a elegir tu cuenta de {provider}.',
      rateLimited: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
      unknown: 'No se pudo iniciar sesión con {provider}. Inténtalo de nuevo o usa tu correo.',
    },
  },
  registerErrors: {
    EMAIL_TAKEN: 'Ese correo ya está en uso. Prueba a iniciar sesión.',
    INVALID_EMAIL: 'Introduce una dirección de correo válida.',
    WEAK_PASSWORD: 'La contraseña debe tener al menos 8 caracteres.',
    DEFAULT: 'No se pudo crear la cuenta. Inténtalo de nuevo.',
  },
};
