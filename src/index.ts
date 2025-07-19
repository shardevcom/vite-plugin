import type { Plugin, ResolvedConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import chalk from 'chalk'
import { execa } from 'execa' // Importar ChildProcess para tipado
import type { ChildProcess } from 'node:child_process'
import { createLogger } from './logger' // Asumiendo que logger.ts existe
import type { ShardevPluginOptions } from './types' // Asumiendo que types.ts existe
import { resolveOptions } from "./options"; // Asumiendo que options.ts existe

export function shardev(userOptions: ShardevPluginOptions = {}): Plugin {
    const {
        moduleName,
        modulesDir,
        base,
        startPort = 5173 // Puerto inicial configurable, valor por defecto 5173
    } = resolveOptions(userOptions)

    const logger = createLogger(moduleName)
    let config: ResolvedConfig
    let isDev = false
    const childProcesses: ChildProcess[] = [] // Para mantener un registro de los procesos hijos en modo dev

    return {
        name: 'vite-plugin-shardev',
        enforce: 'pre', // Asegura que se ejecute antes que otros plugins, como laravel()

        configResolved(resolved) {
            config = resolved
        },

        config(userConfig, env) {
            isDev = env.command === 'serve'
            return {
                base: base || userConfig.base // Permite sobrescribir o usar el base del usuario
            }
        },

        async buildStart() {
            const mode = isDev ? 'dev' : 'build'
            logger.info(`🧩 Ejecutando ${chalk.bold(moduleName)} en modo: ${chalk.blueBright(mode)}`)

            const selectedModules = getModules({modulesDir, logger})

            if (selectedModules.length === 0) {
                logger.warn('⚠️ No se encontraron módulos con vite.config.ts')
                return
            }

            // Limpiar procesos hijos al salir en modo dev
            if (isDev) {
                process.on('exit', () => {
                    logger.info('🔌 Terminando procesos de módulos hijos...');
                    childProcesses.forEach(cp => {
                        if (cp.connected) {
                            cp.kill('SIGTERM'); // Envía una señal de terminación suave
                        }
                    });
                });
                // También manejar Ctrl+C
                process.on('SIGINT', () => {
                    logger.info('🔌 Terminando procesos de módulos hijos por SIGINT...');
                    childProcesses.forEach(cp => {
                        if (cp.connected) {
                            cp.kill('SIGINT');
                        }
                    });
                    process.exit(); // Asegura que el proceso principal también termine
                });
            }

            const modulePromises: Promise<void>[] = []

            for (let i = 0; i < selectedModules.length; i++) {
                const mod = selectedModules[i]
                const port = startPort + i // Usar el puerto inicial configurable

                if (path.resolve(modulesDir, mod) === config.root) {
                    logger.info(`🛑 Saltando módulo actual (${chalk.yellow(mod)}) para evitar recursividad.`)
                    continue
                }

                // En modo build, esperamos que todos los módulos terminen
                // En modo dev, los iniciamos en paralelo y capturamos errores
                if (mode === 'build') {
                    modulePromises.push(runModule({ mod, mode, modulesDir, port, logger, childProcesses }));
                } else {
                    runModule({ mod, mode, modulesDir, port, logger, childProcesses }).catch(error => {
                        logger.error(chalk.red(`❌ Error al iniciar el módulo ${mod}: ${error.message}`));
                    });
                }
            }

            if (mode === 'build') {
                try {
                    await Promise.all(modulePromises);
                    logger.info('✅ Todos los módulos han sido construidos exitosamente.');
                } catch (error: any) {
                    logger.error(chalk.red(`🚨 Fallo en la construcción de uno o más módulos: ${error.message}`));
                    // Puedes decidir si quieres que el build principal falle si un módulo falla
                    throw new Error(`Fallo en la construcción de módulos: ${error.message}`);
                }
            }
        },
        // Hook `closeBundle` se ejecuta después de que el bundle principal ha sido escrito en disco.
        // Es un buen lugar para asegurar que los procesos hijos se hayan terminado en modo build.
        async closeBundle() {
            if (!isDev) { // Solo en modo build
                logger.info('Limpiando procesos de módulos hijos después del build.');
                childProcesses.forEach(cp => {
                    if (cp.connected) {
                        cp.kill('SIGTERM');
                    }
                });
            }
        }
    }
}

interface RunModuleOptions {
    mod: string
    mode: 'dev' | 'build'
    modulesDir: string
    port: number
    logger: ReturnType<typeof createLogger>
    childProcesses: ChildProcess[] // Pasar el array para registrar procesos
}

function getViteConfig(modulePath: string): string | undefined {
    return [
        'vite.config.ts',
        'vite.config.js',
        'vite.config.mjs',
        'vite.config.cjs'
    ].map(file => path.join(modulePath, file)).find(fs.existsSync)
}

async function runModule({ mod, mode, modulesDir, port, logger, childProcesses }: RunModuleOptions) {
    const modulePath = path.resolve(modulesDir, mod)

    const configPath = getViteConfig(modulePath)

    if (!configPath) {
        // Lanza un error en lugar de salir del proceso principal
        throw new Error(`No se encontró archivo de configuración Vite en ${modulePath}`);
    }

    const cmd = 'vite' // El comando siempre es 'vite'
    const args = [mode, '--config', configPath]

    if (mode === 'dev') {
        args.push('--port', port.toString())
    }

    logger.info(chalk.cyanBright(`\n🚀 ${mod} → modo ${mode} en puerto ${port}`))

    try {
        const child = execa(cmd, args, {
            stdio: 'inherit', // Permite que la salida del proceso hijo se vea en la consola principal
            env: {
                VITE_MODULE_NAME: mod,
                VITE_PORT: port.toString(),
                // Puedes añadir más variables de entorno compartidas aquí si es necesario
            }
        });

        if (mode === 'dev') {
            childProcesses.push(child); // Registrar el proceso hijo para poder terminarlo más tarde
        }

        await child; // Esperar a que el proceso hijo termine (importante para el modo build)
    } catch (error: any) {
        // Captura errores específicos de execa, como que el comando no se encuentre o falle la ejecución
        throw new Error(`Fallo al ejecutar Vite para el módulo ${mod}: ${error.message}`);
    }
}

function getModules({ modulesDir, logger }: Partial<RunModuleOptions>): string[] {
    const arg = process.argv.find(a => a.startsWith('--module='))
    if (arg) {
        const moduleName = arg.split('=')[1];
        logger?.info(`🔍 Módulo específico solicitado: ${chalk.magenta(moduleName)}`);
        return [moduleName];
    }
    return getAllModules({modulesDir, logger})
}

function getAllModules({ modulesDir, logger }: Partial<RunModuleOptions>): string[] {
    const fullPath = path.resolve(modulesDir ?? '')
    if (!fs.existsSync(fullPath)) {
        logger?.warn(`⚠️ El directorio de módulos no existe: ${fullPath}`);
        return []
    }

    return fs.readdirSync(fullPath).filter((dir: string) => {
        const modulePath = path.join(fullPath, dir)
        const hasViteConfig = getViteConfig(modulePath) !== undefined
        if (!hasViteConfig) {
            logger?.warn(`Skipping ${dir}: No Vite config found.`);
        }
        return hasViteConfig
    })
}