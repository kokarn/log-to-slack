# Log to Slack

> Loads and parses logs from remote servers over SSH and sends some of them to a specified Slack channel

[![Dependency Status](https://david-dm.org/kokarn/log-to-slack.svg?theme=shields.io&style=flat)](https://david-dm.org/kokarn/log-to-slack)
[![devDependency Status](https://david-dm.org/kokarn/log-to-slack/dev-status.svg?theme=shields.io&style=flat)](https://david-dm.org/kokarn/log-to-slack#info=devDependencies)

## Installing

```shell
npm install -g log-to-slack
log-to-slack --config path/to/config.json
```
If you are on ubuntu you might need to symlink ```node``` to ```nodejs```
http://stackoverflow.com/a/18130296/1223319
```shell
sudo update-alternatives --install /usr/bin/node node /usr/bin/nodejs 10
```

## Available options

### Command line
```--debug``` Run in debug mode
* Disables posting to Slack
* Outputs more stuff in the console

### Config file

```host``` What host to use for the connection
```port``` What port to use for the connection
```username``` What username to use when connecting
```password``` What password to use when connecting

[Example config file](#example-config)

## Available modules
#### Apache2 error logs
```skipStrings```: Array of strings to match and skip if found.

Example
```json
"skipStrings": [
    "robots.txt",
    "favicon.ico"
]
```
Default: ```[]```

```useVulnList```: Use [web-vuln-scan-list](https://github.com/kokarn/web-vuln-scan-list) to exclude common paths used by vulnerability scanners from showing up as errors.

Example
```json
"useVulnList": false
```
Default: ```true```

#### Apache2 access logs (4xx & 5xx)
```lineCount```: The number of lines to lookback when parsing the log.

Example
```json
"lineCount": 50000
```
Default: ```500000```

```skipStrings```: Array of strings to match and skip if found.

Example
```json
"skipStrings": [
    "robots.txt",
    "favicon.ico"
]
```
Default: ```[]```

```skipCodes```: Array of response codes that we shouldn't report.

Example
```json
"skipCodes": [
    408
]
```
Default: ```[]```

```useVulnList```: Use [web-vuln-scan-list](https://github.com/kokarn/web-vuln-scan-list) to exclude common paths used by vulnerability scanners from showing up as errors.

Example
```json
"useVulnList": false
```
Default: ```true```

#### Symfony logs
```path```: The path to the log file.

Example
```json
"path": "/my/path/to/my/prod.log"
```
Default: ```""```

```skipStrings```: Array of strings to match and skip if found.

Example
```json
"skipStrings": [
    "robots.txt",
    "favicon.ico"
]
```
Default: ```[]```

```useVulnList```: Use [web-vuln-scan-list](https://github.com/kokarn/web-vuln-scan-list) to exclude common paths used by vulnerability scanners from showing up as errors.

Example
```json
"useVulnList": false
```
Default: ```true```

#### nginx error logs
```skipStrings```: Array of strings to match and skip if found.

Example
```json
"skipStrings": [
    "robots.txt",
    "favicon.ico"
]
```
Default: ```[]```

```useVulnList```: Use [web-vuln-scan-list](https://github.com/kokarn/web-vuln-scan-list) to exclude common paths used by vulnerability scanners from showing up as errors.

Example
```json
"useVulnList": false
```
Default: ```true```

## Example config
```json
{
    "slackApiToken": "my-slack-api-key",

    "slackChannel": "#syslog",
    "slackUsername": "Logan",
    "slackIconUrl": "http://i.imgur.com/JKDkKU0.png",

    "checkInterval": 30000,

    "servers": [
        {
            "host": "myserver.myhost.com",
            "port": "myport",
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
                    "skipStrings": [
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
