const express = require('express');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const path = require('path');

const app = express();
const PORT = 3000;

// Configuração da porta serial (ALTERAR CONFORME PORTA)
const SERIAL_PORT = 'COM3';

let serialPort;
let isConnected = false;

let sensorData = {
  umidade: 0,
  bomba: 'OFF',
  valorBruto: 0,
  ultimaAtualizacao: new Date()
};

app.use(express.json());
app.use(express.static('public'));

function conectarSerial() {
  try {
    serialPort = new SerialPort({
      path: SERIAL_PORT,
      baudRate: 9600
    });

    const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));

    serialPort.on('open', () => {
      console.log(`✅ Conectado ao Arduino na porta ${SERIAL_PORT}`);
      isConnected = true;
      setTimeout(() => {
        enviarComando('START_MONITORING');
      }, 2000);
    });

    serialPort.on('error', (err) => {
      console.log('❌ Erro na porta serial:', err.message);
      isConnected = false;
    });

    serialPort.on('close', () => {
      console.log('🔌 Porta serial desconectada');
      isConnected = false;
    });

    parser.on('data', (data) => {
      console.log('Arduino:', data.trim());
      
      // formato: DATA|umidade|bomba|valorBruto|timestamp
      if (data.startsWith('DATA|')) {
        const partes = data.trim().split('|');
        
        if (partes.length >= 5) {
          sensorData = {
            umidade: parseInt(partes[1]) || 0,
            bomba: partes[2] || 'OFF',
            valorBruto: parseInt(partes[3]) || 0,
            ultimaAtualizacao: new Date()
          };

          console.log('Dados atualizados:', sensorData);
        } else {
          console.log('❌ Dados incompletos recebidos:', data);
        }
      }
    });

  } catch (error) {
    console.log('❌ Erro ao conectar serial:', error.message);
    isConnected = false;
  }
}

function enviarComando(comando) {
  if (isConnected && serialPort && serialPort.isOpen) {
    serialPort.write(comando + '\n');
    console.log('Comando enviado:', comando);
    return true;
  } else {
    console.log('❌ Não foi possível enviar comando - Arduino desconectado');
    return false;
  }
}

// Rotas 
app.get('/api/status', (req, res) => {
  res.json({
    ...sensorData,
    conectado: isConnected
  });
});

app.post('/api/bomba/ligar', (req, res) => {
  if (enviarComando('LIGAR_BOMBA')) {
    res.json({ sucesso: true, mensagem: 'Bomba ligada' });
  } else {
    res.status(500).json({ sucesso: false, mensagem: 'Arduino não conectado' });
  }
});

app.post('/api/bomba/desligar', (req, res) => {
  if (enviarComando('DESLIGAR_BOMBA')) {
    res.json({ sucesso: true, mensagem: 'Bomba desligada' });
  } else {
    res.status(500).json({ sucesso: false, mensagem: 'Arduino não conectado' });
  }
});


app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🌐 Servidor iniciado em http://localhost:${PORT}`);
  console.log(`📡 Tentando conectar ao Arduino na porta ${SERIAL_PORT}...`);
  conectarSerial();
});

setInterval(() => {
  if (!isConnected) {
    console.log('🔄 Tentando reconectar ao Arduino...');
    conectarSerial();
  }
}, 10000);