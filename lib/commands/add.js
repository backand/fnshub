var async 				= require('async');
var	yaml 					= require('js-yaml');
var fs 						= require('fs');
var readlineSync  = require('readline-sync');
var addHelper  		= require('../helpers/add.js');

function isValidModuleName(fnhub, name){
	return name && new RegExp(fnhub.Consts.Validation.Regex.AlphanumericAndDashes).test(name);
}

function collectOptions(options, fnhub, callback){
	//interact and collect function details

	if(!options.name || !options.handler || !options.runtime){
		fnhub.logger.log(fnhub.resources.Messages.Add.Instructions);
	}

	try {
	  var doc = yaml.safeLoad(fs.readFileSync(fnhub.config.templates.module, 'utf8'));
	} 
	catch (e) {
	  fnhub.logger.error(fnhub.resources.Messages.Add.FileError, fnhub.config.templates.module);
		fnhub.logger.debug.error(e);
	  process.exit(1);
	}

	options.name = options.name || readlineSync.question(fnhub.resources.Questions.Add.Name, {
		defaultInput: doc.Metadata.Name 
	});
	if(!options.name || options.name.length === 0){
		fnhub.logger.warn(fnhub.resources.Messages.Add.NameRequired,'function name');
		options.name = readlineSync.question(fnhub.resources.Questions.Add.Name);
		if(!options.name){
			fnhub.logger.warn(fnhub.resources.Messages.Add.NameIsMust,'function name');
			process.exit(1);
		}
	}
	if (!isValidModuleName(fnhub, options.name)){
		fnhub.logger.warn(fnhub.resources.Messages.Add.NameValid);
		options.name = readlineSync.question(fnhub.resources.Questions.Add.Name, {
			defaultInput: doc.Metadata.Name,
		});
		if (!isValidModuleName(fnhub, options.name)){
			fnhub.logger.warn(fnhub.resources.Messages.Add.NameValid);
			process.exit(1);
		}
	}

	options.description = options.description || readlineSync.question(fnhub.resources.Questions.Add.Description, {
		defaultInput: doc.Description 
	});
	if(!options.description || options.description.length === 0){
		fnhub.logger.warn(fnhub.resources.Messages.Add.NameRequired,'function description');
		options.description = readlineSync.question(fnhub.resources.Questions.Add.Description);
		if(!options.description){
			fnhub.logger.warn(fnhub.resources.Messages.Add.NameIsMust,'function description');
			process.exit(1);
		}
	}
  
	if (!options.runtime){
		var runtime = fnhub.config.aws.runtime; 
		index = readlineSync.keyInSelect(runtime, fnhub.resources.Questions.Add.Runtime, {cancel: false});
		fnhub.logger.debug.log(runtime[index] + ' is enabled.');
		options.runtime = runtime[index];
	}

	//get default 
	if(!options.handler) {
		var defaultHandler = fnhub.config.aws.defaultHandler;
		options.handler = readlineSync.question(fnhub.resources.Questions.Add.Handler, {
			defaultInput: defaultHandler[index]
		});
	}

	if(!options.env){ //only ask if the object was not provided
		//get the env name, if not empty get the value, and then next env
		var envName = "";
		var firstVar = true;
		options.env = {};
		do {
			envName = readlineSync.question((firstVar) ? fnhub.resources.Questions.Add.EnvNameFirst : fnhub.resources.Questions.Add.EnvNameAnother);
			if(envName != ""){
				envValue = readlineSync.question(fnhub.resources.Questions.Add.EnvValue);
				options.env[envName] = envValue;
			}
			firstVar = false;
		}
		while (envName != "");
	}
	try{
		if(options.env && typeof options.env != "object" ) {
			options.env = JSON.parse(options.env);
		}
	}
	catch(e){
		fnhub.logger.warn(fnhub.resources.Messages.Add.EnvMustBeJSON);
		process.exit(1);
	}
	

	delete options['_'];
	callback(null, options, fnhub);
}

function results(options, fnhub, callback){
	addHelper(options, fnhub, function(err, response){
		if (err) {
      fnhub.logger.debug.error(err);
      if (err.expected && err.message) {
        fnhub.logger.error(err.message);
      }
      else {
        fnhub.logger.error(fnhub.resources.Errors.General.Unexpected);
      }
      process.exit(1);
    }
		else {
      fnhub.logger.success(fnhub.resources.Messages.Function.AfterSuccess,options.name);
      process.exit(0);
    }
	});
}

module.exports = function(options, fnhub){
	async.waterfall([
		async.constant(options, fnhub),
		collectOptions,
		results
	]);
}