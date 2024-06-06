module.exports = ({client, data, args, io}) => {
	args = args[0]
	let artist_name = args.videoOwnerChannelTitle.split(' - Topic')[0];
	let track_name = args.title;
	fetch('https://lrclib.net/api/search?track_name=' + track_name + '&artist_name=' + artist_name)
	.then(res=>res.json())
	.then(data => {
		client.sendData('grab_lyrics', data);
	})
};