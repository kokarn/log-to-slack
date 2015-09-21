'use strict';

var sshClient = require( 'ssh2' ).Client;
var Slack = require( 'slack-node' );
var chalk = require( 'chalk' );

var apache2 = require( './modules/apache2.js' );
var config;
var servers;
var slackClient;
var allClasses = [];

try {
    config = require( 'config' );
} catch ( error ){
    throw error;
}

allClasses.apache2 = function( connection ){
    return new apache2( connection );
}

function printErrorAndExit( message ){
    console.log( chalk.red( message ));
    process.exit();
}

function severityToText( severity ){
    switch( severity ){
        case 3:
            return 'danger';
        case 2:
            return 'warning';
        case 1:
            return 'notice';
        case 0:
            // Fall through
        default:
            return 'unknown';
    }
}

function sendToSlack( server, messageData ){
    var sendData = {
        channel: config.get( 'slackChannel' ),
        username: config.get( 'slackUsername' ),
        icon_url: config.get( 'slackIconUrl' ),
        attachments: [
            {
                title: server.host + ' – ' + severityToText( messageData.severity ),
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

    sendData.attachments = JSON.stringify( sendData.attachments );

    console.log( sendData );

    slackClient.api( 'chat.postMessage', sendData, function( error, response ){
        if( error ){
            throw error;
        }

        if( !response.ok ){
            printErrorAndExit( 'Sending to Slack failed with this error: ' + response.error );
        }

        console.log( response );
    });
}

function findNewMessages( serverIndex, newMessages ){
    var index;
    var firstNewMessageIndex = false;

    if( typeof servers[ serverIndex ].messages === 'undefined' ){
        servers[ serverIndex ].messages = newMessages;
    }

    for( index = newMessages.length - 1; index >= 0; index = index - 1 ){
        if( servers[ serverIndex ].messages.some( function( currentMessage ) {
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
        servers[ serverIndex ].messages = newMessages;
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

function factory( klass, connection ){
    if( !allClasses[ klass ] ){
        throw new Error( 'Bad name!' );
    }

    return allClasses[ klass ]( connection );
}

function loadServerLogs(){
    servers.forEach( function( serverData, index ){
        if( serverData.services.length < 1 ){
            console.log( chalk.yellow( serverData.host + ' has no services defined, skipping' ));
            return false;
        }

        connectToServer( serverData.host, serverData.username, serverData.password, function( connection ){
            var servicesDone = 0;

            serverData.services.forEach( function( serviceName ){
                var service = factory( serviceName, connection );
                var newMessages = [];
                var i;

                console.log( 'Checking ' + serverData.host );

                service.getLastMessages( function( messages ){
                    for( i = 0; i < messages.length; i = i + 1 ){
                        newMessages.push( messages[ i ] );
                    }

                    // TODO: Find out why newMessages from apache2 is 0 length sometimes
                    if( newMessages.length > 0 ){
                        findNewMessages( index, newMessages );
                    }

                    servicesDone = servicesDone + 1;

                    if( servicesDone === serverData.services.length ){
                        connection.end();
                    }
                });
            })
        });
    });
}

function start(){
    if( !config.has( 'servers' )){
        printErrorAndExit( 'Config does not have any servers, please edit config/default.json' );
    }

    if( !config.has( 'slackApiToken' ) || config.get( 'slackApiToken' ).length <= 0 ){
        printErrorAndExit( 'Could not find a valid slackApiToken in config. Are you sure it is set in config/default.json?' );
    }

    if( !config.has( 'checkInterval' ) || config.get( 'checkInterval' ).length <= 0 ){
        printErrorAndExit( 'Could not find a valid checkInterval in config. Are you sure it is set in config/default.json?' );
    }

    slackClient = new Slack( config.get( 'slackApiToken' ));

    slackClient.api( 'api.test', function( error, response ){
        if( error ){
            console.log( error );
        }

        if( !response.ok ){
            printErrorAndExit( 'Invalid slackApiToken. Are you sure it is set correctly in config/default.json?' );
        }
    });

    servers = config.get( 'servers' );

    loadServerLogs();

    setInterval( loadServerLogs, config.get( 'checkInterval' ));
}

module.exports.start = start;
