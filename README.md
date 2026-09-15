# CFloral

Aplicación web (instalable como PWA) para administrar una floristería con varias tiendas: pedidos con factura, clientes e inventario. Pensada para crecer hacia contabilidad, proveedores y reportes.

## Estructura

```
server/   API REST (Node + Express + TypeScript + Prisma + MySQL)
client/   Web/PWA (React + Vite + TypeScript + Tailwind)
```

## Modelo de datos (MVP)

- **Store**: cada una de las 3 tiendas.
- **User**: usuarios con rol `ADMIN` (ve todas las tiendas), `MANAGER`/`EMPLOYEE` (fijos a una tienda).
- **Customer**: clientes, compartidos entre las 3 tiendas.
- **Product**: catálogo/inventario, uno por tienda (mismo nombre puede repetirse en cada tienda con su propio stock y precio).
- **Order** + **OrderItem**: pedidos con número de factura autogenerado (`F-000001`), estado (pendiente/en proceso/entregado/cancelado) y estado de pago (sin pagar/parcial/pagado). Al crear un pedido se descuenta el stock automáticamente.

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

## Instalarlo en un servidor propio (on-premise)

El backend sirve también la web ya construida (un solo proceso, un solo puerto), así que en el servidor solo hace falta:

1. **Instalar** Node.js 18+ y MySQL 8+ en el servidor (o usar el MySQL que ya tengan).
2. **Copiar el código** al servidor (`git clone` del repo, o subir el `.zip`) y crear la base de datos como se indica arriba.
3. **Compilar** el backend y el frontend:
   ```bash
   cd server && npm install && npx prisma migrate deploy && npm run build
   cd ../client && npm install && npm run build
   ```
4. **Arrancar** el proceso (queda escuchando en el puerto de `PORT`, por defecto 4000):
   ```bash
   cd server && node dist/index.js
   ```
   Al primer arranque, si la base está vacía, se crean solas las 3 tiendas y el usuario `admin@cfloral.com` / `admin123`.
5. **Dejarlo corriendo siempre** — para que sobreviva a reinicios y reinicie solo si falla, usa `pm2` (`npm i -g pm2 && pm2 start dist/index.js --name cfloral && pm2 save && pm2 startup`) o un servicio `systemd`.
6. **Acceso desde la red/celulares** — si el servidor tiene una IP fija en la red de las tiendas, cada empleada abre `http://IP-DEL-SERVOR:4000` desde su navegador o celular (misma red/VPN) y puede "Agregar a pantalla de inicio". Si quieren un dominio propio y HTTPS, se pone un reverse proxy (Nginx/Apache) delante apuntando al puerto 4000.

**Importante para producción:**
- Cambia `JWT_SECRET` en el `.env` del servidor a un valor largo y aleatorio propio (no el de ejemplo).
- Cambia la contraseña del usuario `admin@cfloral.com` en cuanto entren por primera vez.
- Haz respaldos periódicos de la base MySQL (`mysqldump`), ya que ahí vive toda la información del negocio.

*(El repo también incluye un `render.yaml` por si en algún momento prefieren desplegarlo en la nube en vez de on-premise — no es necesario para la instalación local.)*

## Roadmap sugerido

1. **Ahora (MVP):** clientes, inventario por tienda, pedidos con factura interna. ✅
2. **Siguiente:** reportes de ventas por tienda/período, historial de pedidos por cliente, alertas de stock bajo por email/WhatsApp.
3. **Proveedores:** catálogo de proveedores, órdenes de compra, recepción de mercancía (actualiza inventario).
4. **Contabilidad:** cuentas por cobrar/pagar, gastos, cierre de caja diario por tienda, integración con facturación electrónica fiscal si el país lo requiere.
5. **Multiusuario avanzado:** permisos más finos, auditoría de cambios, app nativa si se necesita cámara/notificaciones push.

El modelo de datos ya está preparado para estas ampliaciones (todo queda separado por tienda desde el día uno), así que cada fase se agrega sin tener que rehacer lo existente.
