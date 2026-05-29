import os
import serial
import requests
import time
from datetime import datetime
from dotenv import load_dotenv

# 1. Cargar el entorno ANTES de hacer nada
load_dotenv()

# ==========================================
# CONFIGURACIÓN (Desacoplada del código)
# ==========================================
# Variables obligatorias (Falla si no existen)
URL_SERVIDOR = os.getenv("SERVER_URL")

# Variables con valores por defecto (Seguridad por diseño)
PUERTO_ARDUINO = os.getenv("PUERTO_ARDUINO", "COM3")
ALTURA_CONTENEDOR_CM = int(os.getenv("ALTURA_CONTENEDOR_CM", 100))
SENSOR_ID = os.getenv("SENSOR_ID", "MVR_HARDWARE_01")
BAUD_RATE = int(os.getenv("BAUD_RATE", 9600))

# Validación estricta
if not URL_SERVIDOR:
    raise ValueError("[!] ERROR CRÍTICO: 'SERVER_URL' no está definida en el archivo .env.")

print("[*] INICIANDO PUENTE HARDWARE-RED...")
print(f"[*] Configuración cargada -> URL: {URL_SERVIDOR} | Puerto: {PUERTO_ARDUINO} | Sensor: {SENSOR_ID}")

try:
    arduino = serial.Serial(PUERTO_ARDUINO, BAUD_RATE, timeout=1)
    time.sleep(2)
    print(f"[+] Conectado al Arduino en {PUERTO_ARDUINO}")

    while True:
        if arduino.in_waiting > 0:
            lectura_usb = arduino.readline().decode('utf-8').strip()
            
            if lectura_usb.isdigit():
                distancia_real = int(lectura_usb)
                
                # 1. SANITIZACIÓN DE DATOS (Filtro HC-SR04)
                if distancia_real > ALTURA_CONTENEDOR_CM or distancia_real > 400:
                    print(f"[!] Lectura corrupta o fuera de rango detectada ({distancia_real}cm). Descartando...")
                    time.sleep(0.1)
                    continue
                
                # 2. Calcular porcentaje
                porcentaje_crudo = ((ALTURA_CONTENEDOR_CM - distancia_real) / ALTURA_CONTENEDOR_CM) * 100
                porcentaje_final = max(0, min(100, int(porcentaje_crudo)))

                # 3. Empaquetar JSON 
                payload = {
                    "sensor_id": SENSOR_ID,
                    "distancia_cm": distancia_real,
                    "porcentaje": porcentaje_final,
                    "fecha": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                }
                
                print(f"[Lectura: {distancia_real}cm] -> Enviando {porcentaje_final}%")
                
                # 4. Enviar a Servidor
                try:
                    respuesta = requests.post(URL_SERVIDOR, json=payload, timeout=2)
                    if respuesta.status_code not in [200, 201]:
                        print(f"    [X] Error Backend ({respuesta.status_code}): {respuesta.text}")
                except requests.exceptions.RequestException as e:
                    print(f"    [X] Fallo de red: {e}")
                    
        time.sleep(0.1)

except serial.SerialException:
    print(f"[!] No puedo abrir {PUERTO_ARDUINO}. ¿Está conectado? ¿Está abierto el Serial Monitor de Arduino?")
except KeyboardInterrupt:
    print("\n[*] Puente cerrado por el usuario.")
finally:
    if 'arduino' in locals() and arduino.is_open:
        arduino.close()