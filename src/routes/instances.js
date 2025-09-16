import express from 'express';
import { InstanceManager } from '../whatsapp/InstanceManager.js';

const router = express.Router();
const instanceManager = new InstanceManager();

// Criar instância para um tenant
router.post('/:tenantId/connect', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const options = req.body.options || {};

    const result = await instanceManager.createInstance(tenantId, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obter status de uma instância
router.get('/:tenantId/status', (req, res) => {
  try {
    const { tenantId } = req.params;
    const status = instanceManager.getInstanceStatus(tenantId);
    res.json(status);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obter QR Code de uma instância
router.get('/:tenantId/qr', (req, res) => {
  try {
    const { tenantId } = req.params;
    const status = instanceManager.getInstanceStatus(tenantId);
    
    if (!status.success) {
      return res.status(404).json(status);
    }

    if (status.qrCode) {
      res.json({ 
        success: true, 
        qr: status.qrCode.data,
        timestamp: status.qrCode.timestamp
      });
    } else {
      res.json({ 
        success: false, 
        message: 'QR Code ainda não foi gerado. Aguarde...' 
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Desconectar instância
router.delete('/:tenantId/disconnect', async (req, res) => {
  try {
    const { tenantId } = req.params;
    await instanceManager.removeInstance(tenantId);
    res.json({ success: true, message: 'Instância desconectada' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Listar todas as instâncias
router.get('/', (req, res) => {
  try {
    const instances = instanceManager.getAllInstances();
    res.json({ success: true, instances });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Enviar mensagem
router.post('/:tenantId/send', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Campos "to" e "message" são obrigatórios' 
      });
    }

    const result = await instanceManager.sendMessage(tenantId, to, message);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Enviar mídia
router.post('/:tenantId/send-media', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { to, media, caption } = req.body;

    if (!to || !media) {
      return res.status(400).json({ 
        success: false, 
        error: 'Campos "to" e "media" são obrigatórios' 
      });
    }

    const result = await instanceManager.sendMediaMessage(tenantId, to, media, caption);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obter estatísticas
router.get('/stats', (req, res) => {
  try {
    const instances = instanceManager.getAllInstances();
    const stats = {
      total: instances.length,
      connected: instances.filter(i => i.isConnected).length,
      disconnected: instances.filter(i => !i.isConnected).length,
      withQR: instances.filter(i => i.qrCode).length
    };
    
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
