'use strict';

var moment = require( 'moment' );
var merge = require( 'merge' );
var ipInString = require( './ip-in-string.js' );

var apache2 = function( connection, options ){
    this.options = options;

    if( typeof this.options.useVulnList === 'undefined' ){
        this.options.useVulnList = true;
    }

    this.messageList = [];
    this.connection = connection;
    this.response = '';
};

apache2.prototype.name = 'Apache2 error log';
apache2.prototype.icon = 'https://static.fbinhouse.se/icon-apache2-16x16.png';
apache2.prototype.messageCount = 100;
apache2.prototype.logCommand = 'tail /var/log/apache2/error.log -n';

apache2.prototype.runCommand = function( command, callback ){
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

apache2.prototype.getMessageInfo = function( message ){
    var position;
    var checkStrings = [
        {
            string: 'PHP Fatal error:',
            severity: 3
        },
        {
            string: 'PHP Catchable fatal error:',
            severity: 3
        },
        {
            string: 'Disk quota exceeded:',
            severity: 3
        },
        {
            string: 'PHP Warning:',
            severity: 2
        },
        {
            string: 'PHP Notice:',
            severity: 1
        }
    ];
    var i;
    var ip = ipInString( message );

    var messageInfo = {
        extraFields: []
    };

    for( i = 0; i < checkStrings.length; i = i + 1 ){
        position = message.indexOf( checkStrings[ i ].string );

        if( position !== -1 ){
            messageInfo.message = message.substr( position + checkStrings[ i ].string.length ).trim();
            messageInfo.severity = checkStrings[ i ].severity;
            break;
        }
    }

    if( !messageInfo.message ){
        messageInfo.message = message.substr( message.lastIndexOf( ']' ) + 1 ).trim();
        messageInfo.severity = 0;
    }

    messageInfo.title = this.severityToText( messageInfo.severity );

    // Add timestamp field
    messageInfo.extraFields.push({
        title: 'Time',
        value: moment( message.substr( 1, message.indexOf( ']' ) - 1 ), 'ddd MMM DD HH:mm:ss.SSSS YYYY' ).format( 'HH:mm:ss' ),
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

apache2.prototype.shouldSkipMessage = function( message ){
    var lowercaseMessage;
    var i;

    // Don't include empty rows
    if( message.length <= 0 ){
        return true;
    }

    // Don't include rows that doesn't start with "["
    if( message.indexOf( '[' ) !== 0 ){
        return true;
    }

    lowercaseMessage = message.toLowerCase();

    // Check if we are skipping some strings
    if( this.options.skipStrings && this.options.skipStrings.length > 0 ){
        for( i = 0; i < this.options.skipStrings.length; i = i + 1 ){
            if( lowercaseMessage.indexOf( this.options.skipStrings[ i ] ) !== -1 ){
                return true;
            }
        }
    }

    // Check if we are skipping known web vuln scanning urls
    if( this.options.useVulnList ){
        for( i = 0; i < this.vulnList.length; i = i + 1 ){
            if( lowercaseMessage.indexOf( this.vulnList[ i ] ) !== -1 ){
                return true;
            }
        }
    }

    return false;
};

apache2.prototype.handleResponse = function(){
    var messages = this.response.split( '\n' );
    var i;
    var currentObject;
    var _this = this;

    for( i = 0; i < messages.length; i = i + 1 ){
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

apache2.prototype.severityToText = function( severity ){
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

apache2.prototype.getLastMessages = function( callback ){
    var _this = this;

    this.onClose = callback;

    this.runCommand( this.logCommand + ' ' + this.messageCount, function( messageBuffer ){
        _this.response = _this.response + String( messageBuffer );
    });
};

module.exports = apache2;
