export interface ShardevPluginOptions {
    moduleName?: string;
    base?: string;
    modulesDir?: string; // Ruta base configurable, por defecto: 'resources/react'
    startPort?: number;
}