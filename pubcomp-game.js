var net = require( 'net' ),
	config = require( './config' ),
	logsocket = require( './logsocket' ),
	rcon = require( './rcon' ),
	mapchooser = require( './mapchooser' ),
	tf2logparser = require('tf2logparser').TF2LogParser,
	child_process = require( 'child_process' );

const VERSION = 1;

var socket, connected = false, logBuffer = '', tf2socket, log;

function init() {
	console.log( 'Connecting to ' + config.central[1] + ':' + config.central[0] + '...' );

	socket = net.createConnection( config.central[0], config.central[1] );

	var buffer = '';

	// Recieved/sent in ascii, because JSON escapes Unicode and ascii parsing is faster
	socket.setEncoding( 'ascii' );

	socket.on( 'connect', function() {
		write( { type: 'hello', version: VERSION } );
		console.log( 'Connection successful!' );
		connected = true;
	} );

	socket.on( 'data', function( data ) {
		buffer += data;

		if ( buffer.indexOf( '\0' ) ) {
			var messages = buffer.split( '\0' );
			buffer = messages.pop();
			messages.forEach( function( message ) {
				processMessage( JSON.parse( message ) );
			} );
		}
	} );

	socket.on( 'error', console.log );

	socket.on( 'close', function( had_error ) {
		if ( had_error ) {
			console.log( 'Connection unexpectedly closed! Retrying in 60 seconds.' );

			setTimeout( init, 60000 );

			connected = false;
		}
	} );
}
init();

setInterval( function() {
	if ( logBuffer && connected ) {
		write( { type: 'log', data: logBuffer } );
		logBuffer = '';
	}
}, 1000 );

function write( data ) {
	socket.write( JSON.stringify( data ) + '\0' );
}

function startTF2() {
	// Randomize RCON password
	const rcon_chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'.split( '' );
	var rcon_password = '';
	for ( var i = 0; i < 64; i++ ) {
		rcon_password += rcon_chars[Math.floor( Math.random() * rcon_chars.length )];
	}

	log = tf2logparser.create();
	tf2socket = null;

	logsocket.create( function( line ) {
		logBuffer +=  line + '\n';
		log.parseLine( line );
		if ( !tf2socket && log.mapName )
			tf2socket = rcon.create( '127.0.0.1', config.tf2port ).password( rcon_password );
	} ).bind( 57015, '127.0.0.2' );

	console.log( 'Checking TF2 installation...' );
	var update = child_process.spawn( './update-tfds.sh', [], {
		cwd: __dirname
	} ), updateBuffer = '';
	update.stdout.setEncoding( 'ascii' );
	update.stdout.on( 'data', function( data ) {
		updateBuffer += data;
	} );
	var updateBufferTimer = setInterval( function() {
		if ( updateBuffer != '' ) {
			write( { type: 'tfdsUpdate', done: false, data: updateBuffer } );
			updateBuffer = '';
		}
	}, 1000 );
	update.on( 'exit', function( code ) {
		write( { type: 'tfdsUpdate', done: true, data: updateBuffer } );
		clearInterval( updateBufferTimer );

		// TODO Start TF2 here
	} );
}

function processMessage( data ) {
	switch ( data.type ) {
		case 'hello':
			startTF2();
			break;
		case 'update':
			console.log( 'Updating from version ' + VERSION + ' to ' + data.version + ' via git...' );
			var git = child_process.spawn( 'git', ['pull'], {
				cwd: __dirname
			} );
			git.stdout.pipe( process.stdout );
			git.stderr.pipe( process.stderr );
			git.on( 'exit', function( code ) {
				process.exit();
			} );
			break;
		default:
			console.log( data );
	}
}
