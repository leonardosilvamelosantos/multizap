import { makeWASocket, useMultiFileAuthState, DisconnectReason } from 'baileys';
import qrcode from 'qrcode-terminal';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';

export class WhatsAppManager {
  constructor() {
    this.tenants = new Map();
    this.connections = new Map();
    this.qrCodes = new Map(); // Armazenar QR Codes para exibição na web
    this.connectionAttempts = new Map(); // Contador de tentativas de conexão
    this.maxConnectionAttempts = 3; // Máximo de tentativas por tenant
    this.connectionQueue = []; // Fila de conexões para evitar conflitos
    this.isConnecting = false; // Flag para controlar conexões simultâneas
    this.maxConcurrentConnections = 1; // Limitar a 1 conexão simultânea
    this.currentActiveTenant = null; // Tenant ativo no momento
    
    // Iniciar limpeza automática
    this.startCleanupInterval();
  }

  // Limpeza automática de dados antigos
  startCleanupInterval() {
    setInterval(() => {
      this.cleanupOldData();
    }, 60000); // Limpar a cada minuto
  }

  // Limpar dados antigos
  cleanupOldData() {
    try {
      const now = new Date();
      const maxAge = 10 * 60 * 1000; // 10 minutos

      // Limpar QR Codes antigos
      for (const [tenantId, qrData] of this.qrCodes.entries()) {
        if (now - qrData.timestamp > maxAge) {
          this.qrCodes.delete(tenantId);
          console.log(`🧹 QR Code antigo removido para tenant ${tenantId}`);
        }
      }

      // Limpar tentativas de conexão antigas
      for (const [tenantId, attempts] of this.connectionAttempts.entries()) {
        if (!this.tenants.has(tenantId)) {
          this.connectionAttempts.delete(tenantId);
        }
      }
    } catch (error) {
      console.error(`❌ Erro na limpeza automática:`, error.message);
    }
  }

  // Criar nova instância de WhatsApp para um tenant
  async createTenant(tenantId) {
    return new Promise((resolve, reject) => {
      this.connectionQueue.push({ tenantId, resolve, reject });
      this.processConnectionQueue();
    });
  }

  // Processar fila de conexões sequencialmente
  async processConnectionQueue() {
    if (this.isConnecting || this.connectionQueue.length === 0) {
      return;
    }

    // Verificar se já temos o máximo de conexões ativas
    if (this.connections.size >= this.maxConcurrentConnections) {
      console.log(`⚠️ Máximo de conexões atingido (${this.maxConcurrentConnections}). Aguardando...`);
      return;
    }

    this.isConnecting = true;
    const { tenantId, resolve, reject } = this.connectionQueue.shift();

    try {
      console.log(`🔧 Criando tenant: ${tenantId} (Fila: ${this.connectionQueue.length})`);
      
      // Se já temos um tenant ativo, desconectar o anterior
      if (this.currentActiveTenant && this.currentActiveTenant !== tenantId) {
        console.log(`🔄 Desconectando tenant anterior: ${this.currentActiveTenant}`);
        await this.disconnectTenant(this.currentActiveTenant);
      }
      
      // Aguardar um pouco entre conexões para evitar conflitos
      if (this.connections.size > 0) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      // Criar diretório de autenticação para o tenant
      const authDir = `./auth_${tenantId}`;
      if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
      }

      // Configurar estado de autenticação
      const { state, saveCreds } = await useMultiFileAuthState(authDir);

      // Criar socket do WhatsApp com configurações otimizadas
      const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, // Desabilitar QR no terminal para evitar conflitos
        browser: ['MultiZap', 'Chrome', `1.0.0-${tenantId}`],
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: true,
        defaultQueryTimeoutMs: 30000,
        keepAliveIntervalMs: 25000,
        retryRequestDelayMs: 500,
        maxMsgRetryCount: 3,
        msgRetryCounterCache: new Map(),
        connectTimeoutMs: 30000,
        shouldSyncHistoryMessage: () => false, // Desabilitar sincronização de histórico
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
      this.setupEvents(sock, tenantId, saveCreds);

      // Armazenar conexão
      this.connections.set(tenantId, sock);
      this.tenants.set(tenantId, {
        id: tenantId,
        status: 'connecting',
        createdAt: new Date(),
        lastActivity: new Date()
      });

      // Definir como tenant ativo
      this.currentActiveTenant = tenantId;

      // Forçar verificação de QR Code após um pequeno delay
      setTimeout(() => {
        this.checkForQRCode(tenantId);
      }, 2000);

      console.log(`✅ Tenant ${tenantId} criado com sucesso (Ativo: ${this.currentActiveTenant})`);
      resolve({ success: true, tenantId });

    } catch (error) {
      console.error(`❌ Erro ao criar tenant ${tenantId}:`, error.message);
      reject({ success: false, error: error.message });
    } finally {
      this.isConnecting = false;
      // Processar próxima conexão na fila
      setTimeout(() => this.processConnectionQueue(), 1000);
    }
  }

  // Configurar eventos do WhatsApp
  setupEvents(sock, tenantId, saveCreds) {
    try {
      sock.ev.on('connection.update', (update) => {
        try {
          const { connection, lastDisconnect, qr } = update;
          
          if (qr) {
            console.log(`📱 QR Code para tenant ${tenantId}:`);
            qrcode.generate(qr, { small: true });
            
            // Gerar QR Code como imagem para a web
            this.generateQRForWeb(tenantId, qr);
          }

           if (connection === 'close') {
             const statusCode = lastDisconnect?.error?.output?.statusCode;
             const errorMessage = lastDisconnect?.error?.output?.payload?.message || 'Unknown error';
             
             // Erros críticos que não devem ser reconectados
             const criticalErrors = [515, 428, 401, 403, 404];
             const shouldReconnect = !criticalErrors.includes(statusCode);
             
             if (shouldReconnect) {
               console.log(`🔄 Reconectando tenant ${tenantId}... (Status: ${statusCode})`);
               setTimeout(() => this.reconnectTenant(tenantId), 5000);
             } else {
               console.log(`❌ Erro crítico detectado para tenant ${tenantId} (Status: ${statusCode}, Mensagem: ${errorMessage}). Removendo conexão.`);
               this.removeTenant(tenantId);
             }
           } else if (connection === 'open') {
             console.log(`✅ Tenant ${tenantId} conectado com sucesso!`);
             this.updateTenantStatus(tenantId, 'connected');
             // Resetar contador de tentativas em caso de sucesso
             this.connectionAttempts.delete(tenantId);
             // Limpar QR Code quando conectado
             this.qrCodes.delete(tenantId);
           }
        } catch (error) {
          console.error(`❌ Erro no evento de conexão do tenant ${tenantId}:`, error.message);
        }
      });

      sock.ev.on('creds.update', (creds) => {
        try {
          saveCreds(creds);
        } catch (error) {
          console.error(`❌ Erro ao salvar credenciais do tenant ${tenantId}:`, error.message);
        }
      });

      sock.ev.on('messages.upsert', (m) => {
        try {
          this.updateTenantActivity(tenantId);
          console.log(`📨 Nova mensagem recebida no tenant ${tenantId}`);
        } catch (error) {
          console.error(`❌ Erro no evento de mensagem do tenant ${tenantId}:`, error.message);
        }
      });
    } catch (error) {
      console.error(`❌ Erro ao configurar eventos do tenant ${tenantId}:`, error.message);
    }
  }

  // Reconectar tenant
  async reconnectTenant(tenantId) {
    try {
      // Verificar se o tenant já existe antes de recriar
      if (this.connections.has(tenantId)) {
        console.log(`⚠️ Tenant ${tenantId} já existe, pulando reconexão`);
        return;
      }
      
      // Verificar número de tentativas
      const attempts = this.connectionAttempts.get(tenantId) || 0;
      if (attempts >= this.maxConnectionAttempts) {
        console.log(`❌ Máximo de tentativas atingido para tenant ${tenantId}. Removendo.`);
        this.removeTenant(tenantId);
        return;
      }
      
      this.connectionAttempts.set(tenantId, attempts + 1);
      console.log(`🔄 Reconectando tenant ${tenantId}... (Tentativa ${attempts + 1}/${this.maxConnectionAttempts})`);
      
      // Limpar dados antigos antes de reconectar
      this.qrCodes.delete(tenantId);
      
      await this.createTenant(tenantId);
    } catch (error) {
      console.error(`❌ Erro ao reconectar tenant ${tenantId}:`, error.message);
      // Se falhar na reconexão, remover o tenant
      this.removeTenant(tenantId);
    }
  }

  // Desconectar tenant (sem remover dados)
  async disconnectTenant(tenantId) {
    try {
      const connection = this.connections.get(tenantId);
      if (connection) {
        // Verificar se a conexão ainda está ativa antes de tentar logout
        if (connection.ws && connection.ws.readyState === 1) {
          try {
            await connection.logout();
          } catch (logoutError) {
            console.log(`⚠️ Erro ao fazer logout do tenant ${tenantId}:`, logoutError.message);
          }
        }
        this.connections.delete(tenantId);
      }
      
      // Atualizar status do tenant
      const tenant = this.tenants.get(tenantId);
      if (tenant) {
        tenant.status = 'disconnected';
        tenant.lastActivity = new Date();
      }
      
      // Se era o tenant ativo, limpar
      if (this.currentActiveTenant === tenantId) {
        this.currentActiveTenant = null;
      }
      
      console.log(`🔌 Tenant ${tenantId} desconectado`);
    } catch (error) {
      console.error(`❌ Erro ao desconectar tenant ${tenantId}:`, error.message);
    }
  }

  // Remover tenant
  async removeTenant(tenantId) {
    try {
      const connection = this.connections.get(tenantId);
      if (connection) {
        // Verificar se a conexão ainda está ativa antes de tentar logout
        if (connection.ws && connection.ws.readyState === 1) {
          try {
            await connection.logout();
          } catch (logoutError) {
            console.log(`⚠️ Erro ao fazer logout do tenant ${tenantId}:`, logoutError.message);
          }
        }
        this.connections.delete(tenantId);
      }
      this.tenants.delete(tenantId);
      this.qrCodes.delete(tenantId);
      this.connectionAttempts.delete(tenantId);
      
      // Se era o tenant ativo, limpar
      if (this.currentActiveTenant === tenantId) {
        this.currentActiveTenant = null;
      }
      
      // Limpar dados de autenticação
      await this.cleanupTenantAuth(tenantId);
      
      console.log(`🗑️ Tenant ${tenantId} removido`);
    } catch (error) {
      console.error(`❌ Erro ao remover tenant ${tenantId}:`, error.message);
      // Forçar remoção mesmo com erro
      this.connections.delete(tenantId);
      this.tenants.delete(tenantId);
      this.qrCodes.delete(tenantId);
      this.connectionAttempts.delete(tenantId);
      if (this.currentActiveTenant === tenantId) {
        this.currentActiveTenant = null;
      }
    }
  }

  // Limpar dados de autenticação de um tenant
  async cleanupTenantAuth(tenantId) {
    try {
      const authDir = `./auth_${tenantId}`;
      if (fs.existsSync(authDir)) {
        // Aguardar um pouco antes de limpar para evitar conflitos
        setTimeout(() => {
          try {
            fs.rmSync(authDir, { recursive: true, force: true });
            console.log(`🧹 Dados de autenticação limpos para tenant ${tenantId}`);
          } catch (error) {
            console.log(`⚠️ Erro ao limpar dados de autenticação do tenant ${tenantId}:`, error.message);
          }
        }, 2000);
      }
    } catch (error) {
      console.error(`❌ Erro ao limpar autenticação do tenant ${tenantId}:`, error.message);
    }
  }

  // Atualizar status do tenant
  updateTenantStatus(tenantId, status) {
    const tenant = this.tenants.get(tenantId);
    if (tenant) {
      tenant.status = status;
      tenant.lastActivity = new Date();
    }
  }

  // Atualizar atividade do tenant
  updateTenantActivity(tenantId) {
    const tenant = this.tenants.get(tenantId);
    if (tenant) {
      tenant.lastActivity = new Date();
    }
  }

  // Enviar mensagem
  async sendMessage(tenantId, to, message) {
    try {
      const sock = this.connections.get(tenantId);
      if (!sock) {
        throw new Error(`Tenant ${tenantId} não encontrado`);
      }

      const result = await sock.sendMessage(to, { text: message });
      this.updateTenantActivity(tenantId);
      
      return { success: true, messageId: result.key.id };
    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem:`, error.message);
      return { success: false, error: error.message };
    }
  }

  // Enviar mensagem com mídia
  async sendMediaMessage(tenantId, to, media, caption = '') {
    try {
      const sock = this.connections.get(tenantId);
      if (!sock) {
        throw new Error(`Tenant ${tenantId} não encontrado`);
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

      const result = await sock.sendMessage(to, message);
      this.updateTenantActivity(tenantId);
      
      return { success: true, messageId: result.key.id };
    } catch (error) {
      console.error(`❌ Erro ao enviar mídia:`, error.message);
      return { success: false, error: error.message };
    }
  }

  // Obter mensagens de um chat
  async getChatMessages(tenantId, chatId, limit = 50) {
    try {
      const sock = this.connections.get(tenantId);
      if (!sock) {
        throw new Error(`Tenant ${tenantId} não encontrado`);
      }

      const messages = await sock.loadMessages(chatId, limit);
      this.updateTenantActivity(tenantId);
      
      return messages.map(msg => ({
        id: msg.key.id,
        from: msg.key.remoteJid,
        message: msg.message,
        timestamp: msg.messageTimestamp,
        status: msg.status
      }));
    } catch (error) {
      console.error(`❌ Erro ao obter mensagens:`, error.message);
      return [];
    }
  }

  // Obter status de um tenant
  getTenantStatus(tenantId) {
    const tenant = this.tenants.get(tenantId);
    const connection = this.connections.get(tenantId);
    
    let status = 'disconnected';
    if (connection) {
      if (connection.ws && connection.ws.readyState === 1) {
        status = 'connected';
      } else if (connection.ws && connection.ws.readyState === 0) {
        status = 'connecting';
      }
    }
    
    return {
      tenant,
      isConnected: status === 'connected',
      status: status,
      connectionState: connection?.ws?.readyState || 'disconnected',
      isActive: this.currentActiveTenant === tenantId,
      activeTenant: this.currentActiveTenant,
      maxConnections: this.maxConcurrentConnections,
      currentConnections: this.connections.size
    };
  }

  // Obter todos os tenants ativos
  getActiveTenants() {
    return Array.from(this.tenants.values());
  }

  // Verificar se há QR Code disponível
  async checkForQRCode(tenantId) {
    try {
      const connection = this.connections.get(tenantId);
      if (!connection) return;

      // Verificar se o tenant já está conectado antes de gerar QR
      const tenant = this.tenants.get(tenantId);
      if (tenant && tenant.status === 'connected') {
        console.log(`⚠️ Tenant ${tenantId} já está conectado, pulando geração de QR Code`);
        return;
      }

      // Aguardar um pouco para o Baileys gerar o QR Code real
      setTimeout(async () => {
        try {
          // Verificar novamente se ainda não está conectado
          const currentTenant = this.tenants.get(tenantId);
          if (currentTenant && currentTenant.status === 'connected') {
            console.log(`⚠️ Tenant ${tenantId} conectou durante a espera, cancelando geração de QR`);
            return;
          }

          // Verificar se já temos um QR Code real do Baileys
          const qrData = this.qrCodes.get(tenantId);
          if (!qrData) {
            // Se não temos QR Code real, gerar um de teste
            const testQR = `https://wa.me/qr/${tenantId}-${Date.now()}`;
            
            console.log(`📱 Gerando QR Code de teste para tenant ${tenantId}:`);
            qrcode.generate(testQR, { small: true });
            
            // Gerar QR Code como imagem para a web
            await this.generateQRForWeb(tenantId, testQR);
          }
        } catch (error) {
          console.error(`❌ Erro ao verificar QR Code:`, error.message);
        }
      }, 3000);
    } catch (error) {
      console.error(`❌ Erro ao verificar QR Code:`, error.message);
    }
  }

  // Gerar QR Code para a web
  async generateQRForWeb(tenantId, qr) {
    try {
      const qrImage = await QRCode.toDataURL(qr, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      // Armazenar QR Code para exibição na web
      this.qrCodes.set(tenantId, {
        qr: qrImage,
        timestamp: new Date(),
        tenantId: tenantId
      });
      
      console.log(`✅ QR Code gerado para interface web: ${tenantId}`);
    } catch (error) {
      console.error(`❌ Erro ao gerar QR Code para web:`, error.message);
    }
  }

  // Obter QR Code de um tenant
  getTenantQR(tenantId) {
    const connection = this.connections.get(tenantId);
    const qrData = this.qrCodes.get(tenantId);
    const tenant = this.tenants.get(tenantId);
    
    if (!connection) {
      return { error: 'Tenant não encontrado' };
    }
    
    // Se o tenant está conectado, não retornar QR Code
    if (tenant && tenant.status === 'connected') {
      return { message: 'Tenant já está conectado. QR Code não necessário.' };
    }
    
    if (!qrData) {
      return { message: 'QR Code ainda não foi gerado. Aguarde...' };
    }
    
    // Verificar se o QR Code não é muito antigo (mais de 5 minutos)
    const now = new Date();
    const qrAge = (now - qrData.timestamp) / (1000 * 60); // em minutos
    
    if (qrAge > 5) {
      this.qrCodes.delete(tenantId);
      return { message: 'QR Code expirado. Aguarde um novo QR Code...' };
    }
    
    return {
      qr: qrData.qr,
      timestamp: qrData.timestamp,
      tenantId: tenantId
    };
  }
}
