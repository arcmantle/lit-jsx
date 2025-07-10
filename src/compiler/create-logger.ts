import pino, { type Logger } from 'pino';
import { prettyFactory } from 'pino-pretty';


export const createLogger = (name: string, debug?: boolean): Logger<never, boolean> => {
	const prettify = prettyFactory({
		sync:          true,
		colorize:      true,
		ignore:        'pid,hostname',
		translateTime: 'HH:MM:ss',
	});
	const hooks: pino.LoggerOptions['hooks'] | undefined = {
		streamWrite: (s) => {
			console.log(prettify(s));

			return '';
		},
	};

	return pino({
		name,
		level: debug ? 'trace' : 'info',
		hooks,
		//...(debug && {
		//	transport: {
		//		target:  'pino-pretty',
		//		options: {
		//			colorize:      true,
		//			translateTime: 'HH:MM:ss',
		//			ignore:        'pid,hostname',
		//		},
		//	},
		//}),
	});
};
