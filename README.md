# 📡 MVR: Subsistema IoT, Edge Computing y Telemetría de Red

![Arquitectura](https://img.shields.io/badge/Architecture-Edge_Computing-blue)
![Seguridad](https://img.shields.io/badge/Security-Zero_Trust-red)
![Despliegue](https://img.shields.io/badge/Deployment-Docker_Compose-2496ED?logo=docker)
![Capa de Red](https://img.shields.io/badge/Protocol-HTTP/TCP-lightgrey)

## 📌 Descripción del Proyecto
El sistema **MVR (Monitorización Volumétrica de Recursos)** es una infraestructura de telemetría IoT diseñada para la gestión automatizada de contenedores en entornos de *Smart Buildings* (Green Campus). 

A diferencia de las soluciones IoT monolíticas, esta arquitectura desacopla estrictamente la capa física de adquisición de datos de la capa transaccional. Implementa **Edge Computing** local para la sanitización de ruido, despliega microservicios aislados mediante virtualización ligera (**Docker**) y protege el servidor anfitrión mediante políticas de red **Zero Trust**.

---

## 🏗️ Arquitectura de Red y Flujo de Datos

El flujo de telemetría está segmentado en cuatro capas lógicas y físicas para aislar el hardware de la base de datos de producción:

1. **Capa Física (Adquisición):** Microcontrolador Arduino Mega 2560 y sensor acústico HC-SR04. Operación sin NIC nativa. Transmisión asíncrona vía bus serial (USB).
2. **Capa de Borde (Edge Gateway):** Servicio *daemon* en Python ejecutado en un host local. Decodifica el tráfico serial, audita las anomalías físicas y encapsula el dato limpio.
3. **Capa de Transporte (Enrutamiento Seguro):** Inyección asíncrona mediante HTTP POST a través de la WLAN. Frontera de seguridad gestionada por Firewall Perimetral con *Default-Deny*.
4. **Capa Transaccional (Backend & Persistencia):** API RESTful (Node.js) que valida el contrato de datos JSON e inyecta los registros en una BBDD (MySQL) mediante consultas parametrizadas (Prevención SQLi).

---

## 🛡️ Seguridad y Políticas de Red (Zero Trust)

El sistema asume que la red local es hostil. Se han implementado las siguientes defensas perimetrales y de aplicación:

* **Bloqueo ICMP:** Política *Drop* para peticiones Echo. El servidor es invisible ante escaneos de red convencionales.
* **ACL Restrictiva (TCP 3000):** Se habilita exclusivamente el puerto 3000 en el Firewall del Host anfitrión, mapeado directamente hacia la red interna bridge de Docker.
* **Validación de Contrato (Middleware):** La API rechaza cualquier paquete HTTP mal formado o con llaves JSON discrepantes, devolviendo 400 Bad Request antes de interactuar con el motor relacional.

---

## ⚙️ Edge Computing: Sanitización de Datos

Los sensores ultrasónicos de bajo coste generan rebotes y ecos acústicos (ej. distancias de >1000 cm en contenedores de 100 cm). Para evitar el envenenamiento de la base de datos histórica (*Garbage In, Garbage Out*), el script de pasarela en Python audita el dato bruto:

    # Filtro Anti-Ruido en el Borde
    if distancia_real > ALTURA_CONTENEDOR_CM or distancia_real > LIMITE_FISICO_SENSOR:
        # Se bloquea la petición TCP localmente. 
        # El dato no consume ancho de banda ni ensucia la BBDD.
        continue 

---

## 🐳 Despliegue de Infraestructura (DevOps)

El entorno de servidor está contenerizado para garantizar la portabilidad y evitar fricciones entre entornos operativos. La persistencia de datos (Tolerancia a Fallos) se gestiona mediante volúmenes Docker (db_data:/var/lib/mysql).

### Requisitos Previos
* Docker Engine & Docker Compose
* Python 3.9+ (Para el nodo Gateway)
* Arduino Mega 2560 (Para el nodo físico)

### Instrucciones de Despliegue Rápido (Host)

1. **Clonar el repositorio:**

    git clone https://github.com/TuUsuario/mvr-iot-edge-telemetry.git
    cd mvr-iot-edge-telemetry

2. **Levantar los microservicios (Modo Detached):**

    docker-compose up -d

3. **Verificar el estado de los contenedores y el mapeo de puertos:**

    docker ps

4. **Iniciar el Edge Gateway (En el cliente local con el sensor conectado):**

    python ./edge_gateway/puente_fisico.py

---

## 🔌 Contrato de Datos de la API (JSON)

Para inyectar telemetría en el sistema, cualquier nodo *Edge* debe cumplir estrictamente con el siguiente contrato de datos. De lo contrario, la transacción será abortada.

**POST** http://<IP_HOST>:3000/api/telemetria

    {
      "sensor_id": "MVR_HARDWARE_01",
      "distancia_cm": 15,
      "porcentaje": 85,
      "fecha": "2026-05-29 14:30:00"
    }

---

## 👨‍💻 Perfil del Proyecto
Este proyecto de infraestructura constituye el trabajo final de especialización técnica en **Administración de Sistemas Informáticos en Red**. Diseñado para operar en entornos corporativos con altos requerimientos de disponibilidad, aislamiento de red y seguridad en el borde.