# Log to Slack

> Loads and parses logs from remote servers over SSH and sends new messages to a specified Slack channel

[![Dependency Status](https://david-dm.org/kokarn/log-to-slack.svg?theme=shields.io&style=flat)](https://david-dm.org/kokarn/log-to-slack)
[![devDependency Status](https://david-dm.org/kokarn/log-to-slack/dev-status.svg?theme=shields.io&style=flat)](https://david-dm.org/kokarn/log-to-slack#info=devDependencies)

## Installing

```shell
npm install -g log-to-slack
cp /path/to/node/install/config/example.json /path/to/node/install/config/default.json
vim /path/to/node/install/config/default.json
log-to-slack
```
If you are on ubuntu you might need to symlink ```node``` to ```nodejs```
http://stackoverflow.com/a/18130296/1223319
```shell
sudo update-alternatives --install /usr/bin/node node /usr/bin/nodejs 10
```

## Available options
The config file needs all the following settings

```host``` What host to use for the connection
```username``` What username to use when connecting
```password``` What password to use when connecting

## Available modules
#### Apache2 error logs
#### Apache2 access logs (4xx & 5xx)

```lineCount```: The number of lines to lookback when parsing the log
Example
```
"lineCount": 50000
```
Default: ```500000```

```skipFiles```: Array of filenames to match and skip if found.
Example
```
"skipFiles": [
    "robots.txt",
    "favicon.ico"
]
```

```skipCodes```: Array of response codes that we shouldn't report.
Example
```
"skipCodes": [
    408
]
```
#### Symfony logs
```path```: The path to the log file
Example
```
"path": "/my/path/to/my/prod.log"
```

#### nginx error logs

## Example config
```
{
    "slackApiToken": "my-slack-api-key",

    "slackChannel": "#syslog",
    "slackUsername": "Logan",
    "slackIconUrl": "http://i.imgur.com/JKDkKU0.png",

    "checkInterval": 30000,

    "servers": [
        {
            "host": "myserver.myhost.com",
            "username": "username",
            "password": "password",
            "services": {
                "apache2": true,
                "symfony": {
                    "path": "/path/to/my/prod.log"
                }
            }
        },
        {
            "host": "54.175.129.157",
            "username": "anotheruser",
            "password": "anotherpassword",
            "services": {
                "apache2": true,
                "apache2Access": {
                    "skipCodes": [
                        408
                    ],
                    "skipFiles": [
                        "favicon.ico",
                        "robots.txt"
                    ],
                    "lineCount": 50000
                }
            }
        }
    ]
}
```
