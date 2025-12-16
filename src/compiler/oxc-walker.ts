import { type Node, type Program } from 'oxc-parser';
import { ScopeTracker, walk } from 'oxc-walker';


type WalkerContext = ThisParameterType<NonNullable<Parameters<typeof walk>[1]['enter']>>;
type WalkerCallbackContext = Parameters<NonNullable<Parameters<typeof walk>[1]['enter']>>[2];
type NodeWalker<T extends Node['type']> = (
	node: Extract<Node, { type: T; }>,
	parent: Node | null,
	ctx: WalkerContext,
	scope: ScopeTracker,
	cbCtx: WalkerCallbackContext
) => void;


export const oxcWalker = (input: Program | Node, options: Partial<{
	callExpression: NodeWalker<'CallExpression'>;
}>): void => {
	const scopeTracker = new ScopeTracker();

	walk(input, {
		enter(node, parent, cbCtx) {
			this;

			switch (node.type) {
			case 'CallExpression':
				options.callExpression?.(node, parent, this, scopeTracker, cbCtx);
				break;
			}
		},
		scopeTracker,
	});
};
