import { WhatsAppInstanceUnified as WhatsAppInstance } from './WhatsAppInstanceUnified.js';
import fs from 'fs';
import path from 'path';

export class InstanceManager {
  constructor() {
    this.instances = new Map();
    this.sessions = new Map();
    this.maxInstances = 10; // Limite de instâncias simultâneas
    this.cleanupInterval = null;
    
    // Iniciar limpeza automática
    this.startCleanupInterval();
  }

  // Criar nova instância para um tenant
  async createInstance(tenantId, options = {}) {
    try {
      // Verificar se já existe instância ativa
      if (this.instances.has(tenantId)) {
        const existing = this.instances.get(tenantId);
        if (existing.isConnected) {
          console.log(`⚠️ Instância já existe e está conectada para tenant: ${tenantId}`);
          return { success: true, message: 'Instância já existe e está conectada' };
        }
        // Se está conectando, aguardar ou retornar erro
        if (existing.isConnecting) {
          console.log(`⚠️ Instância já está conectando para tenant: ${tenantId}`);
          return { success: false, error: 'Instância já está conectando' };
        }
        // Remover instância existente se não estiver conectada
        console.log(`🗑️ Removendo instância existente para tenant: ${tenantId}`);
        await this.removeInstance(tenantId);
        // Aguardar um pouco antes de criar nova instância
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Verificar limite de instâncias
      if (this.instances.size >= this.maxInstances) {
        return { success: false, error: 'Limite de instâncias atingido' };
      }

      console.log(`🔧 Criando instância para tenant: ${tenantId}`);
      
      const instance = new WhatsAppInstance(tenantId, options);
      
      // Configurar eventos da instância
      this.setupInstanceEvents(instance);
      
      // Conectar instância
      const result = await instance.connect();
      
      if (result.success) {
        this.instances.set(tenantId, instance);
        this.sessions.set(tenantId, {
          tenantId,
          createdAt: new Date(),
          lastActivity: new Date(),
          status: 'connecting'
        });
      }
      
      return result;
    } catch (error) {
      console.error(`❌ Erro ao criar instância para tenant ${tenantId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  // Configurar eventos da instância
  setupInstanceEvents(instance) {
    instance.on('connected', () => {
      const session = this.sessions.get(instance.tenantId);
      if (session) {
        session.status = 'connected';
        session.lastActivity = new Date();
      }
      console.log(`✅ Instância conectada: ${instance.tenantId}`);
    });

    instance.on('disconnected', (data) => {
      const session = this.sessions.get(instance.tenantId);
      if (session) {
        session.status = 'disconnected';
        session.lastActivity = new Date();
      }
      console.log(`🔌 Instância desconectada: ${instance.tenantId}`, data);
    });

    instance.on('qr_generated', (qrData) => {
      const session = this.sessions.get(instance.tenantId);
      if (session) {
        session.qrCode = qrData;
        session.status = 'qr_ready';
      }
      console.log(`📱 QR Code gerado para tenant: ${instance.tenantId}`);
    });

    instance.on('message', (messageData) => {
      const session = this.sessions.get(instance.tenantId);
      if (session) {
        session.lastActivity = new Date();
      }
      // Aqui você pode implementar o processamento de mensagens
      console.log(`📨 Mensagem processada para tenant: ${instance.tenantId}`);
    });

    instance.on('error', (error) => {
      console.error(`❌ Erro na instância ${instance.tenantId}:`, error.message);
    });

    instance.on('critical_error', (data) => {
      console.error(`💥 Erro crítico na instância ${instance.tenantId}:`, data);
      // Remover instância em caso de erro crítico
      this.removeInstance(instance.tenantId);
    });
  }

  // Remover instância
  async removeInstance(tenantId) {
    try {
      const instance = this.instances.get(tenantId);
      if (instance) {
        await instance.disconnect();
        this.instances.delete(tenantId);
      }
      
      this.sessions.delete(tenantId);
      console.log(`🗑️ Instância removida para tenant: ${tenantId}`);
    } catch (error) {
      console.error(`❌ Erro ao remover instância do tenant ${tenantId}:`, error.message);
    }
  }

  // Obter instância
  getInstance(tenantId) {
    return this.instances.get(tenantId);
  }

  // Obter status de uma instância
  getInstanceStatus(tenantId) {
    const instance = this.instances.get(tenantId);
    const session = this.sessions.get(tenantId);
    
    if (!instance || !session) {
      return { success: false, error: 'Instância não encontrada' };
    }

    return {
      success: true,
      ...instance.getStatus(),
      session: session
    };
  }

  // Listar todas as instâncias
  getAllInstances() {
    const instances = [];
    
    for (const [tenantId, instance] of this.instances.entries()) {
      const session = this.sessions.get(tenantId);
      instances.push({
        tenantId,
        ...instance.getStatus(),
        session: session
      });
    }
    
    return instances;
  }

  // Enviar mensagem
  async sendMessage(tenantId, to, message) {
    try {
      const instance = this.instances.get(tenantId);
      if (!instance) {
        return { success: false, error: 'Instância não encontrada' };
      }

      return await instance.sendMessage(to, message);
    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem para tenant ${tenantId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  // Enviar mídia
  async sendMediaMessage(tenantId, to, media, caption = '') {
    try {
      const instance = this.instances.get(tenantId);
      if (!instance) {
        return { success: false, error: 'Instância não encontrada' };
      }

      return await instance.sendMediaMessage(to, media, caption);
    } catch (error) {
      console.error(`❌ Erro ao enviar mídia para tenant ${tenantId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  // Limpeza automática
  startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveInstances();
    }, 300000); // 5 minutos
  }

  // Limpar instâncias inativas
  async cleanupInactiveInstances() {
    try {
      const now = new Date();
      const maxInactiveTime = 30 * 60 * 1000; // 30 minutos

      for (const [tenantId, session] of this.sessions.entries()) {
        const timeSinceActivity = now - session.lastActivity;
        
        if (timeSinceActivity > maxInactiveTime) {
          console.log(`🧹 Limpando instância inativa: ${tenantId}`);
          await this.removeInstance(tenantId);
        }
      }
    } catch (error) {
      console.error(`❌ Erro na limpeza automática:`, error.message);
    }
  }

  // Parar gerenciador
  async stop() {
    try {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }

      // Desconectar todas as instâncias
      for (const [tenantId, instance] of this.instances.entries()) {
        await instance.disconnect();
      }

      this.instances.clear();
      this.sessions.clear();
      
      console.log(`🛑 Gerenciador de instâncias parado`);
    } catch (error) {
      console.error(`❌ Erro ao parar gerenciador:`, error.message);
    }
  }
}
