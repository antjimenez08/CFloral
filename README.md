# CFloral

Aplicación web (instalable como PWA) para administrar una floristería con varias tiendas: pedidos con factura, clientes e inventario. Pensada para crecer hacia contabilidad, proveedores y reportes.

## Estructura

```
server/   API REST (Node + Express + TypeScript + Prisma + PostgreSQL)
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
- PostgreSQL 14+

## Poner en marcha el backend

```bash
cd server
cp .env.example .env   # ajusta DATABASE_URL y JWT_SECRET
npm install
npx prisma migrate dev --name init
npm run seed            # crea tiendas, un admin y datos de ejemplo
npm run dev             # http://localhost:4000
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

## Roadmap sugerido

1. **Ahora (MVP):** clientes, inventario por tienda, pedidos con factura interna. ✅
2. **Siguiente:** reportes de ventas por tienda/período, historial de pedidos por cliente, alertas de stock bajo por email/WhatsApp.
3. **Proveedores:** catálogo de proveedores, órdenes de compra, recepción de mercancía (actualiza inventario).
4. **Contabilidad:** cuentas por cobrar/pagar, gastos, cierre de caja diario por tienda, integración con facturación electrónica fiscal si el país lo requiere.
5. **Multiusuario avanzado:** permisos más finos, auditoría de cambios, app nativa si se necesita cámara/notificaciones push.

El modelo de datos ya está preparado para estas ampliaciones (todo queda separado por tienda desde el día uno), así que cada fase se agrega sin tener que rehacer lo existente.
