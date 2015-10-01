'use strict';

var moment = require( 'moment' );
var merge = require( 'merge' );

var symfony = function( connection, options ){
    this.options = options;

    this.messageList = [];
    this.connection = connection;
    this.response = '';
};

symfony.prototype.name = 'Symfony';
symfony.prototype.icon = 'http://findicons.com/files/icons/2773/pictonic_free/16/prog_symfony.png';
symfony.prototype.messageCount = 100;
symfony.prototype.logCommand = 'tail PATH -n';

symfony.prototype.runCommand = function( command, callback ){
    var _this = this;
    var parsedCommand = command.replace( 'PATH', this.options.path );

    this.connection.exec( parsedCommand, function( error, stream ) {
        if( error ) {
            throw error;
        }

        stream.on( 'close', function() {
            //console.log( 'Disconnected' );
            _this.handleResponse();
            _this.onClose( _this.messageList );
        }).on( 'data', function( data ) {
            callback( data );
        }).stderr.on( 'data', function( data ) {
            console.log( 'STDERR: ' + data );
        });
    });
};

symfony.prototype.getSeverity = function( message ){
    var checkStrings = [
        {
            string: 'request.CRITICAL:',
            severity: 3
        },
        {
            string: 'request.ERROR:',
            severity: 3
        }
    ];
    var i;

    for( i = 0; i < checkStrings.length; i = i + 1 ){
        if( message.indexOf( checkStrings[ i ].string ) !== -1 ){
            return checkStrings[ i ].severity;
        }
    }

    return false;
}

symfony.prototype.shouldSkipMessage = function( message ){
    if( this.getSeverity( message ) < 3 ){
        return true;
    }

    return false;
};

symfony.prototype.getMessageInfo = function( message ){
    var messageInfo = {
        severity: this.getSeverity( message ),
        extraFields: []
    };

    messageInfo.message = message.substr( message.indexOf( ']' ) + 1 );
    messageInfo.message = messageInfo.message.replace( / \[\]/g, '' ).trim();

    messageInfo.title = this.severityToText( messageInfo.severity );

    // Add timestamp field
    messageInfo.extraFields.push({
        title: 'Time',
        value: moment( message.substr( 1, message.indexOf( ']' ) - 1 ), 'YYYY-MM-DD HH:mm:ss' ).format( 'HH:mm:ss' ),
        short: true
    });

    return messageInfo;
};

symfony.prototype.handleResponse = function(){
    var messages = this.response.split( '\n' );
    var i;
    var currentObject;
    var _this = this;

    for( i = 0; i < messages.length; i = i + 1 ){
        // Don't include empty rows
        if( messages[ i ].length <= 0 ){
            continue;
        }

        // Don't include rows that doesn't start with "["
        if( messages[ i ].indexOf( '[' ) !== 0 ){
            continue;
        }

        // Find out if it's a row we should skip
        if( this.shouldSkipMessage( messages[ i ] )){
            continue;
        }

        currentObject = {
            raw: messages[ i ],
            service: this.name,
            serviceIcon: this.icon
        };

        merge( currentObject, _this.getMessageInfo( messages[ i ] ));

        _this.messageList.push( currentObject );
    }
};

symfony.prototype.severityToText = function( severity ){
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
};

symfony.prototype.getLastMessages = function( callback ){
    var _this = this;

    this.onClose = callback;

    this.runCommand( this.logCommand + ' ' + this.messageCount, function( messageBuffer ){
        _this.response = _this.response + String( messageBuffer );
    });
};

module.exports = symfony;
