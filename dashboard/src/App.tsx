import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Mic, Users, HardDrive, Play, Download, Search,
  Pause, RefreshCw, Radio, Clock, AlertCircle, X,
  Volume2, ChevronDown, ChevronUp
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

// Bug 1 fix: API_URL via variável de ambiente — funciona em dev e produção/VPS
const API_URL = import.meta.env.VITE_API_URL ?? `${window.location.protocol}//${window.location.hostname}:3001/api`;
const WS_URL  = import.meta.env.VITE_WS_URL  ?? `${window.location.protocol}//${window.location.hostname}:3001`;

// ─── tipos ────────────────────────────────────────────────────────────────────
interface Recording {
  id: number;
  filename: string;
  date: string;
  duration: number;
  size: number;
  participants: string;
  guild_id: string;
  channel_id: string;
}

interface Stats {
  totalRecordings: number;
  totalUsers: number;
  storageUsed: string;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

// Bug 9 fix: formata segundos em mm:ss ou hh:mm:ss
function formatDuration(secs: number): string {
  if (!secs || secs < 0) return '0:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Bug 10 fix: JSON.parse seguro
function parseParticipants(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── componente de toast de erro ─────────────────────────────────────────────
function ErrorToast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-red-900/90 border border-red-700 text-red-100 px-4 py-3 rounded-lg shadow-2xl backdrop-blur-sm animate-fade-in">
      <AlertCircle size={18} className="text-red-400 shrink-0" />
      <span className="text-sm">{msg}</span>
      <button onClick={onClose} className="ml-2 text-red-400 hover:text-red-200 transition-colors">
        <X size={16} />
      </button>
    </div>
  );
}

// ─── linha de gravação com player embutido ────────────────────────────────────
function RecordingRow({ rec }: { rec: Recording }) {
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying]   = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const participants = parseParticipants(rec.participants);

  // Bug 3 + 4 fix: Play real via <audio> e Download real via link da API
  const audioSrc = `${API_URL}/recordings/file/${encodeURIComponent(rec.filename)}`;

  function togglePlay() {
    if (!audioRef.current) {
      audioRef.current = new Audio(audioSrc);
      audioRef.current.ontimeupdate = () => {
        const a = audioRef.current!;
        setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0);
      };
      audioRef.current.onended = () => { setPlaying(false); setProgress(0); };
      audioRef.current.onerror = () => { setPlaying(false); };
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().catch(() => setPlaying(false));
      setPlaying(true);
    }
  }

  function handleDownload() {
    const a = document.createElement('a');
    a.href = audioSrc;
    a.download = rec.filename;
    a.click();
  }

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  return (
    <>
      <tr
        onClick={() => setExpanded(v => !v)}
        className="border-b border-[#21262d] hover:bg-[#1c2128] transition-colors cursor-pointer select-none"
      >
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <Volume2 size={14} className="text-indigo-400 shrink-0" />
            <span className="font-mono text-sm text-gray-200 truncate max-w-[200px]" title={rec.filename}>
              {rec.filename}
            </span>
          </div>
        </td>
        <td className="py-3 px-4 text-gray-400 text-sm whitespace-nowrap">{formatDate(rec.date)}</td>
        <td className="py-3 px-4 text-gray-400 text-sm">
          <div className="flex items-center gap-1">
            <Clock size={12} />
            {formatDuration(rec.duration)}
          </div>
        </td>
        <td className="py-3 px-4">
          <span className="text-xs bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/20">
            {participants.length} usuário{participants.length !== 1 ? 's' : ''}
          </span>
        </td>
        <td className="py-3 px-4 text-right">
          <div className="flex justify-end items-center gap-1">
            <button
              onClick={e => { e.stopPropagation(); togglePlay(); }}
              className={`p-2 rounded transition-colors ${playing ? 'bg-indigo-500/30 text-indigo-300' : 'hover:bg-indigo-500/20 text-indigo-400'}`}
              title="Reproduzir"
            >
              {playing ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <button
              onClick={e => { e.stopPropagation(); handleDownload(); }}
              className="p-2 hover:bg-green-500/20 text-green-400 rounded transition-colors"
              title="Baixar MP3"
            >
              <Download size={15} />
            </button>
            <span className="text-gray-600 ml-1">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          </div>
        </td>
      </tr>

      {/* Linha expandida com barra de progresso e IDs */}
      {expanded && (
        <tr className="bg-[#161b22] border-b border-[#21262d]">
          <td colSpan={5} className="px-4 py-3">
            {/* barra de progresso do áudio */}
            <div className="w-full bg-[#21262d] rounded-full h-1 mb-3">
              <div
                className="bg-indigo-500 h-1 rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex gap-6 text-xs text-gray-500">
              <span><span className="text-gray-400">Guild:</span> {rec.guild_id}</span>
              <span><span className="text-gray-400">Canal:</span> {rec.channel_id}</span>
              <span><span className="text-gray-400">IDs:</span> {participants.join(', ') || 'N/A'}</span>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── app principal ────────────────────────────────────────────────────────────
export default function App() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [stats, setStats]     = useState<Stats>({ totalRecordings: 0, totalUsers: 0, storageUsed: '—' });
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [isLive, setIsLive]   = useState(false); // Bug 11: indica gravação ativa via WS
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const socketRef = useRef<Socket | null>(null);

  // Bug 6 fix: tratamento de erro real com toast
  const showError = (msg: string) => setError(msg);

  const fetchData = useCallback(async () => {
    try {
      const [recsRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/recordings`),
        fetch(`${API_URL}/stats`),
      ]);
      if (!recsRes.ok || !statsRes.ok) throw new Error('Resposta inválida do servidor');
      const [recs, st] = await Promise.all([recsRes.json(), statsRes.json()]);
      setRecordings(recs);
      setStats(st);
      setLastRefresh(new Date());
    } catch (e: any) {
      showError(e?.message ?? 'Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Bug 7 fix: auto-refresh a cada 30s
    const interval = setInterval(fetchData, 30_000);

    // Bug 12 fix: WebSocket realmente conectado e usado
    const socket = io(WS_URL, { transports: ['websocket'], reconnectionAttempts: 5 });
    socketRef.current = socket;

    socket.on('recording:start', () => { setIsLive(true); fetchData(); });
    socket.on('recording:stop',  () => { setIsLive(false); fetchData(); });
    socket.on('connect_error',   () => showError('WebSocket: não foi possível conectar ao servidor'));

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, [fetchData]);

  // Bug 2 fix: busca realmente filtra os dados
  const filtered = recordings.filter(r =>
    search === '' ||
    r.filename.toLowerCase().includes(search.toLowerCase()) ||
    r.guild_id.includes(search) ||
    r.channel_id.includes(search)
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0e14] text-gray-100 font-sans">

      {/* ── Nav ── */}
      <nav className="bg-[#161b22] border-b border-[#21262d] px-6 py-3 flex justify-between items-center sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-indigo-500/15 rounded-lg">
            <Mic size={20} className="text-indigo-400" />
          </div>
          <span className="font-semibold text-base tracking-tight">Discord Recorder</span>
          {/* Bug 11 fix: badge ao vivo via WebSocket */}
          {isLive && (
            <span className="flex items-center gap-1.5 text-xs bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full animate-pulse">
              <Radio size={11} />
              AO VIVO
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Atualizado {lastRefresh.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          <button
            onClick={() => { setLoading(true); fetchData(); }}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-gray-200"
            title="Atualizar"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </nav>

      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">

        {/* Bug 5 fix: loading state ── */}
        {loading && recordings.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-gray-600">
            <RefreshCw size={28} className="animate-spin mb-3 text-indigo-500/50" />
            <span className="text-sm">Carregando dados...</span>
          </div>
        )}

        {!loading && (
          <>
            {/* ── Stats ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {[
                {
                  icon: <Mic size={18} />,
                  label: 'Total de Gravações',
                  value: stats.totalRecordings,
                  color: 'indigo',
                },
                {
                  icon: <Users size={18} />,
                  label: 'Usuários Monitorados',
                  value: stats.totalUsers,
                  color: 'green',
                },
                {
                  icon: <HardDrive size={18} />,
                  label: 'Espaço Utilizado',
                  value: stats.storageUsed,
                  color: 'orange',
                },
              ].map(card => (
                <div
                  key={card.label}
                  className="bg-[#161b22] border border-[#21262d] rounded-xl p-5 flex items-center gap-4"
                >
                  <div className={`p-2.5 rounded-lg bg-${card.color}-500/10 text-${card.color}-400`}>
                    {card.icon}
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-0.5">{card.label}</p>
                    <p className="text-2xl font-bold leading-none">{card.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Tabela ── */}
            <div className="bg-[#161b22] border border-[#21262d] rounded-xl overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-[#21262d]">
                <h2 className="font-semibold text-base">Gravações</h2>
                {/* Bug 2 fix: busca funcional */}
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={15} />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por arquivo, guild, canal..."
                    className="w-full bg-[#0b0e14] border border-[#21262d] rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-indigo-500/60 placeholder-gray-600 transition-colors"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-[#21262d]">
                      <th className="py-3 px-4 font-medium">Arquivo</th>
                      <th className="py-3 px-4 font-medium">Data</th>
                      <th className="py-3 px-4 font-medium">Duração</th>
                      <th className="py-3 px-4 font-medium">Participantes</th>
                      <th className="py-3 px-4 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(rec => (
                      <RecordingRow key={rec.id} rec={rec} />
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-16 text-center text-gray-600">
                          {search
                            ? `Nenhuma gravação encontrada para "${search}"`
                            : 'Nenhuma gravação registrada ainda.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {filtered.length > 0 && (
                <div className="px-5 py-3 border-t border-[#21262d] text-xs text-gray-600 text-right">
                  {filtered.length} de {recordings.length} gravação(ões)
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <footer className="px-6 py-4 text-center text-gray-600 text-xs border-t border-[#21262d]">
        Discord Recorder System &copy; 2026
      </footer>

      {/* Bug 6 fix: toast de erro */}
      {error && <ErrorToast msg={error} onClose={() => setError(null)} />}
    </div>
  );
}
