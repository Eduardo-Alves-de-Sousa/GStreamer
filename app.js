// Variáveis globais para armazenar informações sobre a transmissão e a conexão
let localStream;
let remoteStream;
let pc; // Peer Connection
let encoderPort; // Porta do Encoder
let decoderPort; // Porta do Decoder
const socket = io(); // Objeto do Socket.IO para comunicação com o servidor
let analyser;
let frequencyData;
let canvas;
let canvasCtx;

// Função principal para iniciar a transmissão
function startStreaming() {
    // Obtém as portas do Encoder e do Decoder do input HTML
    encoderPort = document.getElementById('encoderPort').value;
    decoderPort = document.getElementById('decoderPort').value;

    // Comando GStreamer para o Encoder
    const encoderCommand = `gst-launch-1.0 alsasrc device=hw:4 ! audioconvert ! avenc_aptx_hd ! rtpgstpay ! queue ! rtpulpfecenc percentage=100 pt=122 ! udpsink host=2804:7f7:e041:678c:3f2b:5875:df0c:894d port=${encoderPort}`;

    // Comando GStreamer para o Decoder
    const decoderCommand = `gst-launch-1.0 udpsrc port=${decoderPort} ! "application/x-rtp,media=(string)application,clock-rate=(int)90000,encoding-name=(string)X-GST,caps=(string)\"YXVkaW8vYXB0eC1oZCwgY2hhbm5lbHM9KGludCkyLCByYXRlPShpbnQpNDgwMDAsIGNoYW5uZWwtbWFzaz0oYml0bWFzaykweDAwMDAwMDAwMDAwMDAwMDM\=\",capsversion=(string)0,payload=(int)96" ! rtpjitterbuffer ! rtpulpfecdec pt=122 ! rtpgstdepay ! avdec_aptx_hd ! audioconvert ! audioresample ! autoaudiosink`;

    // Inicializa a conexão peer-to-peer (Peer Connection) e inicia a transmissão local
    initializePeerConnection();
    startLocalStream();

    // Inicia os processos do GStreamer para o Encoder e o Decoder
    startGStreamerProcess(encoderCommand);
    startGStreamerProcess(decoderCommand);

    // Inicializa o analisador de áudio e a barra de frequência
    initializeAudioAnalyzer();
}

// Função para inicializar a conexão peer-to-peer (Peer Connection)
async function initializePeerConnection() {
    // Cria uma nova instância da conexão peer-to-peer (Peer Connection)
    pc = new RTCPeerConnection();

    // Configura o evento quando uma faixa (track) de mídia é adicionada à conexão
    pc.ontrack = (event) => {
        remoteStream = event.streams[0];
        document.getElementById('remoteAudio').srcObject = remoteStream;
    };

    // Configura o evento para lidar com candidatos ICE (Interactive Connectivity Establishment)
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            // Envia o candidato ICE para o servidor
            socket.emit('ice-candidate', { iceCandidate: event.candidate, decoderPort });
        }
    };

    // Configura o evento para lidar com alterações no estado de conexão ICE
    pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'closed') {
            console.log('Connection closed');
            closePeerConnection();
        }
    };
}

// Função para iniciar a transmissão local
async function startLocalStream() {
    try {
        // Obtém a transmissão local do microfone
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Exibe a transmissão local no elemento de áudio HTML
        document.getElementById('remoteAudio').srcObject = localStream;

        // Adiciona as faixas de áudio da transmissão local à conexão peer-to-peer (Peer Connection)
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

        // Cria uma oferta (offer) para iniciar a negociação de conexão
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Envia a oferta para o servidor
        socket.emit('offer', { offer, encoderPort });
    } catch (error) {
        console.error('Error starting streaming:', error);
    }
}

// Configura o Socket.IO para lidar com ofertas recebidas do servidor
socket.on('offer', async (data) => {
    const { offer } = data;

    // Define a descrição remota com a oferta recebida
    await pc.setRemoteDescription(offer);

    // Cria uma resposta (answer) à oferta recebida
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // Envia a resposta para o servidor
    socket.emit('answer', { answer, decoderPort });
});

// Configura o Socket.IO para lidar com respostas recebidas do servidor
socket.on('answer', async (data) => {
    const { answer } = data;

    // Define a descrição remota com a resposta recebida
    await pc.setRemoteDescription(answer);
});

// Configura o Socket.IO para lidar com candidatos ICE recebidos do servidor
socket.on('ice-candidate', async (data) => {
    const { iceCandidate } = data;
    try {
        // Adiciona o candidato ICE à conexão peer-to-peer (Peer Connection)
        await pc.addIceCandidate(iceCandidate);
    } catch (error) {
        console.error('Error adding ice candidate:', error);
    }
});

// Função para fechar a conexão peer-to-peer (Peer Connection) e parar a transmissão
function closePeerConnection() {
    if (pc) {
        pc.close();
        pc = null;
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
        remoteStream = null;
    }
}

// Função para iniciar um processo do GStreamer com o comando fornecido
function startGStreamerProcess(command) {
    // Executa um processo filho para executar o comando GStreamer
    const childProcess = require('child_process').exec(command);

    // Configura eventos para lidar com a saída do processo
    childProcess.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
    });

    childProcess.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
    });

    childProcess.on('close', (code) => {
        console.log(`child process exited with code ${code}`);
    });
}
// Função para inicializar o analisador de áudio
function initializeAudioAnalyzer() {
    const audio = document.getElementById('remoteAudio');
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    const source = audioCtx.createMediaStreamSource(remoteStream); // Corrigir aqui
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    analyser.fftSize = 256;
    frequencyData = new Uint8Array(analyser.frequencyBinCount);

    canvas = document.getElementById('frequencyCanvas');
    canvasCtx = canvas.getContext('2d');
    drawFrequency();
}

// Função para desenhar a barra de frequência no canvas
function drawFrequency() {
    analyser.getByteFrequencyData(frequencyData);

    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / frequencyData.length) * 2.5;
    let barHeight;
    let x = 0;

    for (let i = 0; i < frequencyData.length; i++) {
        barHeight = frequencyData[i] / 2;

        canvasCtx.fillStyle = 'rgb(' + (barHeight + 100) + ',50,50)';
        canvasCtx.fillRect(x, canvas.height - barHeight / 2, barWidth, barHeight);

        x += barWidth + 1;
    }

    requestAnimationFrame(drawFrequency);
}