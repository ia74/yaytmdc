const dotenv = require('dotenv');
dotenv.config();

const youtubeMusicApi = require('@googleapis/youtube');
const {authenticate} = require('@google-cloud/local-auth');
const sound = require("sound-play");

const {Client} = require('@xhayper/discord-rpc');

const client = new Client({
    clientId: '1248310880899305483'
})

let icReady = false;

client.on("ready", () => {
    icReady = true;
});

client.login();


const {google} = require('googleapis')
const fs = require('fs');
const path = require('path');

const scopes = [
	'https://www.googleapis.com/auth/youtube.readonly',
	'https://www.googleapis.com/auth/youtube.force-ssl'
];

const userPlaylists = [];
let oauth2Client = new google.auth.OAuth2();

const authenticateUser = async () => {
	const keys = require(path.resolve('src/secrets/oauth2.keys.json'));
    oauth2Client = new google.auth.OAuth2(
        keys.installed.client_id,
        keys.installed.client_secret,
        keys.installed.redirect_uris[0]
    );

    oauth2Client.on('tokens', (tokens) => {
        if (tokens.refresh_token) {
            fs.writeFileSync(path.resolve('src/secrets/user.json'), JSON.stringify(tokens));
        }
        oauth2Client.setCredentials(tokens);
    });

    let tokens;
    try {
        tokens = require(path.resolve('src/secrets/user.json'));
    } catch (error) {
        console.error('Error reading user.json:', error);
        tokens = await getNewTokens(oauth2Client);
    }

    if (!tokens) {
        console.error('No tokens available');
        return;
    }

    oauth2Client.setCredentials(tokens);
}
const fetchUserPlaylists = async () => {
    const youtube = youtubeMusicApi.youtube({
        version: 'v3',
        auth: oauth2Client
    });

    return new Promise((resolve, reject) => {
        youtube.playlists.list({
            part: 'snippet',
            mine: true,
        }, (err, res) => {
            if (err) {
                console.error('Error fetching playlists:', err);
                reject(err);
                return;
            }
            if (res) {
                if (res.data && res.data.items) {
                    res.data.items.forEach(playlist => {
                        userPlaylists.push(playlist);
                    });
                    resolve(userPlaylists);
                } else {
                    console.error('Unexpected response:', res);
                    reject(new Error('Unexpected response'));
                }
            } else {
                console.error('No response received');
                reject(new Error('No response received'));
            }
        });
    });
}
const fetchPlaylistItems = async (playlistId, pageToken = '') => {
	const youtube = youtubeMusicApi.youtube({
		version: 'v3',
		auth: oauth2Client
	});

	return new Promise((resolve, reject) => {
		youtube.playlistItems.list({
			part: 'snippet',
			playlistId: playlistId,
			maxResults: 50,
			pageToken: pageToken
		}, async (err, res) => {
			if (err) {
				console.error(err);
				reject(err);
				return;
			}
			let items = res.data.items;

            if (res.data.nextPageToken) {
                const nextPageItems = await fetchPlaylistItems(playlistId, res.data.nextPageToken);
                items = items.concat(nextPageItems);
            }
			resolve(items);
		});
	});
}

const fetchAudioStream = async (videoId) => {
    const youtube = youtubeMusicApi.youtube({
        version: 'v3',
        auth: oauth2Client
    });

    return new Promise((resolve, reject) => {
        youtube.videos.list({
            part: 'contentDetails',
            id: videoId
        }, (err, res) => {
            if (err) {
                console.error(err);
                reject(err);
                return;
            }
            const video = res.data.items[0];
            const duration = video.contentDetails.duration;
            const stream = `https://www.youtube.com/watch?v=${videoId}`;
            resolve({duration, stream});
        });
    });
}

const ws = require('ws');
const server = new ws.Server({ port: 8080 });

const commandMap = new Map();

const reloadCommandMap = () => {
	const commandFiles = fs.readdirSync(path.resolve('src/commands')).filter(file => file.endsWith('.js'));
	commandFiles.forEach(file => {
		const command = require(path.resolve('src/commands', file));
		commandMap.set(file.split('.')[0], command);
	});
}

const youtubedl = require('youtube-dl-exec')

reloadCommandMap();
server.on('connection', (socket) => {
	socket.sendData = (data, ...args) => {
		socket.send(JSON.stringify({data, args}));
	}
	socket.on('message', (message) => {
		const {data, args} = JSON.parse(message);
		if(commandMap.has(data)) {
			commandMap.get(data)({client: socket, raw: message, data, args, globals, io: server});
		}
        if(data == 'refresh_playlists')
            fetchUserPlaylists();
        if(data == 'exists')
            socket.sendData('exists', fs.existsSync(args[0]), args[0].split('src/app/music/')[1].split('.webm')[0]);
        if(data == 'play_song') {
            if(fs.existsSync(args[1])) {
                socket.sendData('play_song', args[1].split('src/app/')[1]);
                return;
            }
            fetchAudioStream(args[0]).then(({stream}) => {
                youtubedl(stream, {
                    preferFreeFormats: true,
                    extractAudio:true, 
                    audioFormat: 'mp3',
                    x: true,
                    output: "src/app/music/%(title)s.%(ext)s",
                    addHeader: ['referer:youtube.com', 'user-agent:googlebot']
                }).then((s) => {
                socket.sendData('play_song', args[1].split('src/app/')[1]);
                }).catch(console.error)
            });
        }
        if(data == 'set_activity') {
            const isPaused = args[4];
            const offset = args[3] * 1000;
            if(isPaused) {
                client.user?.setActivity({
                    state: args[0],
                    details: args[1],
                    largeImageKey: 'ytm',
                    largeImageText: 'Yet Another YouTube Music Desktop Client',
                    smallImageKey: 'pause',
                    smallImageText: 'Paused',
                    buttons: [
                        { label: 'YAYTMDC on GitHub', url: 'https://github.com/ia74/yaytmdc' }
                    ]
                });
            } else {
                client.user?.setActivity({
                    state: args[0],
                    details: args[1],
                    startTimestamp: Date.now(),
                    endTimestamp: (args[2] == -3 ? null : Date.now() + (args[2] * 1000)) - offset,
                    largeImageKey: 'ytm',
                    largeImageText: 'Yet Another YouTube Music Desktop Client',
                    smallImageKey: 'play',
                    smallImageText: 'Playing',
                    buttons: [
                        { label: 'YAYTMDC on GitHub', url: 'https://github.com/ia74/yaytmdc' }
                    ]
                });
            }
        }
	});
});

const { app, BrowserWindow } = require('electron');

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

const globals = {
	userPlaylists,
	fetchPlaylistItems
}

app.whenReady().then(createWindow);

const main = async () => {
    try {
        await authenticateUser();
        await fetchUserPlaylists();
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

main();