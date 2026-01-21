import express from 'express';
import { verifyOglobaToken } from '../utils/jwtValidator.js';
import { supabase } from '../config/supabase.js';

const router = express.Router();

// Webhook: Order Status
router.post('/order-status', async (req, res) => {
  try {
    console.log('📥 Webhook Order Status recibido:', JSON.stringify(req.body, null, 2));
    
    const { token } = req.body;
    
    if (!token || !Array.isArray(token) || token.length === 0) {
      console.error('❌ Token no proporcionado o formato incorrecto');
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
    
    const orderData = verification.data;
    console.log('✅ Orden validada:', orderData);
    
    // Actualizar orden en Supabase
    const { data: order, error } = await supabase
      .from('orders')
      .update({
        status: orderData.orderStatus,
        confirm_date: orderData.confirmDate,
        error_code: orderData.errorCode,
        updated_at: new Date().toISOString()
      })
      .eq('order_no', orderData.orderNo)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error actualizando orden:', error);
      return res.status(500).json({
        success: false,
        error: 'Error actualizando orden en base de datos'
      });
    }
    
    console.log('✅ Orden actualizada en DB:', order);
    
    res.json({
      success: true,
      message: 'Webhook procesado correctamente',
      orderNo: orderData.orderNo
    });
    
  } catch (error) {
    console.error('❌ Error en webhook order-status:', error);
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
        error: 'Token JWT inválido'
      });
    }
    
    const productData = verification.data;
    console.log('✅ Actualización de producto validada:', productData);
    
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
