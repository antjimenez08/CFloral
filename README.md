# compañíafloral

Aplicación web (instalable como PWA) para administrar una floristería con varias tiendas, con el
mismo alcance que el mockup de validación: catálogo, pedidos con encuesta de satisfacción y
tarjeta de regalo, despachos con tablero arrastrable y mapa de zonas, inventario con insumos y
recetas de costo, proveedores, finanzas completas (dashboard, reportes, presupuestos,
recomendaciones, facturas y pagos) y administración (empleados, sedes, horarios, listas
desplegables, datos de la empresa y una matriz de roles y permisos editable).

## Estructura

```
server/   API REST (Node + Express + TypeScript + Prisma + MySQL)
client/   Web/PWA (React + Vite + TypeScript + Tailwind)
```

## Roles

Igual que en el mockup, hay 4 roles. El Administrador siempre ve y puede todo; los otros tres se
rigen por una matriz de permisos editable desde Administración → Roles y permisos (16 llaves,
una por módulo/submódulo):

- **Administrador**: acceso total, incluida la Administración de empleados/sedes/roles.
- **Gerente**: todo lo operativo y financiero de su tienda, sin administración de usuarios.
- **Administrativo**: pedidos/despachos/finanzas/clientes/inventario, sin proveedores ni costos ocultos por defecto (ajustable).
- **Vendedor/a**: pedidos, despachos, clientes e inventario (sin ver costos ni finanzas) por defecto.

## Módulos

- **Catálogo**: vitrina de productos de la tienda actual, con foto, precio y botón "Pedir" que arma un pedido nuevo.
- **Pedidos**: cliente + persona destinataria (el modelo de "personas" permite varios destinatarios frecuentes por cliente, cada uno con sus propias direcciones), mensajes de tarjeta sugeridos por ocasión, encuesta de satisfacción (1 de cada 5 pedidos entregados, 3 preguntas + comentario), impresión del certificado de pago (`CP-000001`) y compartir por WhatsApp/email.
- **Clientes**: perfil, personas (direcciones con zona, fechas especiales), histórico de pedidos y un panel de "¿A quién debo contactar?".
- **Despachos**: tablero arrastrable por estado (Pendiente → En elaboración → Por despachar → En camino → Entregado) con filtros por fecha/mes/zona, asignación de domiciliario o tercero, impresión de tarjeta de regalo y orden de despacho, notificación automática por WhatsApp al cambiar de estado, y una pestaña Seguimiento con mapa ilustrativo por zonas.
- **Inventario**: Productos (con receta de insumos, mano de obra sugerida y disponibilidad multi-tienda), Insumos (costo promedio ponderado al recibir factura de proveedor) y Proveedores.
- **Finanzas**: Dashboard (KPIs, tendencia de ventas, ventas/gastos por categoría), Reportes (comparativo mes a mes, clientes nuevos/recurrentes/inactivos, rotación de productos, proyección de ventas), Presupuestos (por tienda/mes, presupuesto vs. real), Recomendaciones (qué comprar, estrategias de venta, acciones financieras, gestión operativa, resumen de presupuesto), Facturas (registro de costos/gastos/inversiones/otros) y Pagos (liquidación a proveedores/nómina/crédito/otros).
- **Administración**: Empleados (incluye domiciliarios sin acceso al sistema), Sedes (logo y color propios por tienda), Horarios (jornadas con nombre), Listas desplegables (formas de pago, categorías, cargos, EPS/ARL/fondo de pensión, canales de adquisición, ocasiones y sus mensajes de tarjeta...), Datos de la empresa y Roles y permisos.

## Modelo de datos

El esquema (`server/prisma/schema.prisma`) tiene un modelo por cada entidad del mockup: `Store`
(con logo/color propios), `User` (empleado, con los campos colombianos típicos: documento, EPS,
ARL, fondo de pensión, jornada), `RolePermission` (la matriz de permisos), `Jornada`,
`ListOption` y `CardMessageTemplate` (listas administrables), `CompanySettings` (datos de la
empresa + contador global de pedidos), `Customer` + `Persona` + `CustomerAddress` +
`CustomerSpecialDate` (CRM con varios destinatarios por cliente), `Supplier`, `Supply` (insumo,
por tienda) + `ProductSupply` (receta) + `SupplierInvoice`, `Product` (por tienda, con
`groupId` para reconocer "el mismo producto" en varias tiendas), `Order` + `OrderItem` (con
snapshot de nombre/precio, destinatario, zona, estado de encuesta), `Expense` (Gasto/Costo/
Inversión/Otro), `Payment` y `BudgetEntry`.

Todas las tiendas comparten el mismo pool de datos (clientes, proveedores, listas, roles) y cada
tienda tiene su propio inventario, pedidos y finanzas — igual que en el mockup. El código está
preparado para, más adelante, agregarle un `companyId` y aislar por empresa si se quiere vender
a otras floristerías (ver Roadmap).

## Requisitos

- Node.js 18+
- MySQL 8+ (o MariaDB 10.6+)

## Poner en marcha el backend

```bash
cd server
cp .env.example .env   # ajusta DATABASE_URL y JWT_SECRET
npm install
npx prisma migrate dev --name init
npm run seed            # crea tiendas, empleados y datos de ejemplo
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
- `admin@cfloral.com` / `admin123` — Administrador, ve las 3 tiendas.
- `centro@cfloral.com` / `empleada123` — Gerente, Floral Centro.
- `administrativo@cfloral.com` / `empleada123` — Administrativo, Floral Centro.
- `vendedor@cfloral.com` / `empleada123` — Vendedor/a, Floral Centro.
- `norte@cfloral.com` / `empleada123` — Vendedor/a, Floral Norte.

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

**Importante si ya tenían una versión anterior instalada:** esta versión reescribió a fondo el
modelo de datos (roles, clientes, pedidos, etc.) para igualar el mockup. Si ya habían corrido
`npm run seed` o cargado datos reales con la versión anterior, hagan un respaldo con `mysqldump`
antes de continuar y luego recreen la base (pasos 2 y 4) en lugar de reusar la anterior — no es
compatible con los datos de la versión previa.

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

Debe aparecer `CFloral escuchando en http://localhost:4000`. Abre esa URL en el navegador del mismo servidor para confirmar que carga. Al primer arranque, si la base está vacía, se crean solas las tiendas y los usuarios de ejemplo (ver la lista de arriba). Cierra con Ctrl+C cuando confirmes que funciona.

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
- Cambien la contraseña de todos los usuarios de ejemplo en cuanto entren por primera vez (o creen usuarios nuevos desde Administración y desactiven los de ejemplo).
- Hagan respaldos periódicos de la base con `mysqldump` (o el respaldo automático que ya tengan configurado en ese MySQL), ya que ahí vive toda la información del negocio.
- Si más adelante actualizan el código (`git pull` + repetir el paso 4 de compilar), solo necesitan `nssm restart CFloral` para que tome los cambios. Si la actualización trae una migración de base de datos nueva, correr `npx prisma migrate deploy` antes de reiniciar el servicio.

*(El repo también incluye un `render.yaml` por si en algún momento prefieren además tenerlo accesible desde internet vía la nube — no es necesario para esta instalación local.)*

## Decisiones de diseño frente al mockup

Para que quede claro qué es idéntico y qué se hizo distinto a propósito al pasar del mockup (HTML
+ localStorage) a la aplicación real:

- **Impresión**: el mockup abría los documentos imprimibles con un truco de Blob + URL de objeto
  porque corría dentro de un entorno de vista previa en sandbox que bloqueaba `window.print()`
  directo. La app real no tiene esa restricción, así que imprime con el diálogo nativo del
  navegador directamente — mismo resultado para quien usa la app, código más simple.
- **Notificación de WhatsApp**: como en el mockup, es un enlace `wa.me` que se abre para que el
  empleado envíe el mensaje con un clic — no hay un envío automático real de WhatsApp (eso
  requiere contratar la API de WhatsApp Business, ver Roadmap).
- **Fotos de productos/logos**: se guardan igual que en el mockup, como imágenes en base64 dentro
  de la base de datos (sin un servicio de archivos aparte). Funciona bien para el volumen de un
  negocio de este tamaño; si el catálogo de fotos crece mucho, conviene migrar a almacenamiento de
  archivos (ver Roadmap).
- **Contraseñas**: a diferencia del mockup (que las guardaba en texto plano a propósito, al ser
  una maqueta), la app real siempre las guarda con hash (bcrypt) — esto nunca fue opcional.

## Roadmap sugerido

1. **Ahora:** paridad completa con el mockup validado — catálogo, pedidos con encuesta y tarjeta
   de regalo, despachos con tablero arrastrable y seguimiento por zonas, inventario con insumos/
   recetas/proveedores, finanzas completas (dashboard/reportes/presupuestos/recomendaciones/
   facturas/pagos) y administración (empleados/sedes/horarios/listas/empresa/roles). ✅
2. **Notificaciones automáticas de verdad:** integrar la API de WhatsApp Business (hoy es un
   enlace manual) y alertas por email de stock bajo / fechas especiales próximas.
3. **Proveedores — compras:** órdenes de compra formales (hoy solo se registra la factura ya
   recibida).
4. **Archivos en lugar de base64:** si el catálogo de fotos crece, mover fotos/logos a un
   almacenamiento de archivos (disco o S3-compatible) en vez de guardarlas en la base de datos.
5. **Multiusuario avanzado:** auditoría de cambios, app nativa si se necesita cámara/notificaciones push.
6. **Camino a comercializable:** agregar `companyId` (multi-tenant) para poder vender la misma
   aplicación a otras floristerías sin tocar el modelo de datos existente.

El modelo de datos ya está preparado para estas ampliaciones (todo queda separado por tienda
desde el día uno), así que cada fase se agrega sin tener que rehacer lo existente.
