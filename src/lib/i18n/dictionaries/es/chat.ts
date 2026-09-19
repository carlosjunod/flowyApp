import type { Dictionary } from '../en';

/**
 * `errors.*` mirrors the web client's `es/chat.ts` word for word: both
 * platforms render the same `chatErrorKey()` output, and a user who switches
 * device should not see two different explanations of the same failure.
 */
export const chat: Dictionary['chat'] = {
  page: {
    title: 'Chat',
    loadingConversations: 'Cargando conversaciones…',
    loadEarlier: 'Cargar mensajes anteriores',
    goToLatest: 'Ir a lo último',
    newChat: 'Chat nuevo',
    history: 'Historial de chats',
    closeHistory: 'Cerrar el historial de chats',
    preparingElsewhere: 'Se está preparando una respuesta en otro chat. Ver',
    stop: 'Detener',
    retrySaving: 'Reintentar el guardado',
    retryLoading: 'Reintentar la carga',
  },
  empty: {
    heading: 'Encuentra una idea que guardaste.',
    body: 'Pregunta por tu contenido guardado. Sigue las fuentes para ver de dónde sale cada respuesta.',
    title: 'Pregunta lo que quieras sobre',
    titleAccent: 'tu contenido guardado',
    subtitle:
      'Flowy busca en todos los artículos, capturas, videos y recibos que has compartido.',
    promptRediscover: 'Ayúdame a redescubrir algo que guardé hace poco',
    promptTopics: '¿Qué temas aparecen en mi contenido guardado?',
    promptSummarize: 'Resume mis guardados más recientes',
  },
  composer: {
    label: 'Mensaje',
    placeholder: 'Pregunta por tu contenido guardado…',
    send: 'Enviar mensaje',
    stop: 'Detener la respuesta',
    stopShort: 'Detener',
    cancelConnecting: 'Cancelar la conexión',
    connecting: 'Conectando… Toca para cancelar.',
    blocked: 'Termina o detén la otra respuesta antes de enviar.',
  },
  message: {
    assistant: 'Flowy',
    assistantTag: '· IA',
    writing: 'Escribiendo…',
    preparing: 'Preparando la respuesta…',
    stopped: 'Respuesta detenida. Puedes reintentarlo cuando quieras.',
    failed: 'No se pudo completar esta respuesta. Inténtalo de nuevo.',
    copy: 'Copiar',
    copied: 'Copiado',
    copyFailed: 'No se pudo copiar, reintenta',
    retry: 'Reintentar',
    retryResponse: 'Reintentar la respuesta',
    sources: 'Fuentes',
    relatedSaves: 'Guardados relacionados',
    untitled: 'Guardado sin título',
    savedSource: 'Fuente guardada',
    openSource: 'Abrir la fuente {index}: {title}',
    openSavedItem: 'Abrir el elemento guardado: {title}',
    openSourceIndexed: 'Abrir la fuente {index}: {title}, {domain}',
    openSavedItemDomain: 'Abrir el elemento guardado: {title}, {domain}',
    railLabel: '{label}, {count}',
    railSummary: '{label} · {count}',
    viewSources: {
      one: 'Ver {count} fuente en la bandeja ↗',
      other: 'Ver {count} fuentes en la bandeja ↗',
    },
    viewRelated: {
      one: 'Ver {count} guardado relacionado en la bandeja ↗',
      other: 'Ver {count} guardados relacionados en la bandeja ↗',
    },
  },
  history: {
    label: 'Historial de chats',
    close: 'Cerrar el historial de chats',
    newChat: 'Chat nuevo',
    chats: 'Chats',
    empty: 'Tus conversaciones aparecerán aquí.',
    newConversation: 'Conversación nueva',
    draft: 'Borrador',
    preparingResponse: 'Preparando la respuesta…',
    deleteNamed: 'Eliminar la conversación {title}',
    deleteTitle: '¿Eliminar la conversación?',
    deleteBody: 'Esto la elimina de todos tus dispositivos.',
    delete: 'Eliminar',
    cancel: 'Cancelar',
    synced: 'Chats guardados en tu cuenta. Los borradores se quedan en este dispositivo.',
    localOnly: 'Hay una copia local disponible. Conéctate para sincronizar tus chats.',
  },
  inboxChat: {
    ask: 'Pregúntale a Flowy',
    askReady: 'Pregúntale a Flowy, respuesta lista',
    panelLabel: 'Chat de Flowy',
    minimize: 'Minimizar el chat',
    openFull: 'Abrir el chat completo',
    backToInbox: 'Volver a la bandeja',
    results: {
      one: 'Resultados del chat · {count}',
      other: 'Resultados del chat · {count}',
    },
    sourcesAvailable:
      '{count} de {total} fuentes disponibles. Tus otros filtros de la bandeja están en pausa.',
    sourcesLoadFailed:
      'No se pudieron cargar estas fuentes. Revisa tu conexión e inténtalo de nuevo.',
    sourcesEmpty:
      'Estas fuentes ya no están disponibles en tu biblioteca. Vuelve a tu bandeja o prueba con otra respuesta.',
    retry: 'Reintentar',
  },
  digestSeed: {
    title: 'Sobre tu resumen',
    sourceDraft: 'Ayúdame a entender esta fuente.',
    digestDraft: '¿Qué debería recordar de este resumen?',
  },
  errors: {
    CHAT_BUSY:
      'Ya se está preparando una respuesta en otro dispositivo. Actualiza para verla.',
    REVISION_CONFLICT:
      'Esta conversación cambió en otro dispositivo. Revisa los últimos mensajes y vuelve a enviar.',
    REQUEST_EXISTS:
      'Esta pregunta ya se recibió. Actualiza para ver su respuesta guardada.',
    CHAT_DELETED: 'Esta conversación se eliminó. Empieza un chat nuevo para continuar.',
    NOT_FOUND:
      'No se encontró esta conversación. Tu copia local se conserva. Actualiza e inténtalo de nuevo.',
    CHAT_HISTORY_UNAVAILABLE:
      'La sincronización de chats aún no está disponible en este servidor. Tus chats locales se conservan.',
    CHAT_TIMEOUT:
      'La conexión tardó demasiado. Tu borrador se conserva. Inténtalo de nuevo.',
    UNAUTHORIZED: 'Tu sesión expiró. Inicia sesión de nuevo para sincronizar tus chats.',
    BODY_TOO_LARGE:
      'No se pudo importar este chat local porque supera el formato o el tamaño admitidos. Tu copia local se conserva.',
    DEFAULT:
      'La sincronización del chat no pudo terminar. Tu copia local está disponible; reconéctate y reinténtalo.',
    storageWrite:
      'Este dispositivo no pudo guardar su copia local del chat. Mantén la app abierta y reinténtalo.',
    storageRead:
      'No se pudieron cargar los chats guardados. Reinténtalo para proteger tus conversaciones existentes.',
    tooLong: 'Mantén tu pregunta por debajo de 16 000 caracteres.',
  },
};
