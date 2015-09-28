'use strict';

var moment = require( 'moment' );
var merge = require( 'merge' );

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
    var parts = message.match( /(.+?)\s(\-|\"\")\s(\-|\"\")\s\[(.+?)\]\s\"(.+?)\"\s([0-9]{3})\s(\d+)\s\"(.+?)\"\s\"(.+?)\"/ );

    if( parts === null ){
        console.log( message );
        return false;
    }

    var requestData = {
        ip: parts[ 1 ],
        dateTime: parts[ 4 ],
        request: parts[ 5 ],
        statusCode: parts[ 6 ],
        responseSize: parts[ 7 ],
        referer: parts[ 8 ],
        userAgent: parts[ 9 ]
    };

    var messageInfo = {
        title: requestData.statusCode,
        message: requestData.request,
        extraFields: [],
        severity: 0
    };

    switch( requestData.statusCode ){
        case '500':
            messageInfo.severity = 3;
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

    if( parts[ 6 ] !== '-' ){
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
