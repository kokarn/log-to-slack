'use strict';

var sshClient = require( 'ssh2' ).Client;
var Slack = require( 'slack-node' );
var chalk = require( 'chalk' );
var nconf = require( 'nconf' );

var apache2 = require( './modules/apache2.js' );
var apache2Access = require( './modules/apache2access.js' );
var symfony = require( './modules/symfony.js' );
var nginx = require( './modules/nginx.js' );

var servers;
var slackClient;
var allClasses = [];

var messages = {};

allClasses.apache2 = function( connection, options ){
    return new apache2( connection, options );
};

allClasses.apache2Access = function( connection, options ){
    return new apache2Access( connection, options );
};

allClasses.symfony = function( connection, options ){
    return new symfony( connection, options );
};

allClasses.nginx = function( connection, options ){
    return new nginx( connection, options );
};

function printErrorAndExit( message ){
    console.log( chalk.red( message ));
    process.exit();
}

function prettyPrintObject( printObject ){
    console.log( JSON.stringify( printObject, null, 4 ));
}

function sendToSlack( server, messageData ){
    var sendData = {
        channel: nconf.get( 'slackChannel' ),
        username: nconf.get( 'slackUsername' ),
        icon_url: nconf.get( 'slackIconUrl' ),
        attachments: [
            {
                title: server.host + ' – ' + messageData.title,
                author_name: messageData.service,
                author_icon: messageData.serviceIcon,
                fallback: messageData.message,
                mrkdwn_in : [ 'text' ],
                text: '```' + messageData.message + '```',
                color: '#cccccc',
                fields: messageData.extraFields
            }
        ]
    };

    switch( messageData.severity ){
        case 3:
            sendData.attachments[ 0 ].color = 'danger';
            sendData.text = '<!channel>';
            break;
        case 2:
            sendData.attachments[ 0 ].color = 'warning';
            break;
    }

    // If we are running with --debug flag, don't send to Slack
    if( nconf.get( 'debug' )){
        prettyPrintObject( sendData );
        return false;
    }

    sendData.attachments = JSON.stringify( sendData.attachments );

    slackClient.api( 'chat.postMessage', sendData, function( error, response ){
        if( error ){
            throw error;
        }

        if( !response.ok ){
            printErrorAndExit( 'Sending to Slack failed with this error: ' + response.error );
        }

        prettyPrintObject( response );
    });
}

function findNewMessages( serverIndex, newMessages, serviceIndex ){
    var index;
    var firstNewMessageIndex = false;
    var messagesSent = 0;

    if( typeof messages[ serverIndex ][ serviceIndex ] === 'undefined' ){
        messages[ serverIndex ][ serviceIndex ] = newMessages;
    }

    for( index = newMessages.length - 1; index >= 0; index = index - 1 ){
        if( messages[ serverIndex ][ serviceIndex ].some( function( currentMessage ) {
            if( currentMessage.raw === newMessages[ index ].raw ){
                return true;
            }})
        ){
            // Message exists already.
            // Because we check backwards we can break now
            break;
        } else {
            // This message did not exist
            firstNewMessageIndex = index;
        }
    }

    if( firstNewMessageIndex !== false ){
        if( nconf.get( 'debug' )){
            console.log( 'First new message index: ' + firstNewMessageIndex );
        }

        for( index = firstNewMessageIndex; index < newMessages.length; index = index + 1 ){
            sendToSlack( servers[ serverIndex ], newMessages[ index ] );
            messagesSent = messagesSent + 1;

            // Limit sending to 10 messages so we don't spam too much
            if( messagesSent >= 10 ){
                break;
            }
        }

        // Update the server messages to the most recent
        messages[ serverIndex ][ serviceIndex ] = newMessages;
    }
}

function connectToServer( host, username, password, callback ){
    var connection = new sshClient();

    connection.on( 'ready', function() {
        //console.log( 'Connected' );
        callback( connection );
    })
    .on( 'error', function( error ){
        // handle errors?
        console.log( error );
    })
    .on( 'end', function(){
        //console.log( 'Disconnected' );
    })
    .on( 'close', function( hadError ){
        var message = 'Connection closed';

        if( hadError ){
            message = message + ' due to an error.';
            console.log( message );
        }
    })
    .connect({
        host: host,
        port: 22,
        username: username,
        password: password
    });
}

function factory( klass, connection, options ){
    if( !allClasses[ klass ] ){
        throw new Error( 'Bad name!' );
    }

    return allClasses[ klass ]( connection, options );
}

function loadServerLogs(){
    servers.forEach( function( serverData, serverKey ){
        if( serverData.services.length < 1 ){
            console.log( chalk.yellow( serverData.host + ' has no services defined, skipping' ));
            return false;
        }

        if( nconf.get( 'debug' )){
            console.log( 'Opening connection to ' + serverData.host );
        }

        connectToServer( serverData.host, serverData.username, serverData.password, function( connection ){
            var servicesDone = 0;
            var totalServices = Object.keys( serverData.services ).length;

            Object.keys( serverData.services ).forEach( function( serviceKey ){
                var service = factory( serviceKey, connection, serverData.services[ serviceKey ] );
                var newMessages = [];
                var i;

                if( nconf.get( 'debug' )){
                    console.log( 'Checking ' + serviceKey + ' on ' + serverData.host );
                }

                service.getLastMessages( function( messageList ){
                    for( i = 0; i < messageList.length; i = i + 1 ){
                        newMessages.push( messageList[ i ] );
                    }

                    if( nconf.get( 'debug' )){
                        console.log( 'Got ' + newMessages.length + ' messages for ' + serviceKey + ' on ' + serverData.host );
                    }

                    // TODO: Find out why newMessages is 0 length sometimes
                    if( newMessages.length > 0 ){
                        findNewMessages( serverKey, newMessages, serviceKey );
                    }

                    servicesDone = servicesDone + 1;

                    if( servicesDone === totalServices ){
                        if( nconf.get( 'debug' )){
                            console.log( 'Closing connection to ' + serverData.host );
                        }

                        connection.end();
                    }
                });
            })
        });
    });
}

function start(){
    try {
        nconf.argv();
    } catch ( error ){
        throw error;
    }

    if( !nconf.get( 'config' )){
        printErrorAndExit( 'Missing argument "config" with a path to a config file.' );
    }

    nconf.file( nconf.get( 'config' ));

    if( !nconf.get( 'servers' )){
        printErrorAndExit( 'Config does not have any servers, please edit ' + nconf.get( 'config' ));
    }

    if( !nconf.get( 'slackApiToken' ) || nconf.get( 'slackApiToken' ).length <= 0 ){
        printErrorAndExit( 'Could not find a valid slackApiToken in config. Are you sure it is set in ' + nconf.get( 'config' ) + ' ?' );
    }

    if( !nconf.get( 'checkInterval' ) || nconf.get( 'checkInterval' ).length <= 0 ){
        printErrorAndExit( 'Could not find a valid checkInterval in config. Are you sure it is set in ' + nconf.get( 'config' ) + ' ?' );
    }

    slackClient = new Slack( nconf.get( 'slackApiToken' ));

    slackClient.api( 'api.test', function( error, response ){
        if( error ){
            console.log( error );
        }

        if( !response.ok ){
            printErrorAndExit( 'Invalid slackApiToken. Are you sure it is set correctly in ' + nconf.get( 'config' ) + ' ?' );
        }
    });

    servers = nconf.get( 'servers' );

    if( nconf.get( 'debug' )){
        console.log( chalk.yellow( 'Starting in debug mode' ));
    }

    console.log( chalk.green( 'Staring to check logs every ' + nconf.get( 'checkInterval' ) + 'ms' ));

    servers.forEach( function( serverData, serverKey ){
        Object.keys( serverData.services ).forEach( function( serviceKey ){
            if( typeof servers[ serverKey ].services[ serviceKey ] === 'boolean' ){
                servers[ serverKey ].services[ serviceKey ] = {};
            }

            messages[ serverKey ] = {};
        });
    });

    loadServerLogs();

    setInterval( loadServerLogs, nconf.get( 'checkInterval' ));
}

module.exports.start = start;
