/**
 * ARQUITECTURA DEL SISTEMA MVR (Monitorización Volumétrica de Recursos)
 * Servidor: Node.js + Express
 * Base de Datos: MySQL
 * Autor: Equipo ASIR
 */

const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const app = express();
const PORT = 3000;

// --- MIDDLEWARES (Capas de seguridad y procesamiento) ---
app.use(cors()); // Permite peticiones desde cualquier origen (útil para desarrollo)
app.use(bodyParser.json()); // Parsea los JSON que vienen del Arduino
app.use(morgan('dev')); // Muestra logs de tráfico en consola (Vital para depurar)

// Configuración para servir la web de Daniel (Frontend)
// Cualquier archivo en la carpeta 'public' será accesible vía web
app.use(express.static(path.join(__dirname, 'public')));

// --- CONFIGURACIÓN BASE DE DATOS ---
const db = mysql.createPool({
    connectionLimit: 15, // Pool de conexiones para aguantar concurrencia
    host: process.env.DB_HOST,          // Nombre del servicio en Docker Compose
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// Verificación de salud de la BD al iniciar
db.getConnection((err, connection) => {
    if (err) {
        console.error('ERROR FATAL: No se pudo conectar a la Base de Datos.', err.code);
        console.error('   Asegúrate de que el contenedor MySQL esté corriendo.');
    } else {
        console.log('✅ CONEXIÓN ESTABLECIDA con MySQL (mvr_system)');
        connection.release();
    }
});

// --- RUTAS DE LA API (ENDPOINTS) ---

/**
 * [POST] /api/telemetria
 * Recibe datos del Arduino.
 * Payload esperado: { "sensor_id": "CONT_01", "distancia": 45.5, "porcentaje": 80 }
 */
app.post('/api/telemetria', (req, res) => {
    const { sensor_id, distancia, porcentaje } = req.body;

    // Validación básica de seguridad
    if (!sensor_id || porcentaje === undefined) {
        return res.status(400).json({ error: 'Datos incompletos. Se requiere sensor_id y porcentaje.' });
    }

    const query = 'INSERT INTO registros_iot (sensor_id, distancia_cm, llenado_porcentaje) VALUES (?, ?, ?)';
    
    db.query(query, [sensor_id, distancia, porcentaje], (err, result) => {
        if (err) {
            console.error('Error insertando datos:', err);
            return res.status(500).json({ error: 'Error interno de base de datos' });
        }
        res.status(201).json({ message: 'Dato registrado correctamente', id: result.insertId });
        // Aquí podríamos disparar una alerta si porcentaje > 90 (Fase 2)
    });
});

/**
 * [GET] /api/historial
 * Devuelve los últimos 50 registros para las gráficas.
 */
app.get('/api/historial', (req, res) => {
    const query = 'SELECT * FROM registros_iot ORDER BY fecha DESC LIMIT 50';
    
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Error leyendo historial' });
        }
        res.json(results);
    });
});

/**
 * [GET] /api/estado-actual
 * CONSULTA AVANZADA: Devuelve solo el ÚLTIMO dato de cada contenedor.
 * Vital para el Dashboard principal (Semáforos).
 */
app.get('/api/estado-actual', (req, res) => {
    // Subconsulta SQL para obtener el ID más reciente por cada sensor
    const query = `
        SELECT r.* FROM registros_iot r
        INNER JOIN (
            SELECT sensor_id, MAX(id) as max_id
            FROM registros_iot
            GROUP BY sensor_id
        ) ultimos ON r.id = ultimos.max_id
    `;

    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Error obteniendo estado actual' });
        }
        res.json(results);
    });
});

// --- INICIO DEL SERVIDOR ---
app.listen(PORT, () => {
    console.log(`SERVIDOR ASIR MVR FUNCIONANDO EN PUERTO ${PORT}`);
    console.log(`Esperando datos de sensores...`);
});