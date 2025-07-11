import { type ToComponent, toComponent as f } from '@arcmantle/lit-jsx';


class Badge extends HTMLElement {

	static tagName = 'my-badge';

	accessor variant: 'default' = 'default';

	constructor() {
		super();
	}

	connectedCallback(): void {
		this.innerHTML = '<span>Badge</span>';
	}

}

const v: ToComponent<Badge> = f(Badge);

export {
	v as BadgeCmp,
	Badge as BadgeElement,
};
