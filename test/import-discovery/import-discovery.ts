export class DiscoveryTest extends HTMLElement {

	static tagName = 'discovery-test-cmp';

	constructor() {
		super();
	}

	connectedCallback(): void {
		this.innerHTML = '<ho-badge variant="default">Badge</ho-badge>';
	}

}


export function RegularFunction(): string {
	return '<div>Regular Function</div>';
}

export const ConstComponent = (): string => '<div>Const Component</div>';
