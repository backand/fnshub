var cf = require('../index');
var util = require('util');
var fs      = require('fs');
var path    = require('path');
var createHelper    = require('./create');

function ifStackNotExistsCreate(options, fnhub, callback){
    if (!isStackExists(options, fnhub)){
        createStack(options, fnhub, function(err){
            if (err) callback(err);
            else callback(null, options, fnhub);    
        });
    }
    else {
        callback(null, options, fnhub);
    }
}

function createStack(options, fnhub, callback){
    var options = {name: path.basename(process.cwd()), description:''};
    createHelper.create(options, fnhub, callback);
}

function isStackExists(options, fnhub){
    return fs.existsSync(path.join(process.cwd(), cf.Consts.Defaults.Stack.FileName));
}

function getModuleInfo(options, fnhub, callback){
    fnhub.info.getModule(options.module, options.version, fnhub, function(err, moduleInfo) {
        if (err) {
            if (err.data && err.data.errorMessage == "Not found") {
                callback({message:cf.Errors.Include.ModuleNotFound, expected:true});
            }
            else {
                callback(err);
            }
        }
        else callback(null, options, fnhub, moduleInfo);
    })
}

function getFunctionTemplate(options, fnhub, moduleInfo, callback) {
    try {
        var functionTemplate = cf.getFunctionTemplate(fnhub);
        callback(null, options, fnhub, moduleInfo, functionTemplate);
    }
    catch (err) {
        callback(err, null);
    }
}

function getStack(options, fnhub, moduleInfo, functionTemplate, callback){
    try {
        var stack = cf.getStack(fnhub);
        callback(null, options, fnhub, moduleInfo, functionTemplate, stack);
    }
    catch (err) {
        callback({message:cf.Errors.Include.StackNotExistsOrCorrupted, expected:true}, null);
    }
}

function replaceAll(fnhub, target, search, replacement) {
    return target.replace(new RegExp(search, 'g'), replacement);
};

function GetAlphNumeric(target) {
    return replaceAll(null, target, '-', '');
};

function cloneAndReplacePlaceHolders(fnhub, functionTemplate, stackName, moduleName, functionName){
    var json = JSON.stringify(functionTemplate);

    json = replaceAll(fnhub, json, cf.Consts.Template.StackName, stackName);
    json = replaceAll(fnhub, json, cf.Consts.Template.ModuleName, moduleName);
    json = replaceAll(fnhub, json, cf.Consts.Template.FunctionName, functionName);
    json = replaceAll(fnhub, json, cf.Consts.Template.StackNameAN, GetAlphNumeric(stackName));
    json = replaceAll(fnhub, json, cf.Consts.Template.ModuleNameAN, GetAlphNumeric(moduleName));
    json = replaceAll(fnhub, json, cf.Consts.Template.FunctionNameAN, GetAlphNumeric(functionName));
    json = replaceAll(fnhub, json, cf.Consts.Template.PathPart, functionName);
    json = replaceAll(fnhub, json, cf.Consts.Template.StageName, cf.Consts.Template.Stage);
    json = replaceAll(fnhub, json, cf.Consts.Template.HttpMethod, cf.Consts.Template.Any);

    return JSON.parse(json);
}

function copyModuleInfoIntoFunctionTemplate(options, fnhub, moduleInfo, resource, functionTemplate, stack, functionName) {
    var moduleName = moduleInfo.Metadata.Name;
    var stackName = stack.Metadata.Name;
    
    var functionStack = cloneAndReplacePlaceHolders(fnhub, functionTemplate, stackName, moduleName, functionName);   
    var functionResourceName = GetAlphNumeric(stackName) + GetAlphNumeric(moduleName) + GetAlphNumeric(functionName) + 'Function';
    var functionResource = functionStack.Resources[functionResourceName];

    functionResource.Properties.Code.S3Bucket = fnhub.getS3Bucket(resource.Properties.CodeUri) || '';
    functionResource.Properties.Code.S3Key = fnhub.getS3Key(resource.Properties.CodeUri) || '';
    functionResource.Properties.Description = resource.Properties.Description || '';
    functionResource.Properties.Handler = resource.Properties.Handler || '';
    functionResource.Properties.Runtime = resource.Properties.Runtime || '';
    functionResource.Properties.Environment = resource.Properties.Environment || {};
    
    return functionStack;
}

function isFunction(resource) {
    return resource.Type == 'AWS::Serverless::Function';
}

function copyFunctionResourcesIntoStack(fnhub, stack, functionStack) {
    if (!stack.Resources) stack.Resources = {};
        
    // iterate through the function resources
    fnhub._.forOwn(functionStack.Resources, function(resource, resourceName) { 
        // Check that the resource does not already exist in the stack
        if (stack.Resources.hasOwnProperty(resourceName))
            throw new Error({message:util.format(cf.Errors.Include.ResourceAlreadyExists, resourceName), expected:true});
        
        stack.Resources[resourceName] = resource;
    });
}


function copyFunctionOutputsIntoStack(fnhub, stack, functionStack) {
    if (!stack.Outputs) stack.Outputs = {};

    // iterate through the function outputs
    fnhub._.forOwn(functionStack.Outputs, function(output, outputName) { 
        // Check that the resource does not already exist in the stack
        if (stack.Resources.hasOwnProperty(outputName))
            throw new Error({message:util.format(cf.Errors.Include.OutputAlreadyExists, outputName), expected:true});
        
        stack.Outputs[outputName] = output;
    });
}


function copyEachFunctionInModuleIntoStack(options, fnhub, moduleInfo, functionTemplate, stack, callback) {
    try {
        // iterate through the module resources
        fnhub._.forOwn(moduleInfo.Resources, function(resource, key) { 
            // only copy resources that are function
            if (isFunction(resource)) {
                var functionStack = copyModuleInfoIntoFunctionTemplate(options, fnhub, moduleInfo, resource, functionTemplate, stack, key);
                copyFunctionResourcesIntoStack(fnhub, stack, functionStack);
                copyFunctionOutputsIntoStack(fnhub, stack, functionStack);
            }
            else {
                //  ignore resources other than functions
                fnhub.logger.warn(util.format(cf.Messages.Include.IgnoreNonFunction, key));
            }
        } );

        callback(null, options, fnhub, stack);
    }
    catch (err) {
        callback(err, null);
    }
}

function validate(options, fnhub, stack, callback){
    callback(null, options, fnhub, stack);
}

function save(options, fnhub, stack, callback){
    
    try {
		// write back stack.yaml
        var stackFileName = cf.saveStack(fnhub, stack);
		callback(null, { stackFileName: stackFileName });
    }
    catch (e) {
        fnhub.logger.debug.error(e);
        fnhub.logger.debug.error(stack);
        callback({message:fnhub.resources.Errors.General.FailedToSaveYamlFile, expected:true});
	}
}

function include(options, fnhub, callback){
    fnhub.async.waterfall([
        fnhub.async.constant(options, fnhub),
        ifStackNotExistsCreate,
        getModuleInfo,
        getFunctionTemplate,
        getStack,
        copyEachFunctionInModuleIntoStack,
        validate,
        save
    ], callback);
}

module.exports.include = include