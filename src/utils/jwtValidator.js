import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar llave pública (nombre correcto del archivo)
const PUBLIC_KEY_PATH = path.join(__dirname, '../../DH-TS_pk.pem');

export const verifyOglobaToken = (token) => {
  try {
    // Leer llave pública
    const publicKey = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
    
    // Verificar y decodificar token
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['HS256']
    });
    
    return {
      valid: true,
      data: decoded.object
    };
  } catch (error) {
    console.error('❌ Error validando JWT:', error.message);
    return {
      valid: false,
      error: error.message
    };
  }
};
