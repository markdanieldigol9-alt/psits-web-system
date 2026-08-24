import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { MainLayout } from '@/shared/layouts';
import { useAuth } from '@/shared/context/AuthContext';
import { useNotification } from '@/shared/context/NotificationContext';
import { Button, Input } from '@/shared/components/Form';
import { LoadingSpinner, Badge } from '@/shared/components/Common';
import logo from '@/assets/image/PSITS_Logo.png';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  PhoneOff,
  Users,
  MessageSquare,
  Layers,
  Tv,
  Trophy,
  Coffee,
  CheckCircle,
} from 'lucide-react';
import api from '@/shared/services/api';
import type { LiveSession } from '@/features/live-events/types/liveSessions';

export type LiveSceneType = 'camera' | 'screen' | 'starting' | 'brb' | 'award' | 'ending';

const SCENES: { id: LiveSceneType; label: string; icon: string; description: string }[] = [
  { id: 'camera', label: 'Camera Scene', icon: '🎥', description: 'Live host camera & microphone feed' },
  { id: 'screen', label: 'Screen Share', icon: '🖥️', description: 'Full screen presentation & demo' },
  { id: 'starting', label: 'Starting Soon', icon: '🎬', description: 'Pre-stream countdown & welcome banner' },
  { id: 'brb', label: 'Be Right Back', icon: '⏸️', description: 'Intermission break overlay' },
  { id: 'award', label: 'Award Ceremony', icon: '🏆', description: 'Special winner announcement overlay' },
  { id: 'ending', label: 'Stream Ending', icon: '🏁', description: 'Session conclusion banner' },
];

const getApiBaseUrl = () => {
  const fromEnv = (import.meta as any)?.env?.VITE_API_URL;
  if (fromEnv) return String(fromEnv).trim();
  const fromGlobal = (globalThis as any).__VITE_API_URL__;
  if (fromGlobal) return String(fromGlobal).trim();
  return window.location.origin;
};

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
  ],
};

export const LiveStudioPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addNotification } = useNotification();

  const [session, setSession] = useState<LiveSession | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);

  // Live Scene Manager State
  const [currentScene, setCurrentScene] = useState<LiveSceneType>('camera');
  const [lowerThirdText, setLowerThirdText] = useState<string>('');
  const [showLowerThird, setShowLowerThird] = useState<boolean>(false);
  const [lowerThirdInput, setLowerThirdInput] = useState<string>('');
  const [showScenePanel, setShowScenePanel] = useState<boolean>(false);

  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<{ [socketId: string]: RTCPeerConnection }>({});

  const isHost = user?.role === 'admin' || user?.role === 'super_admin';

  useEffect(() => {
    if (!sessionId) return;
    const fetchSession = async () => {
      try {
        // This expects sessionId parameter to be either id or sessionId
        const { data } = await api.getLiveEvent(sessionId);
        if (data?.success && data.liveEvent) {
          setSession(data.liveEvent as LiveSession);
        } else {
          setError('Session not found');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load session');
      }
    };
    void fetchSession();
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const loadMessages = async () => {
      try {
        const { data } = await api.getLiveEventChatMessages(sessionId);
        if (data?.success) {
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
      }
    };
    void loadMessages();
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const changeScene = (sceneId: LiveSceneType) => {
    setCurrentScene(sceneId);
    socket?.emit('session:scene-change', {
      sceneId,
      showLowerThird,
      lowerThirdText,
    });
    addNotification({
      userId: 'current',
      title: 'Live Scene Switched',
      message: `Switched stage scene to ${SCENES.find((s) => s.id === sceneId)?.label || sceneId}`,
      type: 'info',
      isRead: false,
    });
  };

  const updateLowerThird = (text: string, show: boolean) => {
    setLowerThirdText(text);
    setShowLowerThird(show);
    socket?.emit('session:scene-change', {
      sceneId: currentScene,
      showLowerThird: show,
      lowerThirdText: text,
    });
  };

  const sendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !socket || !sessionId) return;
    socket.emit('session:chat', { message: chatInput.trim() }, (response: any) => {
      if (response && !response.ok) {
        addNotification({
          userId: 'current',
          title: 'Chat Error',
          message: response.message || 'Failed to send message',
          type: 'error',
          isRead: false,
        });
      }
    });
    setChatInput('');
  };

  const initLocalStream = useCallback(async (video = true, audio = true) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      addNotification({ userId: 'current', title: 'Media Error', message: 'Could not access camera/mic', type: 'error', isRead: false });
      return null;
    }
  }, [addNotification]);

  const replaceTrackInPeers = (oldTrack: MediaStreamTrack | null, newTrack: MediaStreamTrack | null) => {
    Object.values(peersRef.current).forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === (oldTrack ? oldTrack.kind : newTrack?.kind));
      if (sender && newTrack) {
        sender.replaceTrack(newTrack);
      }
    });
  };

  const toggleMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isMicOn;
        setIsMicOn(!isMicOn);
        socket?.emit('session:state', { micEnabled: !isMicOn });
      }
    }
  };

  const toggleCamera = async () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    
    if (isCameraOn) {
      videoTrack.enabled = false;
      videoTrack.stop();
      setIsCameraOn(false);
      socket?.emit('session:state', { cameraEnabled: false });
    } else {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: isMicOn });
        const newVideoTrack = newStream.getVideoTracks()[0];
        
        const currentAudioTrack = localStream.getAudioTracks()[0];
        const combinedStream = new MediaStream([newVideoTrack]);
        if (currentAudioTrack) combinedStream.addTrack(currentAudioTrack);
        
        setLocalStream(combinedStream);
        if (localVideoRef.current) localVideoRef.current.srcObject = combinedStream;
        
        replaceTrackInPeers(videoTrack, newVideoTrack);
        setIsCameraOn(true);
        socket?.emit('session:state', { cameraEnabled: true });
      } catch (err) {
        addNotification({ userId: 'current', title: 'Camera Error', message: 'Could not turn on camera', type: 'error', isRead: false });
      }
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      await toggleCamera();
      setIsScreenSharing(false);
      socket?.emit('session:state', { screenShareEnabled: false });
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        
        screenTrack.onended = () => {
          toggleScreenShare();
        };

        const currentAudioTrack = localStream?.getAudioTracks()[0];
        const combinedStream = new MediaStream([screenTrack]);
        if (currentAudioTrack) combinedStream.addTrack(currentAudioTrack);

        const oldVideoTrack = localStream?.getVideoTracks()[0] || null;
        setLocalStream(combinedStream);
        if (localVideoRef.current) localVideoRef.current.srcObject = combinedStream;

        replaceTrackInPeers(oldVideoTrack, screenTrack);
        setIsScreenSharing(true);
        setIsCameraOn(false);
        socket?.emit('session:state', { screenShareEnabled: true, cameraEnabled: false });
      } catch (err) {
        // user cancelled
      }
    }
  };

  const createPeerConnection = useCallback((targetSocketId: string, currentSocket: Socket, stream: MediaStream | null, initOffer = false) => {
    if (peersRef.current[targetSocketId]) {
      peersRef.current[targetSocketId].close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peersRef.current[targetSocketId] = pc;

    if (stream && isHost) {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        currentSocket.emit('webrtc:ice-candidate', {
          targetSocketId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      if (!isHost && remoteVideoRef.current) {
        if (remoteVideoRef.current.srcObject !== event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      }
    };

    if (initOffer && isHost) {
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          currentSocket.emit('webrtc:offer', {
            targetSocketId,
            description: pc.localDescription,
          });
        })
        .catch(console.error);
    }

    return pc;
  }, [isHost]);

  useEffect(() => {
    if (!session?.id) return;

    let currentStream: MediaStream | null = null;
    const token = localStorage.getItem('auth_token');
    
    const startConnection = async () => {
      if (isHost) {
        currentStream = await initLocalStream(true, true);
      }

      const baseUrl = getApiBaseUrl();
      const socketUrl = baseUrl.startsWith('http') ? baseUrl : window.location.origin;
      const s = io(socketUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
      });

      s.on('connect', () => {
        setIsConnected(true);
        s.emit('session:join', { liveEventId: session.id }, (response: any) => {
          if (!response?.ok) {
            setError(response?.message || 'Failed to join session');
          } else {
            if (isHost && response.peers) {
              response.peers.forEach((peer: any) => {
                if (peer.socketId !== s.id) {
                  createPeerConnection(peer.socketId, s, currentStream, true);
                }
              });
            }
          }
        });
      });

      s.on('session:presence', (payload: any) => {
        setParticipants(payload.participants || []);
      });

      s.on('session:user-joined', (payload: any) => {
        if (isHost && payload.socketId !== s.id) {
          createPeerConnection(payload.socketId, s, currentStream, true);
        }
      });

      s.on('session:user-left', (_payload: any) => {
        // cleanup if needed
      });

      s.on('webrtc:offer', async (payload: any) => {
        if (isHost) return;
        const pc = createPeerConnection(payload.fromSocketId, s, null, false);
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.description));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          s.emit('webrtc:answer', {
            targetSocketId: payload.fromSocketId,
            description: pc.localDescription,
          });
        } catch (err) {
          console.error('Error handling offer:', err);
        }
      });

      s.on('webrtc:answer', async (payload: any) => {
        const pc = peersRef.current[payload.fromSocketId];
        if (pc) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.description));
          } catch (err) {
            console.error('Error setting remote answer:', err);
          }
        }
      });

      s.on('webrtc:ice-candidate', async (payload: any) => {
        const pc = peersRef.current[payload.fromSocketId];
        if (pc) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (err) {
            console.error('Error adding ICE candidate:', err);
          }
        }
      });

      s.on('session:scene-change', (data: any) => {
        if (data?.sceneId) setCurrentScene(data.sceneId);
        if (typeof data?.showLowerThird === 'boolean') setShowLowerThird(data.showLowerThird);
        if (typeof data?.lowerThirdText === 'string') setLowerThirdText(data.lowerThirdText);
      });

      s.on('session:chat', (message: any) => {
        setMessages((prev) => {
          if (prev.some((m) => String(m.id) === String(message.id))) return prev;
          return [...prev, message];
        });
      });

      s.on('disconnect', () => {
        setIsConnected(false);
      });

      setSocket(s);
    };

    startConnection();

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }
      Object.values(peersRef.current).forEach((pc) => pc.close());
      peersRef.current = {};
      socket?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, isHost]);

  if (error) {
    return (
      <MainLayout>
        <div className="flex h-[80vh] items-center justify-center">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">Connection Error</h2>
            <p className="text-gray-600">{error}</p>
            <Button onClick={() => navigate('/live-events')}>Back to Live Events</Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!session) {
    return (
      <MainLayout>
        <div className="flex h-[80vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex h-[calc(100vh-4rem)] flex-col lg:flex-row bg-gray-50">
        
        {/* Main Stage */}
        <div className="flex-1 flex flex-col p-4">
          <div className="flex items-center justify-between mb-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{session.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={session.status === 'live' ? 'error' : 'info'}>{session.status}</Badge>
                {isConnected ? (
                  <Badge variant="success">Connected</Badge>
                ) : (
                  <Badge variant="warning">Connecting...</Badge>
                )}
                {isHost && <Badge variant="primary">Host</Badge>}
              </div>
            </div>
            <div className="text-sm font-medium text-gray-600">
              {participants.length} {participants.length === 1 ? 'Viewer' : 'Viewers'}
            </div>
          </div>

          {/* Host Live Scene Switcher & Lower Third Toolbar */}
          {isHost && (
            <div className="mb-3 bg-white p-3 rounded-2xl shadow-xs border border-gray-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers size={18} className="text-primary" />
                  <span className="text-xs font-extrabold uppercase text-gray-900 tracking-wider">Live Broadcast Scenes</span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full uppercase">
                    Active: {SCENES.find((s) => s.id === currentScene)?.label}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowScenePanel(!showScenePanel)}
                  className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
                >
                  <Tv size={14} /> {showScenePanel ? 'Hide Controls' : 'Lower Third Overlay'}
                </button>
              </div>

              {/* Scene Switcher Buttons */}
              <div className="flex flex-wrap gap-2">
                {SCENES.map((sc) => {
                  const isActive = currentScene === sc.id;
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => changeScene(sc.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-primary text-white shadow-sm ring-2 ring-blue-600 scale-105'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                      title={sc.description}
                    >
                      <span>{sc.icon}</span>
                      <span>{sc.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Lower Third Ticker Form */}
              {showScenePanel && (
                <div className="pt-2 border-t border-gray-150 flex flex-col sm:flex-row items-center gap-2">
                  <Input
                    placeholder="Enter lower-third overlay banner text (e.g. Speaker Name, Announcement)..."
                    value={lowerThirdInput}
                    onChange={(e) => setLowerThirdInput(e.target.value)}
                    className="flex-1 text-xs"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => updateLowerThird(lowerThirdInput.trim(), true)}
                      disabled={!lowerThirdInput.trim()}
                    >
                      Show Overlay
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateLowerThird('', false)}
                      disabled={!showLowerThird}
                    >
                      Hide Overlay
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex-1 bg-black rounded-3xl overflow-hidden relative shadow-lg ring-1 ring-gray-900/5">
            {isHost ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain"
              />
            ) : (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                controls
                className="w-full h-full object-contain"
              />
            )}

            {/* LIVE SCENE OVERLAYS */}
            {currentScene === 'starting' && (
              <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-slate-900 to-black text-white flex flex-col items-center justify-center p-6 text-center z-20">
                <img src={logo} alt="PSITS Logo" className="h-20 w-20 object-contain mb-4 animate-bounce" />
                <span className="px-3 py-1 bg-blue-500/20 border border-blue-400/40 rounded-full text-blue-300 text-xs font-bold uppercase tracking-widest mb-2">
                  Live Stream Session
                </span>
                <h2 className="text-3xl font-extrabold tracking-tight text-white mb-2">{session.title}</h2>
                <p className="text-sm text-gray-300 max-w-md">STARTING SOON • Stay tuned! Broadcast will begin momentarily.</p>
              </div>
            )}

            {currentScene === 'brb' && (
              <div className="absolute inset-0 bg-gradient-to-br from-amber-950 via-slate-900 to-black text-white flex flex-col items-center justify-center p-6 text-center z-20">
                <Coffee size={52} className="text-amber-400 mb-3 animate-pulse" />
                <span className="px-3 py-1 bg-amber-500/20 border border-amber-400/40 rounded-full text-amber-300 text-xs font-bold uppercase tracking-widest mb-2">
                  Intermission Break
                </span>
                <h2 className="text-3xl font-extrabold tracking-tight text-white mb-2">BE RIGHT BACK</h2>
                <p className="text-sm text-gray-300">The session is taking a short break and will resume shortly.</p>
              </div>
            )}

            {currentScene === 'award' && (
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-950 via-amber-950 to-black text-white flex flex-col items-center justify-center p-6 text-center z-20">
                <Trophy size={56} className="text-yellow-400 mb-3 animate-pulse" />
                <span className="px-3 py-1 bg-yellow-500/20 border border-yellow-400/40 rounded-full text-yellow-300 text-xs font-bold uppercase tracking-widest mb-2">
                  Official Award Ceremony
                </span>
                <h2 className="text-3xl font-extrabold text-yellow-300 tracking-tight mb-2">WINNER ANNOUNCEMENT</h2>
                <p className="text-sm text-gray-200">{session.title} — Celebrating Excellence</p>
              </div>
            )}

            {currentScene === 'ending' && (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-black text-white flex flex-col items-center justify-center p-6 text-center z-20">
                <CheckCircle size={48} className="text-green-400 mb-3" />
                <h2 className="text-3xl font-extrabold text-white tracking-tight mb-2">THANK YOU FOR WATCHING</h2>
                <p className="text-sm text-gray-300">This PSITS live stream session has officially concluded.</p>
              </div>
            )}

            {/* LOWER THIRD OVERLAY BANNER */}
            {showLowerThird && lowerThirdText && (
              <div className="absolute bottom-6 left-6 right-6 z-30">
                <div className="bg-gradient-to-r from-primary via-blue-900 to-slate-900 border-l-4 border-yellow-400 p-4 rounded-xl shadow-2xl text-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src={logo} alt="PSITS Logo" className="h-9 w-9 object-contain" />
                    <div>
                      <p className="text-xs font-bold uppercase text-yellow-300 tracking-wider">PSITS Live Announcement</p>
                      <h4 className="text-base font-extrabold text-white leading-tight">{lowerThirdText}</h4>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {!isHost && !remoteVideoRef.current?.srcObject && currentScene === 'camera' && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <VideoOff size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Waiting for host to start broadcasting...</p>
                </div>
              </div>
            )}
          </div>

          {/* Controls Bar */}
          {isHost && (
            <div className="mt-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex justify-center items-center gap-4">
              <button
                onClick={toggleMic}
                className={`p-4 rounded-full transition ${isMicOn ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' : 'bg-red-100 hover:bg-red-200 text-red-600'}`}
                title={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
              >
                {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
              </button>
              
              <button
                onClick={toggleCamera}
                className={`p-4 rounded-full transition ${isCameraOn ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' : 'bg-red-100 hover:bg-red-200 text-red-600'}`}
                title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
              >
                {isCameraOn ? <Video size={24} /> : <VideoOff size={24} />}
              </button>

              <button
                onClick={toggleScreenShare}
                className={`p-4 rounded-full transition ${isScreenSharing ? 'bg-blue-100 hover:bg-blue-200 text-blue-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
              >
                <MonitorUp size={24} />
              </button>

              <div className="w-px h-8 bg-gray-200 mx-2" />

              <button
                onClick={() => {
                  socket?.disconnect();
                  navigate('/live-events');
                }}
                className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition flex items-center gap-2 pr-6"
              >
                <PhoneOff size={24} />
                <span className="font-semibold">End Session</span>
              </button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-80 border-l border-gray-200 bg-white flex flex-col h-full shrink-0">
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="p-4 border-b border-gray-100 flex items-center gap-2 font-semibold text-gray-900">
              <MessageSquare size={18} />
              Live Chat
            </div>
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id} className="flex flex-col text-sm">
                    <div className="flex items-baseline gap-2">
                      <span className={`font-semibold text-xs px-1.5 py-0.5 rounded ${
                        msg.user?.role === 'super_admin' || msg.user?.role === 'admin'
                          ? 'bg-red-50 text-red-700 font-bold'
                          : msg.user?.role === 'officer'
                          ? 'bg-blue-50 text-blue-700 font-bold'
                          : 'text-gray-700'
                      }`}>
                        {msg.user?.name || msg.userName || 'User'}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-gray-700 mt-1 break-words bg-gray-50 p-2 rounded-lg border border-gray-100">
                      {msg.message}
                    </p>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              
              <form onSubmit={sendChatMessage} className="p-3 border-t border-gray-100 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <Button type="submit" variant="primary" size="sm" disabled={!chatInput.trim()}>
                  Send
                </Button>
              </form>
            </div>
          </div>
          <div className="flex-1 overflow-hidden flex flex-col border-t border-gray-200">
            <div className="p-4 border-b border-gray-100 flex items-center gap-2 font-semibold text-gray-900">
              <Users size={18} />
              Participants ({participants.length})
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase">
                    {p.name.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{p.name}</div>
                    <div className="text-xs text-gray-500 capitalize">{p.roleInSession}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </MainLayout>
  );
};
