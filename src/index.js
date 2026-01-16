const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { supabase } = require('./services/supabase');
const { getBuInfo, getProducts, createOrder, confirmOrder, getOrderStatus } = require('./services/ogloba');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());

// Logger simple
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// ============================================
// RUTAS PÚBLICAS
// ============================================

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// RUTAS DE API
// ============================================

// Obtener productos
app.get('/api/products', async (req, res) => {
  try {
    const products = await getProducts();
    const activeProducts = products.filter(p => p.allowedActivate === 1);
    
    res.json({
      success: true,
      products: activeProducts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Obtener dashboard (saldo + estadísticas)
app.get('/api/dashboard', async (req, res) => {
  try {
    // Saldo de Ogloba
    const buInfo = await getBuInfo();
    
    // Estadísticas de Supabase
    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    const today = new Date().toISOString().split('T')[0];
    const todayOrders = orders?.filter(o => o.created_at.startsWith(today)) || [];

    res.json({
      success: true,
      balance: buInfo.availableBalance || 0,
      stats: {
        totalOrders: orders?.length || 0,
        todayOrders: todayOrders.length,
        totalCards: orders?.reduce((sum, o) => sum + o.quantity, 0) || 0,
        todayCards: todayOrders.reduce((sum, o) => sum + o.quantity, 0) || 0,
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Crear orden
app.post('/api/orders', async (req, res) => {
  try {
    const { productCode, productName, amount, quantity } = req.body;

    // Generar número de orden único
    const clientOrderNo = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    console.log(`📦 Creando orden: ${quantity}x ${productName}`);

    // 1. Crear en Ogloba
    const orderItems = [{
      faceAmount: parseFloat(amount),
      quantity: parseInt(quantity),
      deliverType: '0',
      itemCode: productCode,
      deliverDate: '',
      message: '',
      receiverAddress: '',
      receiverEmail: '',
      receiverMobileNo: '',
      receiverName: '',
      senderEmail: '',
      senderName: '',
    }];

    const creationResponse = await createOrder(clientOrderNo, orderItems);
    console.log(`✅ Orden creada: ${creationResponse.orderNo}`);

    // 2. Confirmar orden
    const confirmResponse = await confirmOrder(creationResponse.orderNo);
    console.log(`✅ Orden confirmada`);

    // 3. Guardar en Supabase
    await supabase.from('orders').insert({
      order_no: creationResponse.orderNo,
      client_order_no: clientOrderNo,
      product_code: productCode,
      product_name: productName,
      face_amount: parseFloat(amount),
      quantity: parseInt(quantity),
      total_amount: parseFloat(amount) * parseInt(quantity),
      order_status: '043', // En proceso
      cards_data: [],
    });

    res.json({
      success: true,
      orderNo: creationResponse.orderNo,
      message: 'Orden creada. Generando tarjetas...'
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Consultar estado de orden
app.get('/api/orders/:orderNo', async (req, res) => {
  try {
    const { orderNo } = req.params;

    const statusResponse = await getOrderStatus(orderNo);

    // Si ya está completa, actualizar en Supabase
    if (statusResponse.orderStatus === '042' && statusResponse.listOfCards?.length > 0) {
      await supabase
        .from('orders')
        .update({
          order_status: '042',
          cards_data: statusResponse.listOfCards
        })
        .eq('order_no', orderNo);
    }

    res.json({
      success: true,
      orderStatus: statusResponse.orderStatus,
      cards: statusResponse.listOfCards || [],
      cardsCount: statusResponse.listOfCards?.length || 0
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// WEBHOOKS (Ogloba notifica aquí)
// ============================================

app.post('/api/webhooks/order-status', async (req, res) => {
  try {
    console.log('🔔 Webhook: Order Status');
    const { orderNo, orderStatus, listOfCards } = req.body;

    // Actualizar en Supabase
    await supabase
      .from('orders')
      .update({
        order_status: orderStatus,
        cards_data: listOfCards || []
      })
      .eq('order_no', orderNo);

    console.log(`✅ Orden ${orderNo} actualizada via webhook`);

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/webhooks/product-update', async (req, res) => {
  try {
    console.log('🔔 Webhook: Product Update');
    // Aquí podrías guardar en cache si quieres
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// INICIAR SERVIDOR
// ============================================

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('🚀 Gift Cards Backend API');
  console.log('================================');
  console.log(`Puerto: ${PORT}`);
  console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log('');
  console.log('📍 Endpoints disponibles:');
  console.log('  GET  /health');
  console.log('  GET  /api/products');
  console.log('  GET  /api/dashboard');
  console.log('  POST /api/orders');
  console.log('  GET  /api/orders/:orderNo');
  console.log('  POST /api/webhooks/order-status');
  console.log('  POST /api/webhooks/product-update');
  console.log('================================');
  console.log('');
});