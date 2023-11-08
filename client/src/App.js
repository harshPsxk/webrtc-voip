import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const App = () => {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callStatus, setCallStatus] = useState('Ready to call');
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const wsRef = useRef(null);
  const peerConnectionRef = useRef(null);

  const setupPeerConnection = () => {
    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    peerConnection.ontrack = (event) => {
      remoteAudioRef.current.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        wsRef.current.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
      }
    };

    return peerConnection;
  };

  useEffect(() => {
    wsRef.current = new WebSocket('ws://localhost:3000');
    wsRef.current.onopen = () => setCallStatus('Connected to the server, ready to call');
    wsRef.current.onmessage = (message) => {
      if (message.data instanceof Blob) {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const data = JSON.parse(reader.result);
            handleMessage(data);
          } catch (e) {
            console.error('Error parsing Blob as JSON', e);
          }
        };
        reader.readAsText(message.data);
      } else {
        try {
          const data = JSON.parse(message.data);
          handleMessage(data);
        } catch (error) {
          console.error('Failed to parse incoming message', error);
        }
      }
    };
    wsRef.current.onclose = () => setCallStatus('Disconnected from the server');

    peerConnectionRef.current = setupPeerConnection();

    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      localAudioRef.current.srcObject = stream;
      stream.getTracks().forEach(track => {
        peerConnectionRef.current.addTrack(track, stream);
      });
    });

    return () => {
      wsRef.current.close();
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, []);

  const handleMessage = (data) => {
    switch (data.type) {
      case 'offer':
        handleOffer(data.offer);
        break;
      case 'answer':
        handleAnswer(data.answer);
        break;
      case 'candidate':
        handleCandidate(data.candidate);
        break;
      case 'hangup':
        handleHangupSignal();
        break;
      default:
        break;
    }
  };

  const handleOffer = async (offer) => {
    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnectionRef.current.createAnswer();
    await peerConnectionRef.current.setLocalDescription(answer);
    wsRef.current.send(JSON.stringify({ type: 'answer', answer }));
    setIsCallActive(true);
    setCallStatus('Call in progress');
  };

  const handleAnswer = async (answer) => {
    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
    setIsCallActive(true);
    setCallStatus('Call connected');
  };

  const handleCandidate = async (candidate) => {
    if (candidate) {
      try {
        await peerConnectionRef.current.addIceCandidate(candidate);
      } catch (e) {
        console.error('Error adding received ice candidate', e);
      }
    }
  };

  const handleHangupSignal = () => {
    peerConnectionRef.current.close();
    peerConnectionRef.current = setupPeerConnection();
    setIsCallActive(false);
    setCallStatus('Call ended');
  };

  const handleMute = () => {
    const localStream = localAudioRef.current.srcObject;
    localStream.getAudioTracks()[0].enabled = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleCall = async () => {
    setIsCallActive(true);
    peerConnectionRef.current = setupPeerConnection();
    try {
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      wsRef.current.send(JSON.stringify({ type: 'offer', offer }));
      setCallStatus('Calling...');
    } catch (error) {
      console.error('Error during handleCall', error);
      setIsCallActive(false);
      setCallStatus('Failed to call');
    }
  };

  const handleHangup = () => {
    peerConnectionRef.current.close();
    peerConnectionRef.current = setupPeerConnection();
    setIsCallActive(false);
    setCallStatus('Call ended');
    wsRef.current.send(JSON.stringify({ type: 'hangup' }));
  };

  return (
    <div>
      <audio ref={localAudioRef} autoPlay muted></audio>
      <audio ref={remoteAudioRef} autoPlay></audio>
      <div>Status: {callStatus}</div>
      {!isCallActive && <button onClick={handleCall}>Call</button>}
      {isCallActive && (
        <>
          <button onClick={handleMute}>{isMuted ? 'Unmute' : 'Mute'}</button>
          <button onClick={handleHangup}>Hang Up</button>
        </>
      )}
    </div>
  );
};

export default App;
