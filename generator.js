/**
 * @module Angular 2 Generator for loopback-sdk-builder
 * @author Jonathan Casarrubias <@johncasarrubias> <github:jonathan-casarrubias>
 * @license MIT
 * @description
 * Defines a SDK Schema and builds according configuration
 */
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var rmdir = require('rimraf');
var ejs = require('ejs');
var utils = require('./utils');
var _ = require('underscore');
_.mixin(require('underscore.inflections'));
/**
 * EJS Q Filter
 * Deprecated in EJS 2 :(
 */
ejs.filters.q = (obj) => JSON.stringify(obj, null, 2);
ejs.filters.pluralize = (text) => _.pluralize(text);
/**
 * Generate Client SDK for the given loopback application.
 */
module.exports = function generate(ctx) {
  'use strict';
  // Describe models and remove those blacklisted
  ctx.models = utils.describeModels(ctx.app);
  /**
   * Directory Management
   */
  ctx.outputFolder = path.resolve(ctx.outputFolder);

  if (!ctx.quiet) {
    console.log('Removing base directory %s', ctx.outputFolder);
  }

  rmdir.sync(ctx.outputFolder);
  // Create required directories
  let directories = [
    ctx.outputFolder,
  ];
  directories.forEach(directory => mkdirp.sync(directory));
  /**
   * Fix to decide which AcccessToken to get, since usually is private, but not
   * Always, so  we need to import from the right place
   */
  ctx.loadAccessToken = (ctx.models.AccessToken ? false : true);

  if (!ctx.quiet) {
    console.log('DRIVER: ', ctx.driver);
  }

  /**
  * LoopBack SDK Builder Schema for Angular 2 and ng2native 2
  **/
  let schema = [
    {
      template: './index.ejs',
      output: '/index.ts',
      params: {
        isIo: ctx.isIo,
        models: ctx.models
      }
    },
    {
      template: './base.ejs',
      output: '/BaseModels.ts',
      params: { loadAccessToken: ctx.loadAccessToken }
    },

  ];
  /**
   * SDK DYNAMIC FILES
   */
  Object.keys(ctx.models).forEach(modelName => {
    console.info('LoopBack SDK Builder: adding %s model to SDK', modelName);
    schema.push(
      {
        template: './model.ejs',
        output: '/' + modelName + '.ts',
        params: {
          model: ctx.models[modelName],
          modelName: modelName,
          plural: ctx.models[modelName].sharedClass.ctor.settings.plural
                || ejs.filters.pluralize(modelName),
          buildPropertyType: buildPropertyType,
          buildPropertyDefaultValue: buildPropertyDefaultValue,
          buildRelationType: buildRelationType,
          buildModelImports,
          buildModelProperties
        }
      }
    );
  });
  /**
   * PROCESS SCHEMA
   */
  schema.forEach(
    config => {
      if (!ctx.quiet) {
        console.info('Generating: %s', `${ctx.outputFolder}${config.output}`);
      }

      fs.writeFileSync(
        `${ctx.outputFolder}${config.output}`,
        ejs.render(fs.readFileSync(
          require.resolve(config.template),
          { encoding: 'utf-8' }),
          config.params
        )
      )
    }
  );
  /**
   * @method buildModelImports
   * @description
   * Define import statement for those model who are related to other scopes
   */
  function buildModelImports(model) {
    let relations = getModelRelations(model);
    let loaded = {};
    let output = [];
    if (relations.length > 0) {
      relations.forEach((relationName, i) => {
        let targetClass = capitalize(model.sharedClass.ctor.relations[relationName].modelTo.sharedClass.name);
        if (!loaded[targetClass]) {
          loaded[targetClass] = true;
          output.push(`  ${targetClass}`);
        }
      });
    }
    // Add GeoPoint custom type import
    Object.keys(model.properties).forEach((property) => {
      var geoPointType = buildPropertyType(model.properties[property]);
      var hasGeoPointType = geoPointType.indexOf('GeoPoint') !== -1;
      if(hasGeoPointType) {
          output.push('  GeoPoint');
      }
    });
    if(output.length > 0) {
        var imports = output.join(',\n');
        output = [
          'import {',
          imports  + ',',
          '} from \'./index\';\n'
        ];
    }
    return output.join('\n');
  }
  /**
   * @method buildModelProperties
   * @description
   * Define properties for the given model
   */
  function buildModelProperties(model, isInterface) {
    let output = [];
    // Add Model Properties
    Object.keys(model.properties).forEach((propertyName) => {
      if (model.isUser && propertyName === 'credentials') return;
      let property = model.properties[propertyName];
      let isOptional = isInterface && !property.required ? '?' : '';
      let defaultValue = !isInterface ? ` = ${buildPropertyDefaultValue(property)}` : '';
      defaultValue = ctx.defaultValue !== 'enabled' && ctx.defaultValue !== 'strict' ? '' : defaultValue;
      defaultValue = ctx.defaultValue === 'strict' && !property.hasOwnProperty('default') ? '' : defaultValue;
      output.push(`  ${propertyName}${isOptional}: ${buildPropertyType(property)}${defaultValue};`);
    });
    // Add Model Relations
    Object.keys(model.sharedClass.ctor.relations).forEach(relation => {
      let relationType = buildRelationType( model, relation );
      let defaultTypeValue = !isInterface && ctx.defaultValue === 'enabled' && relationType.indexOf('Array') >= 0 ? ' = []' : '';
      defaultTypeValue = !isInterface && ctx.defaultValue === 'enabled' && relationType.indexOf('Array') === -1 ? ' = null' : defaultTypeValue;
      output.push( `  ${relation}${isInterface ? '?' : ''}: ${relationType}${defaultTypeValue};` );
    });
    return output.join('\n');
  }
  /**
   * @method buildRelationType
   * @description
   * Discovers property type according related models that are public
   */
  function buildRelationType(model, relationName) {
    let relation = model.sharedClass.ctor.relations[relationName];
    let basicType = capitalize(relation.modelTo.sharedClass.name);
    let finalType = relation.type.match(/(hasOne|belongsTo)/g)
      ? basicType : `${basicType}[]`;
    return finalType;
  }


  /**
   * @author João Ribeiro <jonnybgod@gmail.com, http://jonnybgod.ghost.io>,
   * @license MIT
   * @method buildPropertyType
   * @description
   * Define which properties should be passed as route params
   */
  function buildPropertyType(property) {
    if (typeof property === 'function') {
      property.type = property;
    }
    if (!property || !property.type) {
      console.log(property)
      return 'any';
    }
    switch (typeof property.type) {
      case 'function':
        switch(property.type.name) {
          case 'String':
          case 'Number':
          case 'Boolean':
            return property.type.name.toLowerCase();
          case 'Date':
          case 'GeoPoint':
            return property.type.name;
          default:
            return 'any';
        }
      case 'object':
        if(Array.isArray(property.type)) {
            return `${buildPropertyType(property.type[0])}[]`
        }
        return 'object';
      default:
        return 'any';
    }
  }
  /*
   * @author Julien Ledun <j.ledun@iosystems.fr>,
   * @license MIT
   * @method buildPropertyDefaultValue
   * @description
   * Define defaults null values for class properties
   */
  function buildPropertyDefaultValue(property) {
    let defaultValue = ( property.hasOwnProperty('default') ) ? property.default : '';
    switch (typeof property.type) {
      case 'function':
        switch(property.type.name) {
          case 'String':
            return `'${defaultValue}'`;
          case 'Number':
            return isNaN( Number(defaultValue) ) ? 0 : Number( defaultValue );
          case 'Boolean':
            return Boolean( defaultValue );
          case 'Date':
            return isNaN( Date.parse( defaultValue ) ) ? `new Date(0)` : `new Date('${defaultValue}')`;
          case 'GeoPoint':
          default:
            return "<any>null";
      }
      case 'object':
        if(Array.isArray(property.type)) {
          return "<any>[]";
        }
        return "<any>null";
      default:
        return "<any>null";
    }
  }
};

/**
* HELPERS
*/
function capitalize(string) {
  return string[0].toUpperCase() + string.slice(1);
}

function getModelRelations(model) {
  return Object.keys(model.sharedClass.ctor.relations).filter(relationName =>
    model.sharedClass.ctor.relations[relationName].modelTo.sharedClass.name &&
    model.sharedClass.ctor.relations[relationName].modelTo.sharedClass.name !== model.name
  );
}
