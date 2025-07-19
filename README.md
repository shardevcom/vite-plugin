# 📦 @shardev/vite-plugin

> 🔌 Plugin para Vite que permite compilar múltiples módulos React independientes dentro de un proyecto Laravel monolítico.

---

## 📦 Características principales

- Compilación modular: permite compilar todos los módulos o solo uno específico (`--module=mod1`).
- Integración con Laravel + React.
- Soporte para múltiples entradas Vite.
- Compatible con entornos `dev` y `build`.
- Permite estructura modular en `resources/react/mod1`.
- Extensible mediante opciones.

---

## 🚀 Instalación

```bash 
  npm install @shardev/vite-plugin
```

## 🛠️ Ejemplo de uso general

### 1. En tu `vite.config.ts`

```ts
import { defineConfig } from 'vite'
import shardev from 'vite-plugin-shardev'

export default defineConfig(() => {
    return {
        plugins: [
            shardev({
                base: '/',
                moduleName: process.env.MODULE_NAME, // o usa --module=mod1
                modulesDir: 'resources/react'
            }),
        ],
    }
})
```

---

## ⚙️ Opciones

| Opción       | Tipo     | Descripción                                                         | Valor por defecto        |
|--------------|----------|---------------------------------------------------------------------|--------------------------|
| `base`       | `string` | Ruta base para servir los assets.                                   | `'/'`                    |
| `moduleName` | `string` | Nombre del módulo a compilar (se puede usar con `--module=mod1`).   | `'shardev'`              |
| `modulesDir` | `string` | Carpeta raíz donde están los módulos React.                         | `'resources/react'`      |

---

## 🧪 Modo desarrollo

Puedes iniciar Vite en modo desarrollo apuntando a un solo módulo:

```bash
npm run dev -- --module=mod1
```

Esto compilará `resources/react/mod1`.

---

## 🏗️ Compilación de todos los módulos

```bash
npm run build
```

Por defecto compilará **todos** los módulos dentro de `resources/react`.

---

## 📁 Estructura esperada

```text
resources/
└── react/
    ├── mod1/
    │   └── index.tsx
    ├── mod2/
    │   └── index.tsx
    └── ...
```

---
## 🤝 Contribuciones

¡Contribuciones son bienvenidas! Puedes enviar:

- Reportes de errores
- Funcionalidades nuevas
- Refactor o mejoras visuales

---

## 📄 Licencia

Este proyecto está licenciado bajo la [MIT License](LICENSE).

---

## ✉️ Contacto

Desarrollado por [shardev.com](https://shardev.com)  
📫 contacto@shardev.com