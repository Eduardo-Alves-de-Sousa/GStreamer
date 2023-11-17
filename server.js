const express = require('express');
const bodyParser = require('body-parser');
const { exec } = require('child_process');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

app.post('/execute-command', (req, res) => {
    const command = req.body.command;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Erro ao executar o comando: ${error}`);
            res.status(500).send(`Erro ao executar o comando: ${error}`);
            return;
        }

        console.log(`Comando executado com sucesso: ${stdout}`);
        res.send(`Comando executado com sucesso: ${stdout}`);
    });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
