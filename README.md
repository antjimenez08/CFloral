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

## Publicarlo en internet (para probarlo en la web, gratis)

El backend sirve también la web (un solo servicio), así que solo hace falta desplegar `server/` con una base de datos PostgreSQL. Pasos con servicios gratuitos:

1. **Base de datos** — crea una cuenta gratis en [neon.tech](https://neon.tech) (o Supabase), crea un proyecto y copia la cadena de conexión `postgresql://...` que te da.
2. **Hosting** — crea una cuenta gratis en [render.com](https://render.com) con tu GitHub.
3. En Render: **New +** → **Blueprint** → selecciona el repo `CFloral` (rama `claude/floreria-management-app-4juuyg` o la que hayas mergeado a main). Render detecta el archivo `render.yaml` de la raíz y prepara el servicio automáticamente.
4. Cuando te pida las variables de entorno, pega en `DATABASE_URL` la cadena de conexión de Neon. `JWT_SECRET` se genera solo.
5. Click en **Apply/Deploy** y espera 2-3 minutos. Render te da una URL pública como `https://cfloral.onrender.com` — ábrela en cualquier navegador o celular.
6. La primera vez que arranca, si la base está vacía crea automáticamente las 3 tiendas y el usuario `admin@cfloral.com` / `admin123` para que puedas entrar de inmediato.

**Importante:**
- El plan gratis de Render "duerme" el servicio tras ~15 min sin uso; la primera visita después de eso tarda unos 30-50 segundos en despertar.
- Cambia la contraseña del admin (o crea un usuario nuevo y elimina el demo) en cuanto empieces a meter datos reales, porque la URL es pública aunque no esté anunciada.
- Cada vez que hagas `git push` a la rama conectada, Render vuelve a desplegar solo.

## Roadmap sugerido

1. **Ahora (MVP):** clientes, inventario por tienda, pedidos con factura interna. ✅
2. **Siguiente:** reportes de ventas por tienda/período, historial de pedidos por cliente, alertas de stock bajo por email/WhatsApp.
3. **Proveedores:** catálogo de proveedores, órdenes de compra, recepción de mercancía (actualiza inventario).
4. **Contabilidad:** cuentas por cobrar/pagar, gastos, cierre de caja diario por tienda, integración con facturación electrónica fiscal si el país lo requiere.
5. **Multiusuario avanzado:** permisos más finos, auditoría de cambios, app nativa si se necesita cámara/notificaciones push.

El modelo de datos ya está preparado para estas ampliaciones (todo queda separado por tienda desde el día uno), así que cada fase se agrega sin tener que rehacer lo existente.
