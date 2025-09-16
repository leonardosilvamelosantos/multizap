import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000/api';

async function testMultiTenant() {
  console.log('🧪 Iniciando testes do MultiZap...\n');

  // Teste 1: Criar tenants
  console.log('1️⃣ Criando tenants...');
  
  const tenants = ['cliente1', 'cliente2', 'cliente3'];
  
  for (const tenantId of tenants) {
    try {
      const response = await fetch(`${API_BASE}/tenants/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId })
      });
      
      const result = await response.json();
      console.log(`✅ Tenant ${tenantId}: ${result.success ? 'Criado' : 'Erro'}`);
    } catch (error) {
      console.log(`❌ Erro ao criar tenant ${tenantId}:`, error.message);
    }
  }

  // Teste 2: Verificar status
  console.log('\n2️⃣ Verificando status dos tenants...');
  
  for (const tenantId of tenants) {
    try {
      const response = await fetch(`${API_BASE}/tenants/${tenantId}/status`);
      const status = await response.json();
      console.log(`📱 ${tenantId}: ${status.isConnected ? 'Conectado' : 'Desconectado'}`);
    } catch (error) {
      console.log(`❌ Erro ao verificar status:`, error.message);
    }
  }

  // Teste 3: Listar todos os tenants
  console.log('\n3️⃣ Listando todos os tenants...');
  
  try {
    const response = await fetch(`${API_BASE}/tenants`);
    const data = await response.json();
    console.log(`📊 Total de tenants ativos: ${data.tenants.length}`);
    data.tenants.forEach(tenant => {
      console.log(`   - ${tenant.id}: ${tenant.status}`);
    });
  } catch (error) {
    console.log(`❌ Erro ao listar tenants:`, error.message);
  }

  // Teste 4: Enviar mensagem de teste
  console.log('\n4️⃣ Testando envio de mensagem...');
  
  try {
    const response = await fetch(`${API_BASE}/messages/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'cliente1',
        to: '5511999999999@s.whatsapp.net',
        message: 'Teste de mensagem do MultiZap!'
      })
    });
    
    const result = await response.json();
    console.log(`📨 Mensagem: ${result.success ? 'Enviada' : 'Erro'}`);
  } catch (error) {
    console.log(`❌ Erro ao enviar mensagem:`, error.message);
  }

  console.log('\n🎉 Testes concluídos!');
  console.log('📱 Escaneie os QR Codes que apareceram no terminal para conectar os WhatsApps.');
}

// Executar testes
testMultiTenant().catch(console.error);
