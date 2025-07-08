import pino, { type Logger } from 'pino';


export const createLogger = (name: string, debug?: boolean): Logger<never, boolean> => {
	return pino({
		name,
		level: debug ? 'trace' : 'warn',
		...(debug && {
			transport: {
				target:  'pino-pretty',
				options: {
					colorize:      true,
					translateTime: 'HH:MM:ss',
					ignore:        'pid,hostname',
				},
			},
		}),
	});
};
