import type { Plugin, ResolvedConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import chalk from 'chalk'
import { execa } from 'execa'
import { createLogger } from './logger'
import type { ShardevPluginOptions } from './types'
import {resolveOptions} from "./options";

export function shardev(userOptions: ShardevPluginOptions = {}): Plugin {
    const {
        moduleName,
        modulesDir,
        base
    } = resolveOptions(userOptions)

    const logger = createLogger(moduleName)
    let config: ResolvedConfig
    let isDev = false

    return {
        name: 'vite-plugin-shardev',
        enforce: 'pre',

        configResolved(resolved) {
            config = resolved
        },

        config(userConfig, env) {
            isDev = env.command === 'serve'
            return {
                base: base || userConfig.base
            }
        },


        async buildStart() {
            const mode = isDev ? 'dev' : 'build'
            logger.info(`🧩 Ejecutando en modo: ${mode}`)

            const selectedModules = getModules(modulesDir)

            if (selectedModules.length === 0) {
                logger.warn('⚠️ No se encontraron módulos con vite.config.ts')
                return
            }

            for (let i = 0; i < selectedModules.length; i++) {
                const mod = selectedModules[i]
                const port = 5173 + i

                if (path.resolve(modulesDir, mod) === config.root) {
                    logger.info(`🛑 Saltando módulo actual (${mod}) para evitar recursividad.`)
                    continue
                }

                await runModule({
                    mod,
                    mode,
                    modulesDir,
                    port
                })
            }
        }
    }
}

interface RunModuleOptions {
    mod: string
    mode: 'dev' | 'build'
    modulesDir: string
    port: number
}

function getViteConfig(modulePath: string): string | undefined {
    return [
        'vite.config.ts',
        'vite.config.js',
        'vite.config.mjs',
        'vite.config.cjs'
    ].map(file => path.join(modulePath, file)).find(fs.existsSync)
}

async function runModule({ mod, mode, modulesDir, port }: RunModuleOptions) {
    const modulePath = path.resolve(modulesDir, mod)

    const configPath = getViteConfig(modulePath)

    if (!configPath) {
        console.error(chalk.red(`❌ No se encontró archivo de configuración Vite en ${modulePath}`))
        process.exit(1)
    }

    const cmd = mode === 'dev' ? 'vite' : 'vite'

    const args = [mode, '--config', configPath]

    if (mode === 'dev') {
        args.push('--port', port.toString())
    }

    console.log(chalk.cyanBright(`\n🚀 ${mod} → modo ${mode} en puerto ${port}`))

    execa(cmd, args, {
        stdio: 'inherit',
        env: {
            VITE_MODULE_NAME: mod,
            VITE_PORT: port.toString()
        }
    })
}

function getModules(modulesDir: string): string[] {
    const arg = process.argv.find(a => a.startsWith('--module='))
    if (arg) return [arg.split('=')[1]]
    return getAllModules(modulesDir)
}

function getAllModules(modulesDir: string): string[] {
    const fullPath = path.resolve(modulesDir)
    if (!fs.existsSync(fullPath)) return []

    return fs.readdirSync(fullPath).filter((dir: string) => {
        const modulePath = path.join(fullPath, dir)
        return getViteConfig(modulePath) !== undefined
    })
}
