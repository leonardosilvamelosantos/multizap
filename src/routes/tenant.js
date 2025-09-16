import express from 'express';

export const tenantRoutes = (whatsappManager) => {
  const router = express.Router();

  // Criar novo tenant
  router.post('/create', async (req, res) => {
    try {
      const { tenantId } = req.body;
      
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'tenantId é obrigatório'
        });
      }

      const result = await whatsappManager.createTenant(tenantId);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Obter status de um tenant
  router.get('/:tenantId/status', (req, res) => {
    try {
      const { tenantId } = req.params;
      const status = whatsappManager.getTenantStatus(tenantId);
      res.json(status);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Obter QR Code de um tenant
  router.get('/:tenantId/qr', (req, res) => {
    try {
      const { tenantId } = req.params;
      const qr = whatsappManager.getTenantQR(tenantId);
      res.json(qr);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Listar todos os tenants
  router.get('/', (req, res) => {
    try {
      const tenants = whatsappManager.getActiveTenants();
      res.json({ tenants });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Remover tenant
  router.delete('/:tenantId', (req, res) => {
    try {
      const { tenantId } = req.params;
      whatsappManager.removeTenant(tenantId);
      res.json({ success: true, message: `Tenant ${tenantId} removido` });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
};