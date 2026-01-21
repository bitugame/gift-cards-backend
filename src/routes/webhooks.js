import express from 'express';
import { verifyOglobaToken } from '../utils/jwtValidator.js';
import { supabase } from '../config/supabase.js';

const router = express.Router();

// Webhook: Order Status
router.post('/order-status', async (req, res) => {
  try {
    console.log('📥 Webhook Order Status recibido:', JSON.stringify(req.body, null, 2));
    
    const { token } = req.body;
    
    // Validar que el token existe y es un array
    if (!token || !Array.isArray(token) || token.length === 0) {
      console.error('❌ Token no proporcionado o formato incorrecto');
      return res.status(400).json({
        success: false,
        error: 'Token JWT no proporcionado o formato incorrecto'
      });
    }
    
    // Validar JWT
    const jwtToken = token[0];
    console.log('🔍 Validando token JWT...');
    
    const verification = verifyOglobaToken(jwtToken);
    
    if (!verification.valid) {
      console.error('❌ Token inválido:', verification.error);
      return res.status(401).json({
        success: false,
        error: 'Token JWT inválido',
        details: verification.error
      });
    }
    
    const orderData = verification.data;
    console.log('✅ Token validado. Datos de la orden:', orderData);
    
    // Verificar que los datos existen
    if (!orderData || !orderData.orderNo) {
      console.error('❌ Datos de orden incompletos:', orderData);
      return res.status(400).json({
        success: false,
        error: 'Datos de orden incompletos en el token'
      });
    }
    
    // Actualizar orden en Supabase
    console.log(`📝 Actualizando orden ${orderData.orderNo} en Supabase...`);
    
    const { data: order, error } = await supabase
      .from('orders')
      .update({
        status: orderData.orderStatus,
        confirm_date: orderData.confirmDate,
        error_code: orderData.errorCode || '0',
        updated_at: new Date().toISOString()
      })
      .eq('order_no', orderData.orderNo)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error actualizando orden en Supabase:', error);
      // Aún así respondemos success a Ogloba para que no reenvíe
      return res.json({
        success: true,
        message: 'Webhook recibido pero error al guardar en DB',
        orderNo: orderData.orderNo,
        error: error.message
      });
    }
    
    console.log('✅ Orden actualizada exitosamente en DB:', order);
    
    // Responder a Ogloba
    res.json({
      success: true,
      message: 'Webhook procesado correctamente',
      orderNo: orderData.orderNo,
      status: orderData.orderStatus
    });
    
  } catch (error) {
    console.error('❌ Error general en webhook order-status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Webhook: Product Update
router.post('/product-update', async (req, res) => {
  try {
    console.log('📥 Webhook Product Update recibido:', JSON.stringify(req.body, null, 2));
    
    const { token } = req.body;
    
    if (!token || !Array.isArray(token) || token.length === 0) {
      console.error('❌ Token no proporcionado');
      return res.status(400).json({
        success: false,
        error: 'Token JWT no proporcionado'
      });
    }
    
    // Validar JWT
    const jwtToken = token[0];
    const verification = verifyOglobaToken(jwtToken);
    
    if (!verification.valid) {
      console.error('❌ Token inválido:', verification.error);
      return res.status(401).json({
        success: false,
        error: 'Token JWT inválido',
        details: verification.error
      });
    }
    
    const productData = verification.data;
    console.log('✅ Actualización de producto validada:', productData);
    
    // Aquí puedes procesar la actualización de productos
    // Por ahora solo lo registramos
    
    res.json({
      success: true,
      message: 'Webhook de producto procesado correctamente'
    });
    
  } catch (error) {
    console.error('❌ Error en webhook product-update:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;