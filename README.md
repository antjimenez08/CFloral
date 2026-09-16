# CFloral

Aplicación web (instalable como PWA) para administrar una floristería con varias tiendas: pedidos con factura, clientes e inventario. Pensada para crecer hacia contabilidad, proveedores y reportes.

## Estructura

```
server/   API REST (Node + Express + TypeScript + Prisma + MySQL)
client/   Web/PWA (React + Vite + TypeScript + Tailwind)
```

## Modelo de datos

Los tres módulos están pensados como en sistemas de gestión de floristerías (CRM con fechas
especiales, ocasión y destinatario del pedido, control de perecibilidad en inventario), de forma
que ya queden capturados los datos necesarios para más adelante hacer analítica predictiva
(segmentación RFM, demanda estacional por ocasión, tasa de satisfacción, etc.) sin tener que
rediseñar el esquema.

- **Store**: cada una de las 3 tiendas.
- **User**: usuarios con rol `ADMIN` (ve todas las tiendas), `MANAGER`/`EMPLOYEE` (fijos a una tienda). Un pedido puede tener un diseñador/florista asignado (`assignedTo`).
- **Customer**: clientes, compartidos entre las 3 tiendas.
  - Tipo (persona/empresa), documento, fecha de nacimiento, contacto preferido y canal por el que llegó.
  - **CustomerAddress**: direcciones guardadas (casa, oficina, "casa de mamá"...) con su propio destinatario/teléfono, para reusarlas en pedidos futuros.
  - **CustomerSpecialDate**: fechas recurrentes (cumpleaños, aniversario) para poder contactar al cliente antes de la fecha.
  - Estadísticas RFM recalculadas en cada pedido: `lastOrderAt`, `ordersCount`, `lifetimeValue` — base para segmentar clientes (frecuentes, en riesgo de fuga, VIP) sin tener que agregar todos los pedidos en cada consulta.
- **Product**: catálogo/inventario, uno por tienda (mismo nombre puede repetirse en cada tienda con su propio stock y precio).
  - Categoría, SKU, color y etiquetas de ocasión (para sugerir productos según el motivo del pedido).
  - Costo de compra (además del precio de venta, para calcular margen), cantidad sugerida de reorden y vida útil en días (control de frescura de flores).
- **Order** + **OrderItem**: pedidos con número de factura autogenerado (`F-000001`).
  - Estado ampliado (pendiente/en proceso/**listo para recoger**/**en camino**/entregado/cancelado) y estado de pago (sin pagar/parcial/pagado). Al crear un pedido se descuenta el stock automáticamente.
  - Ocasión (cumpleaños, aniversario, condolencias, boda...) y canal de entrada (tienda, teléfono, WhatsApp, web...), la señal más útil para anticipar demanda estacional.
  - Destinatario del pedido (nombre/teléfono/relación) y mensaje de tarjeta, ya que en floristería quien compra y quien recibe suelen ser personas distintas.
  - Entrega: recoger en tienda o domicilio, con dirección/ciudad/ventana horaria y bandera de "urgente".
  - Descuento y costo de envío (el total se calcula como subtotal − descuento + envío).
  - Calificación de satisfacción (1–5) y comentario, capturables después de la entrega — insumo directo para analítica de atención al cliente.

## Requisitos

- Node.js 18+
- MySQL 8+ (o MariaDB 10.6+)

## Poner en marcha el backend

```bash
cd server
cp .env.example .env   # ajusta DATABASE_URL y JWT_SECRET
npm install
npx prisma migrate dev --name init
npm run seed            # crea tiendas, un admin y datos de ejemplo
npm run dev             # http://localhost:4000
```

`DATABASE_URL` en `.env` sigue el formato `mysql://usuario:password@host:puerto/basededatos`, por ejemplo:

```
DATABASE_URL="mysql://cfloral:cfloral_dev@localhost:3306/cfloral"
```

Crear el usuario y la base en MySQL (una sola vez):

```sql
CREATE DATABASE cfloral CHARACTER SET utf8mb4;
CREATE USER 'cfloral'@'localhost' IDENTIFIED BY 'cfloral_dev';
GRANT ALL PRIVILEGES ON cfloral.* TO 'cfloral'@'localhost';
FLUSH PRIVILEGES;
```

Usuarios de ejemplo tras el seed:
- `admin@cfloral.com` / `admin123` (ve las 3 tiendas)
- `centro@cfloral.com` / `empleada123` (fijo a "Floral Centro")

## Poner en marcha el frontend

```bash
cd client
npm install
npm run dev              # http://localhost:5173 (proxy a la API en :4000)
```

Para instalar como app en el celular: abrir la web en Chrome/Safari móvil y usar "Agregar a pantalla de inicio" (ya incluye manifest e íconos).

## Instalarlo en el servidor Windows

El backend sirve también la web ya construida (un solo proceso, un solo puerto). Como el servidor ya tiene MySQL instalado, solo falta lo siguiente (todo en PowerShell o CMD, como Administrador):

### 1. Instalar Node.js

Descarga el instalador **LTS** desde [nodejs.org](https://nodejs.org) y ejecútalo (siguiente, siguiente...), o si tienen `winget`:

```powershell
winget install OpenJS.NodeJS.LTS
```

Verifica: `node -v` y `npm -v` en una terminal nueva.

### 2. Crear la base de datos en el MySQL que ya tienen

Abre **MySQL Command Line Client** (o `mysql -u root -p` desde cmd si `mysql` está en el PATH) y ejecuta:

```sql
CREATE DATABASE cfloral CHARACTER SET utf8mb4;
CREATE USER 'cfloral'@'localhost' IDENTIFIED BY 'cfloral_dev';
GRANT ALL PRIVILEGES ON cfloral.* TO 'cfloral'@'localhost';
FLUSH PRIVILEGES;
```

(Cambia `cfloral_dev` por una contraseña propia si quieres.)

### 3. Copiar el código al servidor

Si tienen Git instalado: `git clone https://github.com/antjimenez08/CFloral.git`. Si no, descargan el `.zip` desde GitHub (botón verde **Code → Download ZIP**) y lo descomprimen, por ejemplo en `C:\CFloral`.

### 4. Configurar y compilar

```powershell
cd C:\CFloral\server
copy .env.example .env
notepad .env
```

En `.env`, deja `DATABASE_URL` apuntando a la base que creaste y pon un `JWT_SECRET` propio (cualquier texto largo al azar):

```
DATABASE_URL="mysql://cfloral:cfloral_dev@localhost:3306/cfloral"
JWT_SECRET="pon-aqui-un-texto-largo-y-al-azar"
PORT=4000
```

Guarda y cierra, luego compila backend y frontend:

```powershell
cd C:\CFloral\server
npm install
npx prisma migrate deploy
npm run build

cd C:\CFloral\client
npm install
npm run build
```

### 5. Probarlo manualmente primero

```powershell
cd C:\CFloral\server
node dist\index.js
```

Debe aparecer `CFloral escuchando en http://localhost:4000`. Abre esa URL en el navegador del mismo servidor para confirmar que carga. Al primer arranque, si la base está vacía, se crean solas las 3 tiendas y el usuario `admin@cfloral.com` / `admin123`. Cierra con Ctrl+C cuando confirmes que funciona.

### 6. Dejarlo corriendo siempre como servicio de Windows

Para que no dependa de tener una ventana abierta y arranque solo si se reinicia el servidor, usa **NSSM** (Non-Sucking Service Manager), una herramienta gratuita para convertir cualquier programa en un servicio de Windows:

1. Descarga NSSM desde [nssm.cc](https://nssm.cc/download) y descomprime `nssm.exe` en, por ejemplo, `C:\CFloral\nssm.exe`.
2. En PowerShell (como Administrador):
   ```powershell
   C:\CFloral\nssm.exe install CFloral
   ```
3. Se abre una ventana: en **Path** pon la ruta a `node.exe` (normalmente `C:\Program Files\nodejs\node.exe`), en **Startup directory** pon `C:\CFloral\server`, y en **Arguments** pon `dist\index.js`. Click **Install service**.
4. Arráncalo:
   ```powershell
   nssm start CFloral
   ```
   Desde ahora el servicio arranca solo con Windows y se reinicia si el proceso falla. Se administra como cualquier servicio desde `services.msc` (buscar "CFloral").

### 7. Acceso desde las tiendas/celulares

Averigua la IP del servidor en la red local (`ipconfig`, busca "Dirección IPv4"). Abre el puerto 4000 en el **Firewall de Windows** (Firewall de Windows Defender → Reglas de entrada → Nueva regla → Puerto → TCP 4000 → Permitir). Luego, desde cualquier computadora o celular conectado a la misma red (o VPN), abren `http://IP-DEL-SERVIDOR:4000` y pueden "Agregar a pantalla de inicio" desde el navegador.

**Importante para producción:**
- Cambia la contraseña del usuario `admin@cfloral.com` en cuanto entren por primera vez.
- Haz respaldos periódicos de la base con `mysqldump` (o el respaldo automático que ya tengan configurado en ese MySQL), ya que ahí vive toda la información del negocio.
- Si más adelante actualizas el código (`git pull` + repetir el paso 4 de compilar), solo necesitas `nssm restart CFloral` para que tome los cambios.

*(El repo también incluye un `render.yaml` por si en algún momento prefieren además tenerlo accesible desde internet vía la nube — no es necesario para esta instalación local.)*

## Roadmap sugerido

1. **Ahora (MVP+):** clientes con perfil completo (direcciones, fechas especiales, RFM), inventario con categorías/costos/perecibilidad, pedidos con ocasión/destinatario/entrega/calificación. ✅
2. **Siguiente:** dashboard de reportes y analítica predictiva — segmentación de clientes (frecuentes/en riesgo de fuga/VIP) a partir de las estadísticas RFM ya capturadas, demanda estacional por ocasión, alertas de stock bajo y de fechas especiales próximas por email/WhatsApp.
3. **Proveedores:** catálogo de proveedores, órdenes de compra, recepción de mercancía (actualiza inventario y `receivedAt`).
4. **Contabilidad:** cuentas por cobrar/pagar, gastos, cierre de caja diario por tienda, integración con facturación electrónica fiscal si el país lo requiere.
5. **Multiusuario avanzado:** permisos más finos, auditoría de cambios, app nativa si se necesita cámara/notificaciones push.

El modelo de datos ya está preparado para estas ampliaciones (todo queda separado por tienda desde el día uno), así que cada fase se agrega sin tener que rehacer lo existente.
