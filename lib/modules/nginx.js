'use strict';

var moment = require( 'moment' );
var merge = require( 'merge' );

var nginx = function( connection, options ){
    this.options = options;
    this.messageList = [];
    this.connection = connection;
    this.response = '';
};

nginx.prototype.name = 'nginx error log';
nginx.prototype.icon = 'https://static.fbinhouse.se/icon-nginx-16x16-improved.png';
nginx.prototype.messageCount = 100;
nginx.prototype.logCommand = 'tail /var/log/nginx/error.log -n';

nginx.prototype.runCommand = function( command, callback ){
    var _this = this;

    this.connection.exec( command, function( error, stream ) {
        if( error ) {
            throw error;
        }

        stream.on( 'close', function() {
            _this.handleResponse();
            _this.onClose( _this.messageList );
        }).on( 'data', function( data ) {
            callback( data );
        }).stderr.on( 'data', function( data ) {
            console.log( 'STDERR: ' + data );
        });
    });
};

nginx.prototype.getMessageInfo = function( message ){
    var position;
    var checkStrings = [
        {
            string: '[emerg]',
            severity: 3
        },
        {
            string: '[crit]',
            severity: 3
        },
        {
            string: '[alert]',
            severity: 2
        },
        {
            string: '[error]',
            severity: 2
        },
        {
            string: '[notice]',
            severity: 1
        }
    ];
    var i;
    var clientPosition;
    var ip = false;

    var messageInfo = {
        extraFields: []
    };

    for( i = 0; i < checkStrings.length; i = i + 1 ){
        position = message.indexOf( checkStrings[ i ].string );

        if( position !== -1 ){
            messageInfo.severity = checkStrings[ i ].severity;
            break;
        }
    }

    messageInfo.message = message.substr( message.indexOf( ':', position ) + 1 ).trim();

    clientPosition = messageInfo.message.indexOf( ', client:' );

    if( clientPosition > -1 ){
        ip = messageInfo.message.substring( clientPosition + 10 , messageInfo.message.indexOf( ',', clientPosition + 1 ));

        // Strip the ending of the message
        messageInfo.message = messageInfo.message.substr( 0, clientPosition );
    }

    messageInfo.title = this.severityToText( messageInfo.severity );

    // Add timestamp field
    messageInfo.extraFields.push({
        title: 'Time',
        value: moment( message.substr( 0, message.indexOf( '[' ) - 1 ), 'YYYY/mm/dd HH:mm:ss' ).format( 'HH:mm:ss' ),
        short: true
    });

    // Add ip field
    if( ip ){
        messageInfo.extraFields.push({
            title: 'IP',
            value: ip,
            short: true
        });
    }

    return messageInfo;
};

nginx.prototype.handleResponse = function(){
    var messages = this.response.split( '\n' );
    var i;
    var currentObject;
    var _this = this;

    for( i = 0; i < messages.length; i = i + 1 ){
        // Don't include empty rows
        if( messages[ i ].length <= 0 ){
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

nginx.prototype.severityToText = function( severity ){
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

nginx.prototype.getLastMessages = function( callback ){
    var _this = this;

    this.onClose = callback;

    this.runCommand( this.logCommand + ' ' + this.messageCount, function( messageBuffer ){
        _this.response = _this.response + String( messageBuffer );
    });
};

module.exports = nginx;
