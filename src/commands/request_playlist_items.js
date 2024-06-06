module.exports = ({client, args, globals}) => {
	const found = globals.userPlaylists.find(playlist => playlist.id === args[0]);
	if(!found) {
		console.error('Playlist not found');
		client.sendData('request_playlist_items', []);
		return;
	}
	globals.fetchPlaylistItems(found.id).then(playlistItems => {
		client.sendData('request_playlist_items', playlistItems);
	});
};