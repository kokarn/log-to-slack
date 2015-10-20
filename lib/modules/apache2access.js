'use strict';

var moment = require( 'moment' );
var merge = require( 'merge' );

var apache2 = function( connection, options ){
    this.options = options;

    if( !this.options.lineCount ){
        this.options.lineCount = 50000;
    }

    this.messageList = [];
    this.connection = connection;
    this.response = '';
};

apache2.prototype.icon = 'http://i.imgur.com/4cCZiwS.png';
apache2.prototype.name = 'Apache2 access log';
apache2.prototype.logCommand = 'tail -n LINECOUNT /var/log/apache2/access.log | grep \'" [4-5][0-9][0-9] \'';

apache2.prototype.runCommand = function( command ){
    var _this = this;
    var parsedCommand = command.replace( "\'", "'" ).replace( 'LINECOUNT', this.options.lineCount );

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

apache2.prototype.shouldSkipMessage = function( message ){
    var data = this.getMessageData( message );
    var i;

    // Check if we are skipping some status codes
    if( this.options.skipCodes && this.options.skipCodes.length > 0 ){
        if( this.options.skipCodes.indexOf( data.statusCode ) !== -1 ){
            return true;
        }
    }

    // Check if we are skipping some files
    if( this.options.skipFiles && this.options.skipFiles.length > 0 ){
        for( i = 0; i < this.options.skipFiles.length; i = i + 1 ){
            if( message.indexOf( this.options.skipFiles[ i ] ) !== -1 ){
                return true;
            }
        }
    }

    return false;
};

apache2.prototype.getMessageData = function( string ){
    var parts = string.match( /(.+?)\s(\-|\"\")\s(\-|\"\")\s\[(.+?)\]\s\"(.+?)\"\s([0-9]{3})\s(\d+)\s\"(.+?)\"\s\"(.+?)\"/ );

    if( parts === null ){
        console.log( string );
        return false;
    }

    var requestData = {
        ip: parts[ 1 ],
        dateTime: parts[ 4 ],
        request: parts[ 5 ],
        statusCode: parseInt( parts[ 6 ], 10 ),
        responseSize: parseInt( parts[ 7 ], 10 ),
        referer: parts[ 8 ],
        userAgent: parts[ 9 ]
    };

    return requestData
};

apache2.prototype.getMessageInfo = function( message ){
    var requestData = this.getMessageData( message );

    var messageInfo = {
        title: requestData.statusCode,
        message: requestData.request,
        extraFields: [],
        severity: 0
    };

    switch( requestData.statusCode ){
        case 500:
            // Falls through
        case 503:
            messageInfo.severity = 3;
            break;
        case 414:
            messageInfo.severity = 2;
            break;
        case 404:
            messageInfo.severity = 1;
            break;
    }

    // Add timestamp field
    messageInfo.extraFields.push({
        title: 'Time',
        value: moment( requestData.dateTime, 'DD/MMM/YYYY:HH:mm:ss ZZ' ).format( 'HH:mm:ss' ),
        short: true
    });

    // Add ip field
    messageInfo.extraFields.push({
        title: 'IP',
        value: requestData.ip,
        short: true
    });

    if( requestData.referer.length > 1 ){
        messageInfo.extraFields.push({
            title: 'Referer',
            value: requestData.referer
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

        if( this.shouldSkipMessage( messages[ i ] )){
            // Don't include rows we want to skip
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
