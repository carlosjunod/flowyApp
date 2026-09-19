import type { Dictionary } from '../en';

export const app: Dictionary['app'] = {
  nav: {
    inbox: 'Bandeja',
    chat: 'Chat',
    digests: 'Resúmenes',
    settings: 'Ajustes',
    tabPreparing: '{tab}, preparando una respuesta',
    tabUnread: '{tab}, respuesta nueva',
  },
  reader: {
    placeholder: 'Elige un elemento guardado para empezar a leer',
  },
  consentGate: {
    title: 'Usar funciones de IA',
    body: 'Para procesar el contenido guardado y responder en el chat, Flowy envía el texto, las imágenes, los documentos, el audio y las peticiones de chat necesarios a Anthropic, OpenAI y Voyage AI. Solo los procesan para ofrecer estas funciones.',
    review: 'Consulta la Política de Privacidad y los Términos del Servicio en Ajustes.',
    accept: 'Acepto',
    saving: 'Guardando…',
    decline: 'Ahora no — cerrar sesión',
  },
  share: {
    unsupportedTitle: 'No se puede guardar este elemento',
    unsupportedBody: 'Comparte un enlace, una foto, un video, un PDF o un archivo con Flowy.',
    failedTitle: 'No se pudo guardar el elemento',
    failedUnauthorized: 'Tu sesión terminó. Inicia sesión para guardar lo que compartes.',
    failedNetwork: 'Revisa tu conexión e intenta compartirlo de nuevo.',
    unreadableTitle: 'No se pudo leer este elemento',
    unreadableBody:
      'Comprueba que el archivo compartido siga disponible y vuelve a intentarlo.',
  },
};
