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

## Available modules
* Apache2 error logs
* Apache2 access logs (4xx & 5xx)
