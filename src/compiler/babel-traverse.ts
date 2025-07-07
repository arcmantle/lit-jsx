import _traverse from '@babel/traverse';

export let traverse: typeof _traverse;
if (typeof _traverse === 'function')
	traverse = _traverse;
else
	traverse = (_traverse as any).default;
