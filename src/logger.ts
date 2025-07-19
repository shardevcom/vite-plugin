import chalk from 'chalk';

export function createLogger(context: string) {
    return {
        info(msg: string) {
            console.log(`${chalk.green(`[${context}]`)} ${msg}`);
        },
        warn(msg: string) {
            console.warn(`${chalk.yellow(`[${context}]`)} ${msg}`);
        },
        error(msg: string) {
            console.error(`${chalk.red(`[${context}]`)} ${msg}`);
        }
    };
}