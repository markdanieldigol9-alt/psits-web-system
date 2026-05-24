import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { MainLayout } from '@/shared/layouts';
import { useAuth } from '@/shared/context/AuthContext';
import { useNotification } from '@/shared/context/NotificationContext';
import { Button } from '@/shared/components/Form';
import { LoadingSpinner, Badge } from '@/shared/components/Common';
import { Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, Users, MessageSquare } from 'lucide-react';
import api from '@/shared/services/api';
import type { LiveSession } from '@/features/live-events/types/liveSessions';

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

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<{ [socketId: string]: RTCPeerConnection }>({});

  const isHost = session?.createdBy === String(user?.id) || user?.role === 'admin' || user?.role === 'super_admin';

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

      s.on('session:user-left', (payload: any) => {
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
            
            {!isHost && !remoteVideoRef.current?.srcObject && (
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
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 flex items-center gap-2 font-semibold text-gray-900">
              <MessageSquare size={18} />
              Live Chat
            </div>
            <div className="flex-1 p-4 flex items-center justify-center text-sm text-gray-500">
              Chat interface would go here.
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
