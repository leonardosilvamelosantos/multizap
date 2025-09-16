import { makeWASocket, useMultiFileAuthState, DisconnectReason } from 'baileys';
import qrcode from 'qrcode-terminal';
import fs from 'fs';

async function testSimpleConnection() {
  console.log('🚀 Testando conexão simples do Baileys...');
  
  try {
    // Criar diretório de autenticação
    const authDir = './auth_simple';
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    // Configurar estado de autenticação
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    // Criar socket do WhatsApp
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      browser: ['MultiZap', 'Chrome', '1.0.0'],
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: true,
      defaultQueryTimeoutMs: 30000,
      keepAliveIntervalMs: 25000,
      retryRequestDelayMs: 500,
      maxMsgRetryCount: 3,
      connectTimeoutMs: 30000,
      shouldSyncHistoryMessage: () => false,
      logger: {
        level: 'silent',
        child: () => ({ 
          level: 'silent',
          error: () => {},
          warn: () => {},
          info: () => {},
          debug: () => {},
          trace: () => {}
        }),
        error: () => {},
        warn: () => {},
        info: () => {},
        debug: () => {},
        trace: () => {}
      }
    });

    // Configurar eventos
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('📱 QR Code gerado:');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const errorMessage = lastDisconnect?.error?.output?.payload?.message || 'Unknown error';
        
        console.log(`❌ Conexão fechada - Status: ${statusCode}, Mensagem: ${errorMessage}`);
        
        if (statusCode === 515) {
          console.log('⚠️ Erro 515 detectado - Problema conhecido do Baileys');
        }
      } else if (connection === 'open') {
        console.log('✅ Conectado com sucesso!');
      }
    });

    sock.ev.on('creds.update', (creds) => {
      saveCreds(creds);
    });

    sock.ev.on('messages.upsert', (m) => {
      console.log('📨 Nova mensagem recebida');
    });

    console.log('⏳ Aguardando conexão...');
    console.log('📱 Escaneie o QR Code com seu WhatsApp');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

// Executar teste
testSimpleConnection();
