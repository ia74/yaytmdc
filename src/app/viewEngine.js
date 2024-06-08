const globContext = document.getElementById('engine-handler');

const createSeperateContext = (viewId) => {
	const context = document.createElement('div');
	context.id = viewId;
	globContext.appendChild(context);
	return context;
}

const getContextFor = (viewId) => {
	return document.getElementById(viewId);
}

const _views = ['home'];

const load = (view) => {
	if (!_views.includes(view)) _views.push(view);
	fetch(`./view-${view}.html`)
		.then(response => {
			return response.text();
		})
		.then(data => {
			_views.forEach((viewa) => {
				const context = getContextFor(viewa);
				if (viewa !== view) {
					context.style.display = 'none';
				} else {
					if (context) context.style.display = 'block';
				}
			});
			let context = getContextFor(view);
			if (!context) {
				context = createSeperateContext(view);
				context.innerHTML = data;
			}

			if (document.getElementById(view + '-script-0')) return;
			const scripts = context.getElementsByTagName('script');
			for (let i = 0; i < scripts.length; i++) {
				const script = document.createElement('script');
				script.type = 'module'
				script.id = view + '-script-' + i;
				script.classList.add('ve-script');
				script.text = scripts[i].text;
				document.body.appendChild(script);
			}
		})
		.catch(error => {
			console.error(error);
		});
}

const deload = () => {

}

document.querySelectorAll('ViewRef').forEach((element) => {
	element.onclick = (e) => {
		e.preventDefault();
		deload();
		load(element.getAttribute('view'));
	}
})

export {
	globContext,
	getContextFor,
	createSeperateContext,
	load
}