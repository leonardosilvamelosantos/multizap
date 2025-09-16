import express from 'express';
import { WhatsAppSimple } from '../whatsapp/WhatsAppSimple.js';

const router = express.Router();
const whatsapp = new WhatsAppSimple();

// Conectar WhatsApp
router.post('/connect', async (req, res) => {
  try {
    const result = await whatsapp.connect();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obter status
router.get('/status', (req, res) => {
  try {
    const status = whatsapp.getStatus();
    res.json({ success: true, ...status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obter QR Code
router.get('/qr', (req, res) => {
  try {
    const status = whatsapp.getStatus();
    if (status.qrCode) {
      res.json({ success: true, qr: status.qrCode.data });
    } else {
      res.json({ success: false, message: 'QR Code não disponível' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Enviar mensagem
router.post('/send', async (req, res) => {
  try {
    const { to, message } = req.body;
    
    if (!to || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Parâmetros "to" e "message" são obrigatórios' 
      });
    }

    const result = await whatsapp.sendMessage(to, message);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Desconectar
router.post('/disconnect', async (req, res) => {
  try {
    await whatsapp.disconnect();
    res.json({ success: true, message: 'Desconectado com sucesso' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
