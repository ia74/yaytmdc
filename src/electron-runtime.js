const { app, BrowserWindow } = require('electron');
const path = require('path')

const createWindow = () => {
	const win = new BrowserWindow({
		width: 800,
		height: 600,
		webPreferences: {
			nodeIntegration: true
		}
	});

	win.loadFile(path.resolve('src/app/index.html'));
}

app.whenReady().then(createWindow)