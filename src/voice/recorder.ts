import { VoiceConnection, EndBehaviorType } from '@discordjs/voice';
import { createWriteStream, mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs';
import path from 'path';
import prism from 'prism-media';
import ffmpeg from 'fluent-ffmpeg';

export interface StopSessionResult {
  mp3Files: string[];
  mixedMp3Path?: string;
  duration: number;
  participants: string[];
  folderPath: string;
}

interface UserSession {
  pcmPath: string;
  writeStream: ReturnType<typeof createWriteStream>;
  opusStream: ReturnType<VoiceConnection['receiver']['subscribe']>;
  cleaned: boolean; // Bug 4 fix: evita double-cleanup
}

interface GuildSession {
  connection: VoiceConnection;
  guildId: string;
  startTime: number;
  folderPath: string;
  mixedMp3Path: string;
  active: boolean;
  finished: boolean;
  users: Map<string, UserSession>;
  finishedPcms: string[]; // PCMs cujos writeStreams já fecharam
}

export class VoiceRecorder {
  private recordingsPath: string;
  private sessions: Map<string, GuildSession> = new Map();

  constructor() {
    this.recordingsPath = process.env.STORAGE_PATH || './recordings';
    if (!existsSync(this.recordingsPath)) {
      mkdirSync(this.recordingsPath, { recursive: true });
    }
  }

  public startSession(connection: VoiceConnection, guildId: string): GuildSession {
    const ts        = new Date().toISOString().replace(/[:.]/g, '-');
    const dayFolder = new Date().toISOString().split('T')[0];
    const folderPath = path.join(this.recordingsPath, dayFolder, `session-${ts}`);

    mkdirSync(folderPath, { recursive: true });

    const session: GuildSession = {
      connection,
      guildId,
      startTime: Date.now(),
      folderPath,
      mixedMp3Path: path.join(folderPath, `mixed-${ts}.mp3`),
      active: true,
      finished: false,
      users: new Map(),
      finishedPcms: [],
    };

    this.sessions.set(guildId, session);

    connection.receiver.speaking.on('start', (userId: string) => {
      if (!session.active || session.finished) return;
      if (session.users.has(userId)) return;
      this.subscribeUser(session, userId);
    });

    return session;
  }

  private subscribeUser(session: GuildSession, userId: string) {
    const filePath  = path.join(session.folderPath, `${userId}.pcm`);
    const writeStream = createWriteStream(filePath, { flags: 'a' }); // 'a' = append — sessões de fala do mesmo user se acumulam

    const opusStream = session.connection.receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.AfterSilence, duration: 1500 },
    });

    const decoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });

    opusStream.pipe(decoder).pipe(writeStream, { end: false }); // 'end: false' — não fecha o writeStream quando o pipe termina, para suportar append de múltiplos segmentos

    const userSession: UserSession = { pcmPath: filePath, writeStream, opusStream, cleaned: false };
    session.users.set(userId, userSession);

    const onEnd = () => {
      // Bug 4 fix: flag 'cleaned' garante que só executa uma vez,
      // mesmo que 'end' e 'close' disparem juntos
      if (userSession.cleaned) return;
      userSession.cleaned = true;

      try { opusStream.destroy(); } catch {}
      session.users.delete(userId);

      // Bug 5 fix: armazena o PCM na lista de finalizados SÓ quando o
      // writeStream fechar de verdade — evita converter arquivo incompleto
      writeStream.end(() => {
        if (existsSync(filePath)) {
          session.finishedPcms.push(filePath);
        }
      });
    };

    opusStream.on('end',   onEnd);
    opusStream.on('close', onEnd);
    opusStream.on('error', (err: Error) => {
      if (!err.message.includes('Invalid packet')) {
        console.error(`[recorder] opus error user ${userId}:`, err.message);
      }
      onEnd();
    });
  }

  // Bug 1 fix: stopSession agora é async e aguarda os writeStreams fecharem
  // antes de converter os PCMs, garantindo que os arquivos estejam completos
  public async stopSession(guildId: string): Promise<StopSessionResult> {
    const session = this.sessions.get(guildId);

    if (!session) throw new Error(`Sessão não encontrada: ${guildId}`);
    if (session.finished) throw new Error(`Sessão já finalizada: ${guildId}`);

    session.active   = false;
    session.finished = true;

    const duration     = Math.floor((Date.now() - session.startTime) / 1000);
    const participants = Array.from(session.users.keys());

    // Encerra streams ainda abertas e espera os writeStreams fecharem
    const closePromises = [...session.users.entries()].map(([userId, user]) => {
      return new Promise<void>(resolve => {
        if (user.cleaned) { resolve(); return; }
        user.cleaned = true;
        try { user.opusStream.destroy(); } catch {}
        session.users.delete(userId);
        user.writeStream.end(() => {
          if (existsSync(user.pcmPath)) {
            session.finishedPcms.push(user.pcmPath);
          }
          resolve();
        });
      });
    });

    await Promise.all(closePromises);

    // Pequeno buffer para garantir flush do SO
    await new Promise(r => setTimeout(r, 300));

    // Bug 2 + 3 fix: converte todos os PCMs para MP3 agora que os arquivos
    // estão completos e fechados
    const mp3Files: string[] = [];
    const uniquePcms = [...new Set(session.finishedPcms)]; // dedup

    for (const pcmPath of uniquePcms) {
      if (!existsSync(pcmPath)) continue;
      const mp3Path = pcmPath.replace('.pcm', '.mp3');
      try {
        await this.convertPcmToMp3(pcmPath, mp3Path);
        mp3Files.push(mp3Path);
      } catch (err) {
        console.error('[recorder] conversão falhou:', pcmPath, err);
      }
    }

    this.sessions.delete(guildId);

    return {
      mp3Files,
      mixedMp3Path: session.mixedMp3Path,
      duration,
      participants,
      folderPath: session.folderPath,
    };
  }

  private convertPcmToMp3(pcmPath: string, mp3Path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(pcmPath)
        .inputFormat('s16le')
        .inputOptions(['-ar 48000', '-ac 2'])
        .audioCodec('libmp3lame')
        .audioBitrate('128k')
        .on('end', () => {
          console.log(`[recorder] MP3: ${path.basename(mp3Path)}`);
          try { unlinkSync(pcmPath); } catch {}
          resolve();
        })
        .on('error', (err: Error) => {
          console.error('[recorder] ffmpeg:', err.message);
          reject(err);
        })
        .save(mp3Path);
    });
  }

  public async mixToSingle(files: string[], output: string): Promise<void> {
    if (files.length === 0) return;
    if (files.length === 1) {
      const { copyFileSync } = await import('fs');
      copyFileSync(files[0], output);
      return;
    }

    return new Promise((resolve, reject) => {
      const cmd = ffmpeg();
      for (const f of files) cmd.input(f);

      cmd
        .complexFilter([`amix=inputs=${files.length}:duration=longest:normalize=0`])
        .audioCodec('libmp3lame')
        .audioBitrate('128k')
        .on('end', () => {
          console.log(`[recorder] mix: ${path.basename(output)}`);
          resolve();
        })
        .on('error', (err: Error) => {
          console.error('[recorder] mix error:', err.message);
          reject(err);
        })
        .save(output);
    });
  }
}

