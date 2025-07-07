import { type ToComponent, toComponent } from '../../src/utils.ts';


class MyActualComponent extends HTMLElement {

	static tagName = 'my-actual-component';

	constructor() {
		super();
	}

	connectedCallback(): void {
		this.innerHTML = '<p>My Actual Component</p>';
	}

}

export const ActualElement: ToComponent<MyActualComponent> = toComponent(MyActualComponent);
