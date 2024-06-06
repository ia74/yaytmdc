module.exports = ({client, data, args, io}) => {
	client.yaytmdc = {client_id: args[0], client_name: args[1]};
	console.log('Client', client.yaytmdc.client_id, 'set as', client.yaytmdc.client_name);
};