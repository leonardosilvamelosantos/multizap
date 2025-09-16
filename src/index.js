import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { WhatsAppManager } from './whatsapp/WhatsAppManager.js';
import { routes } from './routes/index.js';
import simpleRoutes from './routes/simple.js';
import instanceRoutes from './routes/instances.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Inicializar o gerenciador de WhatsApp
const whatsappManager = new WhatsAppManager();

// Rotas
app.use('/api', routes(whatsappManager));
app.use('/api/simple', simpleRoutes);
app.use('/api/instances', instanceRoutes);

// Rota de status
app.get('/', (req, res) => {
  res.json({
    message: 'MultiZap WhatsApp API',
    status: 'online',
    timestamp: new Date().toISOString(),
    endpoints: {
      tenants: '/api/tenants',
      simple: '/api/simple',
      instances: '/api/instances',
      dashboard: 'http://localhost:3000/dashboard.html',
      web: 'http://localhost:3000'
    },
    tenants: whatsappManager.getActiveTenants()
  });
});

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
  console.error('❌ Erro não capturado:', error.message);
  console.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rejeitada não tratada:', reason);
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📱 MultiZap WhatsApp API ativa`);
  console.log(`🌐 Interface web: http://localhost:${PORT}`);
});