import { makeWASocket, useMultiFileAuthState, DisconnectReason } from 'baileys';
import qrcode from 'qrcode-terminal';
import QRCode from 'qrcode';
import fs from 'fs';

export class WhatsAppSimple {
  constructor() {
    this.sock = null;
    this.isConnected = false;
    this.qrCode = null;
    this.authDir = './auth_simple';
  }

  async connect() {
    try {
      console.log('🚀 Iniciando conexão simples do WhatsApp...');
      
      // Criar diretório de autenticação
      if (!fs.existsSync(this.authDir)) {
        fs.mkdirSync(this.authDir, { recursive: true });
      }

      // Configurar estado de autenticação
      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

      // Criar socket do WhatsApp com configurações otimizadas
      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ['MultiZap', 'Chrome', '1.0.0'],
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: true,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        retryRequestDelayMs: 1000,
        maxMsgRetryCount: 5,
        connectTimeoutMs: 60000,
        shouldSyncHistoryMessage: () => false,
        shouldIgnoreJid: (jid) => false,
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
      this.setupEvents(saveCreds);

      console.log('✅ Socket criado com sucesso');
      return { success: true };

    } catch (error) {
      console.error('❌ Erro ao conectar:', error.message);
      return { success: false, error: error.message };
    }
  }

  setupEvents(saveCreds) {
    this.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('📱 QR Code gerado:');
        qrcode.generate(qr, { small: true });
        
        // Gerar QR Code para web
        this.generateQRForWeb(qr);
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const errorMessage = lastDisconnect?.error?.output?.payload?.message || 'Unknown error';
        
        console.log(`❌ Conexão fechada - Status: ${statusCode}, Mensagem: ${errorMessage}`);
        
        if (statusCode === 515) {
          console.log('⚠️ Erro 515 detectado - Tentando reconectar em 10 segundos...');
          setTimeout(() => {
            this.reconnect();
          }, 10000);
        } else if (statusCode === 428) {
          console.log('⚠️ Erro 428 detectado - Tentando reconectar em 5 segundos...');
          setTimeout(() => {
            this.reconnect();
          }, 5000);
        }
        
        this.isConnected = false;
      } else if (connection === 'open') {
        console.log('✅ Conectado com sucesso!');
        this.isConnected = true;
        this.qrCode = null;
      }
    });

    this.sock.ev.on('creds.update', (creds) => {
      try {
        saveCreds(creds);
        console.log('💾 Credenciais salvas');
      } catch (error) {
        console.error('❌ Erro ao salvar credenciais:', error.message);
      }
    });

    this.sock.ev.on('messages.upsert', (m) => {
      console.log('📨 Nova mensagem recebida');
    });
  }

  async generateQRForWeb(qr) {
    try {
      const qrImage = await QRCode.toDataURL(qr, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      this.qrCode = {
        data: qrImage,
        timestamp: new Date()
      };
      
      console.log('✅ QR Code gerado para interface web');
    } catch (error) {
      console.error('❌ Erro ao gerar QR Code:', error.message);
    }
  }

  async reconnect() {
    try {
      console.log('🔄 Tentando reconectar...');
      
      if (this.sock) {
        this.sock.end();
      }
      
      // Aguardar um pouco antes de reconectar
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await this.connect();
    } catch (error) {
      console.error('❌ Erro ao reconectar:', error.message);
    }
  }

  async sendMessage(to, message) {
    try {
      if (!this.isConnected || !this.sock) {
        throw new Error('Não conectado ao WhatsApp');
      }

      const result = await this.sock.sendMessage(to, { text: message });
      console.log('✅ Mensagem enviada:', result.key.id);
      return { success: true, messageId: result.key.id };
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error.message);
      return { success: false, error: error.message };
    }
  }

  getStatus() {
    return {
      isConnected: this.isConnected,
      qrCode: this.qrCode,
      hasSocket: !!this.sock
    };
  }

  async disconnect() {
    try {
      if (this.sock) {
        await this.sock.logout();
        this.sock = null;
      }
      this.isConnected = false;
      this.qrCode = null;
      console.log('🔌 Desconectado');
    } catch (error) {
      console.error('❌ Erro ao desconectar:', error.message);
    }
  }
}
