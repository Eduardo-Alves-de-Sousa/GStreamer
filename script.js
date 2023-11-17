function startEncoder() {
    const encoderPort = document.getElementById("encoderPort").value;
    const command = `alsasrc device=hw:4 ! "audio/x-raw, rate=48000" ! audioconvert ! avenc_aptx_hd ! rtpgstpay ! queue ! rtpulpfecenc percentage=100 pt=122 ! udpsink host=127.0.0.1 port=${encoderPort}`;

    executeGStreamerCommand(command);
}

function startDecoder() {
    const decoderPort = document.getElementById("decoderPort").value;
    const command = `udpsrc address=127.0.0.1 port=${decoderPort} ! "application/x-rtp, media=(string)application, clock-rate=(int)90000, encoding-name=(string)X-GST, caps=(string)\"YXVkaW8vYXB0eC1oZCwgY2hhbm5lbHM9KGludCkyLCByYXRlPShpbnQpNDgwMDAsIGNoYW5uZWwtbWFzaz0oYml0bWFzaykweDAwMDAwMDAwMDAwMDAwMDM\=\", capsversion=(string)0, payload=(int)96" ! rtpjitterbuffer ! rtpulpfecdec pt=122 ! rtpgstdepay ! avdec_aptx_hd ! audioconvert ! audioresample ! autoaudiosink`;

    executeGStreamerCommand(command);
}

function executeGStreamerCommand(command) {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'http://localhost:3000/execute-command', true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                console.log('Resposta do servidor:', xhr.responseText);
            } else {
                console.error('Erro na requisição:', xhr.status, xhr.statusText);
            }
        }
    };

    const data = JSON.stringify({ command });
    xhr.send(data);
}
