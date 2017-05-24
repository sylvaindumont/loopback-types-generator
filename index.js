#!/usr/bin/env node

require('ts-node/register');
var path = require('path');
var generator = require('./generator');

var appFile = path.resolve(process.argv[2]);
var app = require(appFile);

var context = {
  app: app,
  framework: 'angular2',
  moduleName: 'sdk',
  apiUrl: '/api',
  outputFolder: process.argv[3],
  isIo: 'disabled',
  driver: 'ng2web',
  wipe: 'disabled',
  defaultValue: 'disabled',
  fireloopOnly: 'disabled',
  quiet:  false
};


app.once('booted', runGenerator);

function runGenerator() {
  // Load Selected Generator

  //try {
  generator(context);

  if (!context.quiet) {
    console.info('\n\nEnjoy!!!');
  }

  //} catch (err) {
  //  throw new Error(err);
  //}
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
