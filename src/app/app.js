const _ytm = {
	sock: new WebSocket('ws://localhost:8080'),
	_mq: [],
	_internalSendLoop: () => {
		setInterval(() => {
			if (_ytm._mq.length > 0) {
				_ytm.sock.send(_ytm._mq.shift());
			}
		}, 1);
	},
	send: (data, ...args) => {
		_ytm._mq.push(JSON.stringify({ data, args }));
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
	queue: [],
	playlistData: [],
}
import { load } from './viewEngine.js'

load('home')

_ytm.on('open', () => {
	_ytm.send('set_client', 'com.yaytmdc', 'Yet Another YouTube Music Desktop Client');
	_ytm.send('refresh_playlists');
	_ytm.send('request_playlists');
	_ytm._internalSendLoop();
});

const viewSongDownloading = (item) => {
	document.getElementById('player-info-title').innerText = 'Downloading ' + item.snippet.title;
	document.getElementById('player-info-artist').innerText = 'Please wait...';
};

function playPause(ele) {
	if (_ytm.globalAudio.paused) {
		_ytm.globalAudio.play();
		ele.innerText = 'Pause';
	} else {
		_ytm.globalAudio.pause();
		ele.innerText = 'Play';
	}
	ele.innerText = _ytm.globalAudio.paused ? 'Play' : 'Pause';
	_ytm.send('set_now_playing', _ytm.nowPlaying);
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
	if (!audioObject.paused) {
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

_ytm.onData('exists', (exists, file) => {
	let temp = exists;
	exists = temp[0];
	file = temp[1];
	if (exists) {
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
		if (tar.target.classList.contains('downloader')) return;
		playSong(item)
	});
	return itemView;
};

const playSong = (item) => {
	_ytm.send('play_song', item.snippet.resourceId.videoId, 'src/app/music/' + item.snippet.title + '.webm');
	viewSongDownloading(item);
	_ytm.onceData('play_song', (strea) => {
		if (_ytm.globalAudio) {
			_ytm.globalAudio.pause();
			_ytm.globalAudio.remove();
			_ytm.globalAudio = null;
		}
		_ytm.send('grab_lyrics', item.snippet);
		let audio = new Audio(strea);
		if (strea == null)
			audio = new Audio('music/' + item.snippet.title + '.webm');
		_ytm.globalAudio = audio;
		_ytm.globalAudio.onplay = _ytm.globalAudio.onpause = () => {
			localStorage.setItem('audioSrc', _ytm.globalAudio.src);
			localStorage.setItem('audioTime', _ytm.globalAudio.currentTime);
			localStorage.setItem('audioPaused', _ytm.globalAudio.paused);
			localStorage.setItem('plr-details', JSON.stringify(item));
			setNowPlaying(item.snippet.title, item.snippet.videoOwnerChannelTitle, _ytm.globalAudio);
		};
		_ytm.nowPlaying = item;
		_ytm.send('set_now_playing', _ytm.nowPlaying);
		audio.play();
		updateProgress();
	});
	_ytm.queue = _ytm.playlistData.slice(_ytm.playlistData.indexOf(item) + 1);
}

let lastSong = null;
const playNext = () => {
	if (_ytm.queue.length > 0) {
		lastSong = _ytm.nowPlaying;
		const next = _ytm.queue.shift();
		playSong(next);
	}
}

const playPrev = () => {
	if (lastSong) {
		playSong(lastSong);
	}
}

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
		if (lyrics.syncedLyrics) {
			console.log(lyrics[0].syncedLyrics);
		}
	}, 250);
});


const createQueue = () => {
	if(_ytm.queue.length !== 0) return;
	_ytm.queue = _ytm.playlistData.slice(_ytm.playlistData.indexOf(_ytm.nowPlaying) + 1);
}

setInterval(() => {
	if (_ytm.globalAudio) updateProgress();
	if(_ytm.queue.length === 0) {
		document.getElementById('prev').style.display = 'none';
		document.getElementById('next').style.display = 'none';
	} else {
		document.getElementById('prev').style.display = 'block';
		document.getElementById('next').style.display = 'block';
	}
	createQueue();
}, 1000)



_ytm.on('message', (message) => {
	const { data, args } = JSON.parse(message.data);
	if (_ytm.dataCallbacks[data]) {
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
		const itm = JSON.parse(localStorage.getItem('plr-details'));
		const details = itm.snippet;
		if (details) {
			setNowPlaying(details.title, details.videoOwnerChannelTitle, _ytm.globalAudio);
			_ytm.nowPlaying = itm;
			_ytm.send('grab_lyrics', details);
			_ytm.send('set_now_playing', _ytm.nowPlaying);
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
		localStorage.setItem('plr-details', JSON.stringify(_ytm.nowPlaying));
	}
};

window.playPause = playPause;

window.playPrev = playPrev;
window.playNext = playNext;

window.YtmGlobApi = _ytm;
export {
	_ytm,
	playPause,
	createItemView
}