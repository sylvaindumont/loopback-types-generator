#!/usr/bin/env node

require('ts-node/register');
var path = require('path');
var generator = require('./generator');
const fs = require('fs');
const globby = require('globby');
const promisify = require('util').promisify;
var appFile = path.resolve(process.argv[2]);
var app = require(appFile);

var context = {
  app: app,
  framework: 'angular2',
  moduleName: 'sdk',
  apiUrl: '/api',
  outputFolder: process.argv[3],
  wipe: 'disabled',
  defaultValue: 'disabled',
  fireloopOnly: 'disabled',
  quiet:  false
};


app.once('booted', runGenerator);

async function runGenerator() {
	const paths = await globby([`${process.argv[3]}*.ts`]);
  await Promise.all(paths.map(path => promisify(fs.unlink)(path)));
  generator(context);
  console.log('types generated')

  // The app.js scaffolded by `slc lb project` loads strong-agent module that
  // used to have a bug where it prevented the application from exiting.
  // To work around that issue, we are explicitly exiting here.
  //
  // The exit is deferred to the next tick in order to prevent the Node bug:
  // https://github.com/joyent/node/issues/3584
  process.nextTick(function () {
    process.exit();
  });
}
