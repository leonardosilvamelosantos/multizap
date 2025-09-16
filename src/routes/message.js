import express from 'express';

export const messageRoutes = (whatsappManager) => {
  const router = express.Router();

  // Enviar mensagem
  router.post('/send', async (req, res) => {
    try {
      const { tenantId, to, message } = req.body;
      
      if (!tenantId || !to || !message) {
        return res.status(400).json({
          success: false,
          error: 'tenantId, to e message são obrigatórios'
        });
      }

      const result = await whatsappManager.sendMessage(tenantId, to, message);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Enviar mensagem com mídia
  router.post('/send-media', async (req, res) => {
    try {
      const { tenantId, to, media, caption } = req.body;
      
      if (!tenantId || !to || !media) {
        return res.status(400).json({
          success: false,
          error: 'tenantId, to e media são obrigatórios'
        });
      }

      const result = await whatsappManager.sendMediaMessage(tenantId, to, media, caption);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Obter mensagens de um chat
  router.get('/:tenantId/chat/:chatId', async (req, res) => {
    try {
      const { tenantId, chatId } = req.params;
      const { limit = 50 } = req.query;
      
      const messages = await whatsappManager.getChatMessages(tenantId, chatId, parseInt(limit));
      res.json({ messages });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
};
