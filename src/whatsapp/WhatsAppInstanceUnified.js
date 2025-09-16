import { makeWASocket, useMultiFileAuthState, DisconnectReason } from 'baileys';
import qrcode from 'qrcode-terminal';
import QRCode from 'qrcode';
import fs from 'fs';
import { EventEmitter } from 'events';

export class WhatsAppInstanceUnified extends EventEmitter {
  constructor(tenantId, options = {}) {
    super();
    this.tenantId = tenantId;
    this.sock = null;
    this.isConnected = false;
    this.qrCode = null;
    this.authDir = `./sessions/${tenantId}`;
    this.options = {
      maxRetries: 3,
      retryDelay: 30000, // 30 segundos
      ...options
    };
    this.retryCount = 0;
    this.lastActivity = new Date();
    this.isConnecting = false;
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 3;
    this.reconnectTimeout = null;
  }

  async connect() {
    if (this.isConnecting) {
      console.log(`⏳ Conexão já em andamento para tenant: ${this.tenantId}`);
      return { success: false, error: 'Conexão já em andamento' };
    }

    if (this.isConnected) {
      console.log(`⚠️ Já está conectado para tenant: ${this.tenantId}`);
      return { success: true, message: 'Já está conectado' };
    }

    if (this.connectionAttempts >= this.maxConnectionAttempts) {
      console.log(`❌ Máximo de tentativas de conexão atingido para tenant: ${this.tenantId}`);
      return { success: false, error: 'Máximo de tentativas atingido' };
    }

    this.isConnecting = true;
    this.connectionAttempts++;

    try {
      console.log(`🚀 Iniciando instância WhatsApp para tenant: ${this.tenantId} (tentativa ${this.connectionAttempts}/${this.maxConnectionAttempts})`);

      // Criar diretório de sessão isolado
      if (!fs.existsSync(this.authDir)) {
        fs.mkdirSync(this.authDir, { recursive: true });
      }

      // Configurar estado de autenticação isolado
      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

      // Aguardar um tempo aleatório antes de conectar (1-3 segundos)
      const randomDelay = Math.floor(Math.random() * 2000) + 1000;
      console.log(`⏳ Aguardando ${randomDelay}ms antes de conectar...`);
      await new Promise(resolve => setTimeout(resolve, randomDelay));

      // Criar socket do WhatsApp com configurações otimizadas
      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ['MultiZap', 'Chrome', `1.0.0-${this.tenantId}`],
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: false,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        retryRequestDelayMs: 2000,
        maxMsgRetryCount: 2,
        connectTimeoutMs: 60000,
        shouldSyncHistoryMessage: () => false,
        shouldIgnoreJid: (jid) => false,
        msgRetryCounterCache: new Map(),
        getMessage: async (key) => {
          return {
            conversation: 'test'
          };
        },
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

      console.log(`✅ Instância WhatsApp criada para tenant: ${this.tenantId}`);
      return { success: true, tenantId: this.tenantId };

    } catch (error) {
      console.error(`❌ Erro ao criar instância para tenant ${this.tenantId}:`, error.message);
      this.isConnecting = false;
      this.emit('error', error);
      return { success: false, error: error.message };
    }
  }

  setupEvents(saveCreds) {
    this.sock.ev.on('connection.update', (update) => {
      try {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          // Verificar se já está conectado antes de gerar QR
          if (this.isConnected) {
            console.log(`⚠️ Tenant ${this.tenantId} já está conectado, ignorando QR Code`);
            return;
          }
          
          console.log(`📱 QR Code gerado para tenant ${this.tenantId}`);
          qrcode.generate(qr, { small: true });

          // Gerar QR Code para interface web
          this.generateQRForWeb(qr);
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const errorMessage = lastDisconnect?.error?.output?.payload?.message || 'Unknown error';

          console.log(`🔌 Conexão fechada para tenant ${this.tenantId} - Status: ${statusCode}, Mensagem: ${errorMessage}`);

          this.isConnected = false;
          this.isConnecting = false;
          this.emit('disconnected', { statusCode, errorMessage });

          // Tratamento específico para diferentes erros
          if (statusCode === 440) {
            console.log(`⚠️ Erro 440 (Stream Errored) detectado para tenant ${this.tenantId}. Aguardando 60 segundos...`);
            this.scheduleReconnect(60000);
          } else if (statusCode === 515) {
            console.log(`⚠️ Erro 515 detectado para tenant ${this.tenantId}. Aguardando 30 segundos...`);
            this.scheduleReconnect(30000);
          } else if (statusCode === 428) {
            console.log(`⚠️ Erro 428 detectado para tenant ${this.tenantId}. Aguardando 20 segundos...`);
            this.scheduleReconnect(20000);
          } else if (this.shouldReconnect(statusCode)) {
            this.scheduleReconnect(15000);
          } else {
            console.log(`❌ Erro crítico para tenant ${this.tenantId} (Status: ${statusCode}). Não tentando reconectar.`);
            this.emit('critical_error', { statusCode, errorMessage });
          }
        } else if (connection === 'open') {
          console.log(`✅ Tenant ${this.tenantId} conectado com sucesso!`);
          this.isConnected = true;
          this.isConnecting = false;
          this.retryCount = 0;
          this.connectionAttempts = 0;
          this.lastActivity = new Date();
          // Limpar QR Code quando conectado
          this.qrCode = null;
          // Cancelar reconexão agendada se existir
          if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
          }
          this.emit('connected');
        }
      } catch (error) {
        console.error(`❌ Erro no evento de conexão do tenant ${this.tenantId}:`, error.message);
        this.emit('error', error);
      }
    });

    this.sock.ev.on('creds.update', (creds) => {
      try {
        saveCreds(creds);
        console.log(`💾 Credenciais salvas para tenant ${this.tenantId}`);
      } catch (error) {
        console.error(`❌ Erro ao salvar credenciais do tenant ${this.tenantId}:`, error.message);
      }
    });

    this.sock.ev.on('messages.upsert', (m) => {
      try {
        this.lastActivity = new Date();
        this.emit('message', m);
        console.log(`📨 Nova mensagem recebida no tenant ${this.tenantId}`);
      } catch (error) {
        console.error(`❌ Erro no evento de mensagem do tenant ${this.tenantId}:`, error.message);
      }
    });
  }

  shouldReconnect(statusCode) {
    // Erros que não devem ser reconectados
    const criticalErrors = [401, 403, 404, 500, 501, 502, 503];
    return !criticalErrors.includes(statusCode) && this.retryCount < this.options.maxRetries;
  }

  scheduleReconnect(delay = 15000) {
    // Verificar se já está conectado antes de agendar reconexão
    if (this.isConnected) {
      console.log(`⚠️ Tenant ${this.tenantId} já está conectado, cancelando reconexão`);
      return;
    }

    // Cancelar reconexão anterior se existir
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.retryCount++;
    
    // Verificar limite de tentativas
    if (this.retryCount > this.options.maxRetries) {
      console.log(`❌ Máximo de tentativas atingido para tenant ${this.tenantId}`);
      this.emit('critical_error', { message: 'Máximo de tentativas de reconexão atingido' });
      return;
    }

    console.log(`🔄 Agendando reconexão para tenant ${this.tenantId} em ${delay}ms (tentativa ${this.retryCount}/${this.options.maxRetries})`);

    this.reconnectTimeout = setTimeout(() => {
      // Verificar novamente se ainda não está conectado
      if (!this.isConnected && !this.isConnecting) {
        this.connect();
      } else {
        console.log(`⚠️ Tenant ${this.tenantId} já está conectado/conectando, cancelando reconexão agendada`);
      }
      this.reconnectTimeout = null;
    }, delay);
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

      this.emit('qr_generated', this.qrCode);
    } catch (error) {
      console.error(`❌ Erro ao gerar QR Code para web:`, error.message);
    }
  }

  async sendMessage(to, message) {
    try {
      if (!this.isConnected) {
        throw new Error('Instância não conectada');
      }

      const result = await this.sock.sendMessage(to, { text: message });
      this.lastActivity = new Date();

      console.log(`📤 Mensagem enviada para ${to} no tenant ${this.tenantId}`);
      return { success: true, messageId: result.key.id };
    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem no tenant ${this.tenantId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async sendMediaMessage(to, media, caption = '') {
    try {
      if (!this.isConnected) {
        throw new Error('Instância não conectada');
      }

      let message;
      if (media.type === 'image') {
        message = {
          image: { url: media.url },
          caption: caption
        };
      } else if (media.type === 'video') {
        message = {
          video: { url: media.url },
          caption: caption
        };
      } else if (media.type === 'audio') {
        message = {
          audio: { url: media.url }
        };
      } else if (media.type === 'document') {
        message = {
          document: { url: media.url },
          mimetype: media.mimetype,
          fileName: media.fileName
        };
      } else {
        throw new Error('Tipo de mídia não suportado');
      }

      const result = await this.sock.sendMessage(to, message);
      this.lastActivity = new Date();
      
      console.log(`📤 Mídia enviada para ${to} no tenant ${this.tenantId}`);
      return { success: true, messageId: result.key.id };
    } catch (error) {
      console.error(`❌ Erro ao enviar mídia no tenant ${this.tenantId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  getStatus() {
    return {
      tenantId: this.tenantId,
      isConnected: this.isConnected,
      qrCode: this.qrCode,
      lastActivity: this.lastActivity,
      retryCount: this.retryCount,
      connectionAttempts: this.connectionAttempts,
      connectionState: this.sock?.ws?.readyState || 'disconnected',
      isConnecting: this.isConnecting
    };
  }

  async disconnect() {
    try {
      // Cancelar reconexão agendada
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }

      if (this.sock) {
        if (this.sock.ws && this.sock.ws.readyState === 1) {
          await this.sock.logout();
        }
        this.sock = null;
      }

      this.isConnected = false;
      this.isConnecting = false;
      this.qrCode = null;

      console.log(`🔌 Instância desconectada para tenant ${this.tenantId}`);
      this.emit('disconnected');
    } catch (error) {
      console.error(`❌ Erro ao desconectar instância do tenant ${this.tenantId}:`, error.message);
    }
  }

  async cleanup() {
    try {
      await this.disconnect();

      // Limpar dados de sessão
      if (fs.existsSync(this.authDir)) {
        fs.rmSync(this.authDir, { recursive: true, force: true });
        console.log(`🧹 Dados de sessão limpos para tenant ${this.tenantId}`);
      }
    } catch (error) {
      console.error(`❌ Erro ao limpar dados do tenant ${this.tenantId}:`, error.message);
    }
  }
}
