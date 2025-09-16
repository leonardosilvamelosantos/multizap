import { makeWASocket, useMultiFileAuthState, DisconnectReason } from 'baileys';
import qrcode from 'qrcode-terminal';
import QRCode from 'qrcode';
import fs from 'fs';
import { EventEmitter } from 'events';

export class WhatsAppInstanceV2 extends EventEmitter {
  constructor(tenantId, options = {}) {
    super();
    this.tenantId = tenantId;
    this.sock = null;
    this.isConnected = false;
    this.qrCode = null;
    this.authDir = `./sessions/${tenantId}`;
    this.options = {
      maxRetries: 2, // Reduzir tentativas
      retryDelay: 20000, // Aumentar delay
      ...options
    };
    this.retryCount = 0;
    this.lastActivity = new Date();
    this.isConnecting = false;
  }

  async connect() {
    if (this.isConnecting) {
      console.log(`⏳ Conexão já em andamento para tenant: ${this.tenantId}`);
      return { success: false, error: 'Conexão já em andamento' };
    }

    this.isConnecting = true;

    try {
      console.log(`🚀 Iniciando instância WhatsApp para tenant: ${this.tenantId}`);
      
      // Aguardar um tempo aleatório para evitar conflitos
      const randomDelay = 2000 + (Math.random() * 3000);
      console.log(`⏳ Aguardando ${Math.round(randomDelay)}ms antes de conectar...`);
      await new Promise(resolve => setTimeout(resolve, randomDelay));

      // Criar diretório de sessão isolado
      if (!fs.existsSync(this.authDir)) {
        fs.mkdirSync(this.authDir, { recursive: true });
      }

      // Configurar estado de autenticação isolado
      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

      // Criar socket do WhatsApp com configurações ultra-conservadoras
      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ['MultiZap', 'Chrome', `1.0.0-${this.tenantId}`],
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: false,
        defaultQueryTimeoutMs: 120000, // 2 minutos
        keepAliveIntervalMs: 60000, // 1 minuto
        retryRequestDelayMs: 5000, // 5 segundos
        maxMsgRetryCount: 1,
        connectTimeoutMs: 120000, // 2 minutos
        shouldSyncHistoryMessage: () => false,
        shouldIgnoreJid: (jid) => false,
        msgRetryCounterCache: new Map(),
        getMessage: async (key) => {
          return {
            conversation: 'test'
          };
        },
        // Configurações específicas para evitar erro 515
        fetchLatestBaileysVersion: true,
        keepAliveIntervalMs: 30000,
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
      this.emit('error', error);
      return { success: false, error: error.message };
    } finally {
      this.isConnecting = false;
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
          this.emit('disconnected', { statusCode, errorMessage });

          // Tratamento específico para erro 515
          if (statusCode === 515) {
            console.log(`⚠️ Erro 515 detectado para tenant ${this.tenantId}. Aguardando 30 segundos...`);
            
            // Aguardar 30 segundos antes de tentar reconectar
            setTimeout(() => {
              if (this.shouldReconnect(statusCode)) {
                this.scheduleReconnect();
              } else {
                console.log(`❌ Máximo de tentativas atingido para tenant ${this.tenantId}`);
                this.emit('critical_error', { statusCode, errorMessage });
              }
            }, 30000);
          } else if (this.shouldReconnect(statusCode)) {
            this.scheduleReconnect();
          } else {
            this.emit('critical_error', { statusCode, errorMessage });
          }
        } else if (connection === 'open') {
          console.log(`✅ Tenant ${this.tenantId} conectado com sucesso!`);
          this.isConnected = true;
          this.retryCount = 0;
          this.lastActivity = new Date();
          // Limpar QR Code quando conectado
          this.qrCode = null;
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
    // Para erro 515, apenas 1 tentativa
    if (statusCode === 515) {
      return this.retryCount < 1;
    }
    
    const criticalErrors = [428, 401, 403, 404];
    return !criticalErrors.includes(statusCode) && this.retryCount < this.options.maxRetries;
  }

  scheduleReconnect() {
    this.retryCount++;
    
    // Delay muito maior para erro 515
    let delay = 60000; // 1 minuto mínimo
    if (this.retryCount === 1) {
      delay = 60000; // 1 minuto
    }

    console.log(`🔄 Agendando reconexão para tenant ${this.tenantId} em ${delay}ms (tentativa ${this.retryCount}/${this.options.maxRetries})`);

    setTimeout(() => {
      this.connect();
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

      const result = await this.sock.sendMessage(to, {
        ...media,
        caption: caption
      });

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
      connectionState: this.sock?.ws?.readyState || 'disconnected'
    };
  }

  async disconnect() {
    try {
      if (this.sock) {
        if (this.sock.ws && this.sock.ws.readyState === 1) {
          await this.sock.logout();
        }
        this.sock = null;
      }

      this.isConnected = false;
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
