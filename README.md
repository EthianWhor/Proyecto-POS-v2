# POS Papel y Luna · MVP 2

Proyecto frontend en HTML, CSS y JavaScript vanilla integrado con Google Sheets + Apps Script.

## Qué incluye

- Carga de productos, clientes, proveedores, categorías, ventas y compras desde API.
- Nueva venta con productos dinámicos.
- Guardado de ventas abiertas y retoma posterior.
- Cierre de ventas y vista de factura.
- Actualización de inventario al cerrar ventas.
- Edición de productos desde el flujo de venta y desde el módulo de productos.
- Registro de compras y actualización de stock.
- CRUD básico de clientes, proveedores y categorías.

## Backend usado

La app apunta a este Apps Script Web App:

`https://script.google.com/macros/s/AKfycbxtBvNJ-zjAAro3MRHrtpr90rKZ1I9OitxoqgF9wZqkMj8M8xtZbq2rLSAbh9HAwnY/exec`

## Notas de funcionamiento

- La app usa `GET` para consultar hojas y `POST` para guardar registros.
- Para edición y eliminación en entidades básicas se usa un enfoque append-only:
  - editar = se agrega una nueva fila con el mismo `id`
  - eliminar = se agrega una nueva fila con `nombre = __deleted__`
- La UI resuelve siempre el último registro por `id`.

## Archivos principales

- `index.html`
- `styles.css`
- `app.js`

