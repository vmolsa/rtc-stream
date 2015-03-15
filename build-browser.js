var fs = require('fs');

function build() {
  var browserify = require('browserify');
  var bundler = browserify(__dirname + '/index.js');
  
  console.log('Compiling index.js -> rtc-stream.min.js');

  bundler.transform({
    global: true,
  }, 'uglifyify');

  bundler.bundle().pipe(fs.createWriteStream(__dirname + '/rtc-stream.min.js'));
}

function install() {
  var npm = require('npm');
  
  npm.load({ loaded: false }, function(error) {
    if (error) {
      throw error;
    }
    
    npm.commands.install(['browserify', 'uglifyify'], function(error, data) {
      if (error) {
        throw error;
      }
      
      build();
    });
    
    npm.on("log", function(message) {
      console.log(message);
    });
  });
}

if (!fs.existsSync(__dirname + '/node_modules/browserify') || 
    !fs.existsSync(__dirname + '/node_modules/uglifyify')) 
{
  install();
} else {
  build();
}


