module.exports = ({client, globals}) => {
	client.sendData('request_playlists', globals.userPlaylists);
};