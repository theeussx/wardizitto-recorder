// Singleton do Socket.io — importado por qualquer módulo que precise emitir eventos
// sem criar dependência circular com server/index.ts
import { Server } from 'socket.io';

let _io: Server | null = null;

export function setIO(instance: Server) {
  _io = instance;
}

export function getIO(): Server {
  if (!_io) throw new Error('Socket.io não foi inicializado ainda');
  return _io;
}

