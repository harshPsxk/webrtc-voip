const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('Client connected');
    ws.on('message', (message) => {
        console.log('Message received from a client: ', message);
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                console.log('Sending message to another client');
                client.send(message);
            }
        });
    });
});


server.listen(3000, () => {
    console.log('Signaling server is running on port 3000');
});
