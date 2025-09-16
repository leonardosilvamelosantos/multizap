import express from 'express';
import { tenantRoutes } from './tenant.js';
import { messageRoutes } from './message.js';

export const routes = (whatsappManager) => {
  const router = express.Router();

  // Rotas de tenants
  router.use('/tenants', tenantRoutes(whatsappManager));
  
  // Rotas de mensagens
  router.use('/messages', messageRoutes(whatsappManager));

  return router;
};
