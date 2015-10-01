'use strict';

var sshClient = require( 'ssh2' ).Client;
var Slack = require( 'slack-node' );
var chalk = require( 'chalk' );
var nconf = require( 'nconf' );

var apache2 = require( './modules/apache2.js' );
var apache2Access = require( './modules/apache2access.js' );
var symfony = require( './modules/symfony.js' );

var servers;
var slackClient;
var config;
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

function getPrettyPathToConfig(){
    return __dirname.substring( 0, __dirname.lastIndexOf( 'lib' )) + 'config';
}

function printErrorAndExit( message ){
    console.log( chalk.red( message ));
    process.exit();
}

function prettyPrintObject( printObject ){
    console.log( JSON.stringify( printObject, null, 4 ));
}

function sendToSlack( server, messageData ){
    var sendData = {
        channel: config.get( 'slackChannel' ),
        username: config.get( 'slackUsername' ),
        icon_url: config.get( 'slackIconUrl' ),
        attachments: [
            {
                title: server.host + ' – ' + messageData.title,
                author_name: messageData.service,
                author_icon: messageData.serviceIcon,
                fallback: messageData.message,
                mrkdwn_in : [ 'text' ],
                text: '`' + messageData.message + '`',
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

    //prettyPrintObject( sendData );
    //return false;

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
        for( index = firstNewMessageIndex; index < newMessages.length; index = index + 1 ){
            sendToSlack( servers[ serverIndex ], newMessages[ index ] );
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

        connectToServer( serverData.host, serverData.username, serverData.password, function( connection ){
            var servicesDone = 0;
            var totalServices = Object.keys( serverData.services ).length;

            Object.keys( serverData.services ).forEach( function( serviceKey ){
                var service = factory( serviceKey, connection, serverData.services[ serviceKey ] );
                var newMessages = [];
                var i;

                console.log( 'Checking ' + serviceKey + ' on ' + serverData.host );

                service.getLastMessages( function( messageList ){
                    for( i = 0; i < messageList.length; i = i + 1 ){
                        newMessages.push( messageList[ i ] );
                    }

                    // TODO: Find out why newMessages from apache2 is 0 length sometimes
                    if( newMessages.length > 0 ){
                        findNewMessages( serverKey, newMessages, serviceKey );
                    }

                    servicesDone = servicesDone + 1;

                    if( servicesDone === totalServices ){
                        console.log( 'Closing connection to ' + serverData.host );
                        connection.end();
                    }
                });
            })
        });
    });
}

function start(){
    try {
        config = nconf.file( getPrettyPathToConfig() + '/default.json' );
    } catch ( error ){
        throw error;
    }

    if( !config.get( 'servers' )){
        printErrorAndExit( 'Config does not have any servers, please edit ' + getPrettyPathToConfig() + '/default.json' );
    }

    if( !config.get( 'slackApiToken' ) || config.get( 'slackApiToken' ).length <= 0 ){
        printErrorAndExit( 'Could not find a valid slackApiToken in config. Are you sure it is set in ' + getPrettyPathToConfig() + '/default.json?' );
    }

    if( !config.get( 'checkInterval' ) || config.get( 'checkInterval' ).length <= 0 ){
        printErrorAndExit( 'Could not find a valid checkInterval in config. Are you sure it is set in ' + getPrettyPathToConfig() + '/default.json?' );
    }

    slackClient = new Slack( config.get( 'slackApiToken' ));

    slackClient.api( 'api.test', function( error, response ){
        if( error ){
            console.log( error );
        }

        if( !response.ok ){
            printErrorAndExit( 'Invalid slackApiToken. Are you sure it is set correctly in ' + getPrettyPathToConfig() + '/default.json?' );
        }
    });

    servers = config.get( 'servers' );

    servers.forEach( function( serverData, serverKey ){
        Object.keys( serverData.services ).forEach( function( serviceKey ){
            if( typeof servers[ serverKey ].services[ serviceKey ] === 'boolean' ){
                servers[ serverKey ].services[ serviceKey ] = {};
                messages[ serverKey ] = {};
            }
        });
    });

    loadServerLogs();

    setInterval( loadServerLogs, config.get( 'checkInterval' ));
}

module.exports.start = start;
