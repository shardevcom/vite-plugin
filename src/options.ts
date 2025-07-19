import type { ShardevPluginOptions } from './types'

export function resolveOptions(options: ShardevPluginOptions): Required<ShardevPluginOptions> {
    return {
        base: options.base || '/',
        moduleName: options.moduleName || 'shardev',
        modulesDir: options.modulesDir || 'resources/react',
        startPort: options.startPort || 5173
    }
}