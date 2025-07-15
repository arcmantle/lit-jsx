export class PerformanceMonitor {

	constructor() {}

	protected performanceEntries: any[] = [];
	protected perfObserver:       PerformanceObserver | null = null;

	startPerf(name: string): void {
		if (!this.perfObserver)
			this.setupPerfObserver();

		performance.mark(name + '-start');
	}

	endPerf(name: string): void {
		performance.mark(name + '-end');
		performance.measure(name, name + '-start', name + '-end');
	}

	setupPerfObserver(): void {
		if (this.perfObserver)
			return;

		this.perfObserver = new PerformanceObserver((list) => {
			this.performanceEntries.push(...list.getEntries());

			const content = JSON.stringify(this.performanceEntries, null, '\t');

			console.log(content);
		});

		this.perfObserver.observe({ entryTypes: [ 'measure' ] });
	}

}
