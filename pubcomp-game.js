var net = require( 'net' ),
	config = require( './config' );

const VERSION = 1;

var socket, connected = false, logBuffer = '';

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

function processMessage( data ) {
	switch ( data.type ) {
		case 'hello':
			// Ignore for now
			break;
		case 'update':
			console.log( 'Updating from version ' + VERSION + ' to ' + data.version + ' via git...' );
			var git = require( 'child_process' ).spawn( 'git', ['pull'], {
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
