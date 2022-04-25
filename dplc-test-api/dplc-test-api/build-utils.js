const { task, exec, stream }  = require('gulp-execa');
const yaml = require('js-yaml');
const fs = require('fs');
const through = require('through2');

/**
 * Generate the local build number
 * @majorVersion Major version number
 * @minorVersion Minor version number
 */
_generateBuildNumber = function(majorVersion, minorVersion) {

    // Get the current date
    var now = new Date();

    // Return the build number
    return majorVersion + "." +
        minorVersion + "." +
        now.getFullYear().toString().substring(2) + ('0' + (now.getMonth() + 1)).slice(-2) + ('0' + now.getDate()).slice(-2) + "." +
        ('0' + (now.getHours() + 1)).slice(-2) + ('0' + now.getMinutes()).slice(-2) + ('0' + now.getSeconds()).slice(-2) + "-local";
};

/**
 * Parse the gulp command line arguments
 * @argList Gulp process arguments
 */
_parseArgs = function(argList) {

    // Method variables
    var arg = {}, opt, thisOpt, curOpt;

    // Process arguments
    for (var index = 0; index < argList.length; index++) {

        thisOpt = argList[index].trim();
        opt = thisOpt.replace(/^\-+/, '');

        if (opt === thisOpt) {
            // argument value
            if (curOpt) arg[curOpt] = opt;
            curOpt = null;

        }
        else {
            // argument name
            curOpt = opt;
            arg[curOpt] = true;

        }
    }

    // Return arguments
    return arg;
};

/**
 * Execute a command
 */
 var _exec = async function (cmd, userOptions) {

  // Assert command
  if(cmd === null || typeof(cmd) === 'undefined') {
    throw "Command is missing"
  }

  // Init options
  var options = Object.assign({
    echo : false,
    verbose: false
  }, userOptions);

  // Get the display text
  var displayCmd = cmd.replace(/\s\s+/g, ' ');

  // Display the command
  console.log(`\x1b[33m${displayCmd}\x1b[0m`);

  // Execute the command
  await exec(displayCmd, options);
}

/**
 * Replace the file contens with the property values
 * @param {*} fileContents 
 * @param {*} properties 
 */
 replaceProperties = function(fileContents, properties) {

    // Init new file contents
    var newFileContents = fileContents;
  
    // Build flat properties array
    var propertiesArray = propertiesToArray(properties);
  
    // Show propertie
    for (var propertyName in propertiesArray) {
  
      // Get the property value
      var propertyValue = propertiesArray[propertyName];
  
      // Split file contents into chunks and insert the new property value
      var chunks = newFileContents.split("{" + propertyName + "}");
      newFileContents = chunks.join(propertyValue);
    }
  
    // Return the result
    return newFileContents; 
  };

  /**
 * Function used to replace properties inside a pipe
 * @param {} propertiesArray 
 */
var _replacePropertiesTransformation = function(propertiesArray) {

    // Handle transformation
    return through.obj(function (file, enc, callback) {
  
      // Assert empty file or directory
      if (file === null || file.isDirectory()) {
        this.push(file);
        return callback();
      }
  
      // Assert buffer
      if (!file.isBuffer()) {
        
          // Emit error
          this.emit('error', new PluginError(
            'replace-properties',
            'Only Buffer format is supported'));
  
          // Return
          return callback();
      }
  
      // Get new files contents with properties replaced
      var newFileContents = replaceProperties(String(file.contents), propertiesArray)
      //file.contents = new Buffer(newFileContents);
      file.contents = Buffer.from(newFileContents);
      
      // Return the file
      callback(null, file);
    });
  };
  
  /**
   * Convert object properties to a keyed array
   */
  function propertiesToArray(properties) {
  
    // Init the array
    var propertiesArray = [];
  
    // Fill with properties
    fillWithProperties(propertiesArray, properties, "properties");
    
    // Return the sorted properties
    return propertiesArray.sort();
  };
  
  /**
   * Convert object properties to a keyed array
   */
  function fillWithProperties(array, value, propertyName) {
  
    // Initialize optional propertyName field
    if(propertyName === undefined) {
      throw "Invalid property name";
    }
  
    // Don't include null values
    if(value === null) {
      return;
    }
  
    // Add a property
    if(typeof value !== 'object') {
      array[propertyName] = value;
      return;
    }
  
    // Iterate property keys
    Object.keys(value).forEach(function(key) {
      fillWithProperties(array, value[key], propertyName + "." + key);
    });
  };

/**
 * Load properties from a yaml file
 * @filePath Path to a YML file
 */
 loadProperties = function(filePath) {

    return yaml.load(fs.readFileSync(filePath));
};

/**
 * Iterate each property
 * @param {} properties 
 * @param {*} callback 
 */
 function _forEachProperty(properties, callback) {

    // Build flat properties array
    var propertiesArray = propertiesToArray(properties);
  
    // Show propertie
    for (var propertyName in propertiesArray) {
  
      // Get the property value
      var propertyValue = propertiesArray[propertyName];
  
      // Callback with property name and value
      callback(propertyName, propertyValue);
    }
  }

// Export modules
exports.generateBuildNumber = _generateBuildNumber;
exports.parseArgs = _parseArgs;
exports.exec = _exec;
exports.fillWithProperties = fillWithProperties;
exports.replaceProperties = _replacePropertiesTransformation;
exports.loadProperties = loadProperties;
exports.forEachProperty = _forEachProperty;