const _ytm = {
	sock: new WebSocket('ws://localhost:8080'),
	_mq: [],
	_internalSendLoop: () => {
		setInterval(() => {
			if(_ytm._mq.length > 0) {
				_ytm.sock.send(_ytm._mq.shift());
			}
		}, 1);
	},
	send: (data, ...args) => {
		_ytm._mq.push(JSON.stringify({data, args}));
	},
	on: (event, callback) => {
		_ytm.sock.addEventListener(event, callback);
	},
	dataCallbacks: {},
	onData: (data, callback) => {
		_ytm.dataCallbacks[data] = callback;
	},
	onceData: (data, callback) => {
		_ytm.dataCallbacks[data] = (args) => {
			callback(args);
			delete _ytm.dataCallbacks[data];
		};
	},
	globalAudio: null,
	nowPlaying: {},
}


const _userData = {
	playlists: [],
}

_ytm.on('open', () => {
	_ytm.send('set_client', 'com.yaytmdc', 'Yet Another YouTube Music Desktop Client');
	_ytm.send('request_playlists');
	_ytm._internalSendLoop();
});

const viewSongDownloading = (item) => {
	document.getElementById('player-info-title').innerText = 'Downloading ' + item.snippet.title;
	document.getElementById('player-info-artist').innerText = 'Please wait...';
};

const playPause = (ele) => {
	if(_ytm.globalAudio.paused) {
		_ytm.globalAudio.play();
		ele.innerText = 'Pause';
	} else {
		_ytm.globalAudio.pause();
		ele.innerText = 'Play';
	}
	ele.innerText = _ytm.globalAudio.paused ? 'Play' : 'Pause';
	actualSet(_ytm.globalAudio, _ytm.nowPlaying.snippet.title, _ytm.nowPlaying.snippet.videoOwnerChannelTitle, _ytm.globalAudio.duration, null);
};

function actualSet(audioObject, title, artist, duration, ev) {
		console.log('Audioboejct', audioObject)
		_ytm.send('set_activity', title, artist, duration, audioObject.currentTime, audioObject.paused);
		audioObject.removeEventListener('play', ev);
}

const setNowPlaying = (title, artist, audioObject) => {
    document.getElementById('player-info-title').innerText = title;
    document.getElementById('player-info-artist').innerText = artist;
    if(!audioObject.paused) {
        audioObject.addEventListener('loadedmetadata', () => {
            actualSet(audioObject, title, artist, audioObject.duration, null);
        });
        console.log('Already playing')
        return;
    } 
    let ev = audioObject.addEventListener('play', () => {
        audioObject.addEventListener('loadedmetadata', () => {
            actualSet(audioObject, title, artist, audioObject.duration, ev);
        });
    });
}
let lastPlaylist = null;

_ytm.onData('exists', (exists, file) => {
	let temp = exists;
	exists = temp[0];
	file = temp[1];
	if(exists) {
		document.querySelector(`.downloader[data-video="${file}"]`).classList.add('downloaded');
	}
});

const createItemView = (item) => {
	const itemView = document.createElement('div');
	itemView.classList.add('song-item');
	item.snippet.videoOwnerChannelTitle = item.snippet.videoOwnerChannelTitle.split(' - Topic')[0];
	itemView.innerHTML = `
		<img src="${item.snippet.thumbnails.medium.url}" />
		<h3>${item.snippet.title} - ${item.snippet.videoOwnerChannelTitle}</h3>
		<button data-video="${item.snippet.title}" class='downloader'>Download</button>
	`;
	_ytm.send('exists', 'src/app/music/' + item.snippet.title + '.webm');
	itemView.querySelector('.downloader').addEventListener('click', (e) => {
		_ytm.send('play_song', item.snippet.resourceId.videoId, 'src/app/music/' + item.snippet.title + '.webm');
		viewSongDownloading(item);
		_ytm.onceData('play_song', (strea) => {
			alert('Downloaded ' + item.snippet.title + ' to src/app/music/' + item.snippet.title + '.webm')
			e.target.classList.add('downloaded');
			setNowPlaying(_ytm.nowPlaying.snippet.title, _ytm.nowPlaying.snippet.videoOwnerChannelTitle, -3);
		});
	});
	itemView.addEventListener('click', (tar) => {
		if(tar.target.classList.contains('downloader')) return;
		_ytm.send('play_song', item.snippet.resourceId.videoId, 'src/app/music/' + item.snippet.title + '.webm');
		viewSongDownloading(item);
		_ytm.onceData('play_song', (strea) => {
			if(_ytm.globalAudio) {
				_ytm.globalAudio.pause();
				_ytm.globalAudio.remove();
				_ytm.globalAudio = null;
			}
			_ytm.send('grab_lyrics', item.snippet);
			let audio = new Audio(strea);
			if(strea == null)
				audio = new Audio('music/' + item.snippet.title + '.webm');
			_ytm.globalAudio = audio;
			// When the audio starts playing or is paused
			_ytm.globalAudio.onplay = _ytm.globalAudio.onpause = () => {
				localStorage.setItem('audioSrc', _ytm.globalAudio.src);
				localStorage.setItem('audioTime', _ytm.globalAudio.currentTime);
				localStorage.setItem('audioPaused', _ytm.globalAudio.paused);
				localStorage.setItem('plr-details', JSON.stringify({title: item.snippet.title, artist: item.snippet.videoOwnerChannelTitle}));
				setNowPlaying(item.snippet.title, item.snippet.videoOwnerChannelTitle, _ytm.globalAudio);
			};
			_ytm.nowPlaying = item;
			audio.play();
			updateProgress();
		});
	});
	return itemView;
};
document.getElementById('player-progress').onchange = (e) => {
	_ytm.globalAudio.currentTime = e.target.value;
	updateProgress();
	actualSet(_ytm.globalAudio, _ytm.nowPlaying.snippet.title, _ytm.nowPlaying.snippet.videoOwnerChannelTitle, _ytm.globalAudio.duration, null);
};

const updateProgress = () => {
	const progress = document.getElementById('player-progress');
		progress.max = _ytm.globalAudio.duration;
		progress.value = _ytm.globalAudio.currentTime;
		// pad with zeros
		let left = Math.floor(_ytm.globalAudio.duration / 60);
		left = left < 10 ? '0' + left : left;
		let right = Math.floor(_ytm.globalAudio.duration % 60);
		right = right < 10 ? '0' + right : right;
		let leftCurrent = Math.floor(_ytm.globalAudio.currentTime / 60);
		leftCurrent = leftCurrent < 10 ? '0' + leftCurrent : leftCurrent;
		let rightCurrent = Math.floor(_ytm.globalAudio.currentTime % 60);
		rightCurrent = rightCurrent < 10 ? '0' + rightCurrent : rightCurrent;
		document.getElementById('player-time').innerText = `${leftCurrent}:${rightCurrent}/${left}:${right}`;
}

_ytm.onData('grab_lyrics', (lyrics) => {
	lyrics = lyrics[0];
	// array of song objects, we need to find correct one
	console.log(lyrics)
	lyrics = lyrics.filter(song => song.name.toLowerCase() === _ytm.nowPlaying.snippet.title.toLowerCase() && song.artistName === _ytm.nowPlaying.snippet.videoOwnerChannelTitle.split(' - Topic')[0].toLowerCase());
	const lyricLoop = setInterval(() => {
		if(lyrics.syncedLyrics) {
			console.log(lyrics[0].syncedLyrics);
		}
	}, 250);
});



setInterval(() => {
	if(_ytm.globalAudio) updateProgress();
},1000)

const loadPlaylistView = (playlist) => {
	lastPlaylist = playlist;
	document.getElementById('title').innerHTML = '<h1>Fetching songs for ' + playlist.snippet.title + '</h1>';
	_ytm.send('request_playlist_items', playlist.id);
	_ytm.onceData('request_playlist_items', (playlistItems) => {
		document.getElementById('title').innerHTML = '<h1>Playlist: ' + playlist.snippet.title + ' (Loading) </h1>';
		const playlistView = document.getElementById('songs-in-playlist');
		playlistView.innerHTML = '';
		playlistItems = playlistItems[0];
		playlistItems.forEach(item => {
			const itemView = createItemView(item);
			playlistView.appendChild(itemView);
			});
		document.getElementById('title').innerHTML = '<h1>Playlist: ' + playlist.snippet.title + '</h1>';
	});
};

const createPlaylistView = (playlist) => {
	const playlistView = document.createElement('div');
	playlistView.classList.add('playlist');
	playlistView.classList.add('item-list-item');
	// truncate title
	playlist.snippet.titleShort = playlist.snippet.title.length > 30 ? playlist.snippet.title.slice(0, 30) + '...' : playlist.snippet.title;
	playlistView.innerHTML = `
		<img src="${playlist.snippet.thumbnails.medium.url}" />
		<h3>${playlist.snippet.titleShort}</h3>
	`;
	playlistView.addEventListener('click', () => {
		document.getElementById('playlist-view-title').innerText = playlist.snippet.title;
		loadPlaylistView(playlist);
	});
	return playlistView;
};

_ytm.onData('request_playlists', (playlists) => {
	playlists = playlists[0];
	_userData.playlists = playlists;
	const playlistsView = document.getElementById('playlists');
	playlists.forEach(playlist => {
		const playlistView = createPlaylistView(playlist);
		playlistsView.appendChild(playlistView);
	});
});

_ytm.on('message', (message) => {
	const {data, args} = JSON.parse(message.data);
	if(_ytm.dataCallbacks[data]) {
		_ytm.dataCallbacks[data](args);
	}
	console.log(`Received message: ${data} args ${args}`);
});

// When the page is loaded
window.onload = () => {
    const audioSrc = localStorage.getItem('audioSrc');
    const audioTime = localStorage.getItem('audioTime');
    const audioPaused = localStorage.getItem('audioPaused');

    if (audioSrc) {
		_ytm.globalAudio = new Audio();
        _ytm.globalAudio.src = audioSrc;
        _ytm.globalAudio.currentTime = audioTime || 0;
        if (audioPaused === 'false') {
            _ytm.globalAudio.play();
        }
		document.getElementById('play').innerText = _ytm.globalAudio.paused ? 'Play' : 'Pause';
		const details = JSON.parse(localStorage.getItem('plr-details'));
		if(details) {
			setNowPlaying(details.title, details.artist, _ytm.globalAudio);
			_ytm.nowPlaying = {snippet: {title: details.title, videoOwnerChannelTitle: details.artist}};
			_ytm.send('grab_lyrics', {title: details.title, videoOwnerChannelTitle: details.artist});
		}
		updateProgress();
    }
};
// When the page is about to be unloaded
window.onbeforeunload = () => {
    if (_ytm.globalAudio) {
        localStorage.setItem('audioSrc', _ytm.globalAudio.src);
        localStorage.setItem('audioTime', _ytm.globalAudio.currentTime);
        localStorage.setItem('audioPaused', _ytm.globalAudio.paused);
		localStorage.setItem('plr-details', JSON.stringify({title: document.getElementById('player-info-title').innerText, artist: document.getElementById('player-info-artist').innerText}));
    }
};
