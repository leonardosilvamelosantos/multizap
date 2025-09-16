import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import instanceRoutes from './routes/instances.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Rotas
app.use('/api/instances', instanceRoutes);

// Rota principal - redirecionar para dashboard
app.get('/', (req, res) => {
  res.redirect('/dashboard-unified.html');
});

// Rota de status
app.get('/api/status', (req, res) => {
  res.json({
    message: 'MultiZap WhatsApp API - Dashboard Unificado',
    status: 'online',
    timestamp: new Date().toISOString(),
    dashboard: 'http://localhost:3000/dashboard-unified.html'
  });
});

// Tratamento de erros
process.on('uncaughtException', (error) => {
  console.error('❌ Erro não capturado:', error.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Promise rejeitada:', reason);
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 MultiZap Dashboard Unificado rodando na porta ${PORT}`);
  console.log(`🌐 Acesse: http://localhost:${PORT}/dashboard-unified.html`);
});