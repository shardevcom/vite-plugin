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

    return {
        name: 'vite-plugin-shardev',
        enforce: 'pre',

        configResolved(resolved) {
            config = resolved
        },

        config(userConfig, { command }) {
            return {
                base: base || userConfig.base
            }
        },

        async buildStart() {
            const command = process.argv.includes('dev') ? 'dev' : 'build'
            logger.info(`🧩 Ejecutando en modo: ${command}`)

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
                    mode: command,
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

async function runModule({ mod, mode, modulesDir, port }: RunModuleOptions) {
    const modulePath = path.resolve(modulesDir, mod)
    const cmd = mode === 'dev' ? 'vite' : 'vite'
    const args = [mode, '--config', `${modulePath}/vite.config.ts`]

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

    return fs.readdirSync(fullPath).filter((dir: string) =>
        fs.existsSync(path.join(fullPath, dir, 'vite.config.ts'))
    )
}
