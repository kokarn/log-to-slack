'use strict';

var moment = require( 'moment' );
var merge = require( 'merge' );
var ipInString = require( './ip-in-string.js' );

var apache2 = function( connection ){
    this.messageList = [];
    this.connection = connection;
    this.response = '';
};

apache2.prototype.name = 'apache2';
apache2.prototype.icon = 'http://i.imgur.com/4cCZiwS.png';
apache2.prototype.messageCount = 100;
apache2.prototype.logCommand = 'cat /var/log/apache2/access.log | grep \'" [4-5][0-9][0-9] \'';

apache2.prototype.runCommand = function( command ){
    var _this = this;
    var parsedCommand = command.replace( "\'", "'" );

    this.connection.exec( parsedCommand, function( error, stream ) {
        if( error ) {
            throw error;
        }

        stream.on( 'close', function() {
            _this.handleResponse();
            _this.onClose( _this.messageList );
        }).on( 'data', function( data ) {
            _this.response = _this.response + String( data );
        }).stderr.on( 'data', function( data ) {
            console.log( 'STDERR: ' + data );
        });
    });
};

apache2.prototype.getMessageInfo = function( message ){
    var position;
    var checkStrings = [
        {
            string: '" 500 ',
            severity: 3
        }
    ];
    var i;
    var ip = ipInString( message );

    var messageInfo = {
        title: message.match( /" ([4-5][0-9][0-9]) / )[ 1 ],
        extraFields: [],
        severity: 0
    };

    for( i = 0; i < checkStrings.length; i = i + 1 ){
        position = message.indexOf( checkStrings[ i ].string );

        if( position !== -1 ){
            messageInfo.severity = checkStrings[ i ].severity;
        }
    }

    messageInfo.message = message.substring( message.lastIndexOf( ']' ) + 1, message.indexOf( '"', message.lastIndexOf( ']' ) + 3 )).replace( '"', '' ).trim();

    // Add timestamp field
    messageInfo.extraFields.push({
        title: 'Time',
        value: moment( message.substr( message.indexOf( '[' ) + 1, message.indexOf( ']' ) - 1 ), 'DD/MMM/YYYY:HH:mm:ss ZZ' ).format( 'HH:mm:ss' ),
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

apache2.prototype.handleResponse = function(){
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
}

apache2.prototype.getLastMessages = function( callback ){
    this.onClose = callback;

    this.runCommand( this.logCommand );
};

module.exports = apache2;
