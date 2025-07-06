import { type ToJSX, toJSX } from '../../src/utils.ts';


export class DiscoveryTestCmp extends HTMLElement {

	static tagName = 'discovery-test-cmp';

	constructor() {
		super();
	}

	connectedCallback(): void {
		this.innerHTML = '<ho-badge variant="default">Badge</ho-badge>';
	}

}

export const DiscoveryTest: ToJSX<DiscoveryTestCmp> = toJSX(DiscoveryTestCmp);


export function RegularFunction(): string {
	return '<div>Regular Function</div>';
}

export const ConstComponent = (): string => '<div>Const Component</div>';
