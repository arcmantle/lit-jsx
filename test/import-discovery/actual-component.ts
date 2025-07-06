import { type ToJSX, toJSX } from '../../src/utils.ts';


class MyActualComponent extends HTMLElement {

	static tagName = 'my-actual-component';

	constructor() {
		super();
	}

	connectedCallback(): void {
		this.innerHTML = '<p>My Actual Component</p>';
	}

}

export const ActualElement: ToJSX<MyActualComponent> = toJSX(MyActualComponent);
