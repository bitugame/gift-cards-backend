const fetch = require('node-fetch');

const API_BASE_URL = process.env.OGLOBA_API_URL;
const API_USERNAME = process.env.OGLOBA_USERNAME;
const API_PASSWORD = process.env.OGLOBA_PASSWORD;
const MERCHANT_ID = process.env.OGLOBA_MERCHANT_ID;
const TERMINAL_ID = process.env.OGLOBA_TERMINAL_ID;
const CASHIER_ID = process.env.OGLOBA_CASHIER_ID || '001';

// Crear header de autenticación
function getAuthHeader() {
  const credentials = `${API_USERNAME}:${API_PASSWORD}`;
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

// Mensajes de error en español
const ERROR_MESSAGES = {
  '73': 'Monto fuera del rango permitido',
  '88': 'El producto no existe',
  '169': 'El número de orden ya existe',
  '23012': 'No se puede cancelar una orden confirmada',
};

// Función genérica para llamar a Ogloba
async function oglobaRequest(endpoint, body) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  console.log(`🔄 Llamando a Ogloba: ${endpoint}`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WSRG-API-Version': '2.18',
        'Authorization': getAuthHeader(),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Ogloba devuelve isSuccessful: false cuando hay error
    if (data.isSuccessful === false) {
      const errorMsg = ERROR_MESSAGES[data.errorCode] || data.errorMessage || 'Error desconocido';
      throw new Error(`[${data.errorCode}] ${errorMsg}`);
    }

    return data;
  } catch (error) {
    console.error(`❌ Error en ${endpoint}:`, error.message);
    throw error;
  }
}

// Obtener información de la cuenta (saldo)
async function getBuInfo() {
  return oglobaRequest('/getBuInfo', {
    merchantId: MERCHANT_ID,
    terminalId: TERMINAL_ID,
  });
}

// Obtener catálogo de productos
async function getProducts() {
  const response = await oglobaRequest('/getProducts', {
    merchantId: MERCHANT_ID,
    terminalId: TERMINAL_ID,
  });
  return response.productList || [];
}

// Crear orden
async function createOrder(clientOrderNo, orderItems) {
  return oglobaRequest('/orderCreation', {
    merchantId: MERCHANT_ID,
    terminalId: TERMINAL_ID,
    cashierId: CASHIER_ID,
    clientOrderNo,
    salesType: 'MA',
    orderItems,
  });
}

// Confirmar orden (pago)
async function confirmOrder(orderNo) {
  return oglobaRequest('/orderConfirm', {
    merchantId: MERCHANT_ID,
    terminalId: TERMINAL_ID,
    cashierId: CASHIER_ID,
    orderNo,
    paymentList: [{
      paymentType: '01',
      paymentId: `X-${orderNo}`,
    }],
    shippingFee: '0',
    cardFee: '0',
    returnFee: '0',
  });
}

// Consultar estado de orden
async function getOrderStatus(orderNo) {
  return oglobaRequest('/orderStatus', {
    merchantId: MERCHANT_ID,
    terminalId: TERMINAL_ID,
    cashierId: CASHIER_ID,
    orderNo,
  });
}

module.exports = {
  getBuInfo,
  getProducts,
  createOrder,
  confirmOrder,
  getOrderStatus,
};