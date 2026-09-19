import type { Dictionary } from '../en';

/**
 * Spanish — neutral/international register, informal «tú» to match Flowy's
 * English voice. Regional Spanish (es-419, es-MX, es-ES…) all resolves here, so
 * the wording avoids region-specific idioms on purpose.
 *
 * Glossary decisions, shared with the web client and used consistently across
 * every module:
 *   inbox → «bandeja»            save (noun) → «guardado»
 *   digest → «resumen»           deep dive → «análisis profundo»
 *   settings → «ajustes»         label → «etiqueta»
 *   sign in → «iniciar sesión»   sign up → «crear cuenta»
 *
 * Brand names (Flowy, YouTube, Instagram, Anthropic…) are never translated.
 */
export const common: Dictionary['common'] = {
  brand: {
    name: 'Flowy',
    tagline: 'Una bandeja para todo.',
  },
  actions: {
    save: 'Guardar',
    saving: 'Guardando…',
    saved: 'Guardado',
    cancel: 'Cancelar',
    close: 'Cerrar',
    confirm: 'Confirmar',
    delete: 'Eliminar',
    remove: 'Quitar',
    edit: 'Editar',
    done: 'Listo',
    back: 'Atrás',
    next: 'Siguiente',
    retry: 'Reintentar',
    refresh: 'Actualizar',
    reload: 'Recargar',
    copy: 'Copiar',
    copied: 'Copiado',
    open: 'Abrir',
    openOriginal: 'Abrir original',
    search: 'Buscar',
    clear: 'Limpiar',
    select: 'Seleccionar',
    selectAll: 'Seleccionar todo',
    apply: 'Aplicar',
    add: 'Añadir',
    loadMore: 'Cargar más',
    showMore: 'Ver más',
    showLess: 'Ver menos',
    signIn: 'Iniciar sesión',
    signOut: 'Cerrar sesión',
    getStarted: 'Empezar',
    learnMore: 'Saber más',
    keepEditing: 'Seguir editando',
    discardChanges: 'Descartar los cambios',
    leave: 'Salir',
  },
  states: {
    loading: 'Cargando…',
    working: 'Trabajando…',
    empty: 'Aún no hay nada aquí',
    error: 'Algo salió mal',
    errorRetry: 'Algo salió mal. Inténtalo de nuevo.',
    offline: 'Parece que no tienes conexión.',
    notFound: 'No encontrado',
    unavailable: 'No disponible',
    unknown: 'Desconocido',
    on: 'Activado',
    off: 'Desactivado',
    yes: 'Sí',
    no: 'No',
  },
  errors: {
    UNAUTHORIZED: 'Tu sesión cambió. Inicia sesión de nuevo.',
    FORBIDDEN: 'No tienes acceso a eso.',
    NOT_FOUND: 'Ese elemento ya no está disponible.',
    RATE_LIMITED: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
    NETWORK_ERROR: 'No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.',
    SERVER_ERROR: 'El servidor tuvo un problema. Inténtalo de nuevo.',
    INVALID_INPUT: 'Esa solicitud no era válida. Inténtalo de nuevo.',
    ORIGINAL_REQUIRED:
      'Conserva el original hasta que se extraiga su texto y el elemento esté listo.',
    DEFAULT: 'Algo salió mal. Inténtalo de nuevo.',
  },
  time: {
    justNow: 'ahora mismo',
    minutesAgo: { one: 'hace {count} min', other: 'hace {count} min' },
    hoursAgo: { one: 'hace {count} h', other: 'hace {count} h' },
    daysAgo: { one: 'hace {count} d', other: 'hace {count} d' },
    weeksAgo: { one: 'hace {count} sem', other: 'hace {count} sem' },
    monthsAgo: { one: 'hace {count} mes', other: 'hace {count} meses' },
    yearsAgo: { one: 'hace {count} año', other: 'hace {count} años' },
    today: 'Hoy',
    yesterday: 'Ayer',
    never: 'Nunca',
  },
  counts: {
    items: { zero: 'Sin elementos', one: '{count} elemento', other: '{count} elementos' },
    savedItems: {
      zero: 'Sin elementos guardados',
      one: '{count} elemento guardado',
      other: '{count} elementos guardados',
    },
    selected: {
      zero: 'Ninguno seleccionado',
      one: '{count} seleccionado',
      other: '{count} seleccionados',
    },
    results: { zero: 'Sin resultados', one: '{count} resultado', other: '{count} resultados' },
    sources: { zero: 'Sin fuentes', one: '{count} fuente', other: '{count} fuentes' },
    categories: {
      zero: 'Sin categorías',
      one: '{count} categoría',
      other: '{count} categorías',
    },
  },
  language: {
    label: 'Idioma',
    selectorLabel: 'Elegir idioma',
    change: 'Cambiar idioma',
    // Language names stay in their own language in both locales, so someone who
    // landed in the wrong one can still recognise the way out.
    english: 'English',
    spanish: 'Español',
    automatic: 'Automático',
    automaticDetected: 'Automático ({detected})',
    followsDevice: 'Sigue el idioma de tu dispositivo hasta que elijas uno.',
    interfaceOnly:
      'Esto solo cambia la interfaz. Tu contenido guardado, tus notas y las respuestas de Flowy conservan el idioma en el que se escribieron.',
    digestNote:
      'El idioma de tus informes de resumen se configura aparte, en los ajustes de Resúmenes.',
  },
  theme: {
    label: 'Apariencia',
    light: 'Claro',
    dark: 'Oscuro',
    system: 'Sistema',
    systemHint: '«Sistema» sigue la apariencia configurada en tu dispositivo.',
    toggle: 'Cambiar tema',
  },
  a11y: {
    externalLink: 'Se abre en tu navegador',
    loading: 'Cargando',
    dismiss: 'Descartar',
    menu: 'Menú',
    charactersUsed: '{used} de {limit} caracteres',
  },
};
