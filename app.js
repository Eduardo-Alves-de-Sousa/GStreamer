let localStream;
let remoteStream;
let pc;
let encoderPort;
let decoderPort;
const socket = io();

function startStreaming() {
    encoderPort = document.getElementById('encoderPort').value;
    decoderPort = document.getElementById('decoderPort').value;

    initializePeerConnection();
    startLocalStream();
}

async function initializePeerConnection() {
    pc = new RTCPeerConnection();

    pc.ontrack = (event) => {
        remoteStream = event.streams[0];
        document.getElementById('remoteAudio').srcObject = remoteStream;
    };

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', { iceCandidate: event.candidate, decoderPort });
        }
    };

    pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'closed') {
            console.log('Connection closed');
            closePeerConnection();
        }
    };
}

async function startLocalStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        document.getElementById('remoteAudio').srcObject = localStream;

        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit('offer', { offer, encoderPort });
    } catch (error) {
        console.error('Error starting streaming:', error);
    }
}

socket.on('offer', async (data) => {
    const { offer } = data;

    await pc.setRemoteDescription(offer);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit('answer', { answer, decoderPort });
});

socket.on('answer', async (data) => {
    const { answer } = data;
    await pc.setRemoteDescription(answer);
});

socket.on('ice-candidate', async (data) => {
    const { iceCandidate } = data;
    try {
        await pc.addIceCandidate(iceCandidate);
    } catch (error) {
        console.error('Error adding ice candidate:', error);
    }
});

function closePeerConnection() {
    if (pc) {
        pc.close();
        pc = null;
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
        remoteStream = null;
    }
}
