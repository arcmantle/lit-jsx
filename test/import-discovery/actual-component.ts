export class ActualElement extends HTMLElement {

	static tagName = 'my-actual-component';

	constructor() {
		super();
	}

	connectedCallback(): void {
		this.innerHTML = '<p>My Actual Component</p>';
	}

}
