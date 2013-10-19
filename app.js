var RaspiCam = require("raspicam"),
	colors = require("colors"),
	Spacebrew = require('./sb-1.3.0').Spacebrew,
	sb,
	camera,
	config = require("./machine"),
	fs = require("fs");


var image_path = __dirname + "/files/";


// setup spacebrew
sb = new Spacebrew.Client( config.server, config.name, config.description );  // create spacebrew client object


// create the spacebrew subscription channels
//sb.addPublish("config", "string", "");	// publish config for handshake
//sb.addSubscribe("config", "boolean");	// subscription for config handshake


sb.addSubscribe("capture button", "boolean");	// subscription for taking snapshot
sb.addSubscribe("test button", "boolean");		// subscription for sending test snapshot


sb.addPublish("image", "binary");		// publish the serialized binary image data


sb.onBooleanMessage = onBooleanMessage;	
sb.onOpen = onOpen;

// connect to spacbrew
sb.connect();  


/**
 * Function that is called when Spacebrew connection is established
 */
function onOpen() {
	console.log( "Connected through Spacebrew as: " + sb.name() + "." );

	// initialize RaspiCam timelapse
	camera = new RaspiCam({
		mode: "photo",
		output: image_path + "image.png", // will change this before taking a picture
		encoding: "png",
		width: 640,
		height: 480,
		timeout: 0 // take snapshot immediately with 0 delay
	});

	camera.on("start", function( err, timestamp ){
		//console.log("snapshot taken at " + timestamp);
	});


	/*
	camera.on("read", function( err, timestamp, filename ){
		console.log("snapshot taken with filename: " + filename);

		setTimeout(function(){
			fs.readFile(image_path + filename, function(err, data) {
				if(err){
					console.log('Error attempting to read captured file with msg: '+ err);
					return false;
				}
				var base64data = data.toString('base64');
				console.log('sending base 64 with length' + base64data.length);

				var message = {
					filename: filename,
					binary: base64data
				};

				sb.send("image", "binary", message.toString('base64'));
			});
		}, 2000);
	});
	*/


	camera.on("read", function( err, timestamp, filename ){
		if(err){
			console.log('Error camera read emitted with message : '+ err);
			return false;
		}
		console.log("snapshot taken with filename: " + filename);
		if(filename.charAt(filename.length-1) != "~"){

			setTimeout(function(){
				fs.readFile(image_path + filename, function(err, data) {
					if(err){
						console.log('Error attempting to read captured file with msg: '+ err);
						return false;
					}
					var base64data = data.toString('base64');

					var message = {
						filename: filename,
						binary: base64data,
						encoding: "png"
					};

					console.log('sending image with filename: ' + message.filename );

					sb.send("image", "binary", JSON.stringify( message ) );
				});
			}, 2000);
		}
			
	});

	camera.on("exit", function( timestamp ){
		console.log("snapshot child process has exited");
	});

	camera.on("stop", function( err, timestamp ){
		console.log("snapshot child process has been stopped at " + timestamp);
	});

}



/**
 * onStringMessage Function that is called whenever new spacebrew string messages are received.
 *          It accepts two parameters:
 * @param  {String} name    Holds name of the subscription feed channel
 * @param  {String} value 	Holds value received from the subscription feed
 */
function onBooleanMessage( name, value ){

	console.log("[onBooleanMessage] value: " + value + " name: " + name);

	switch(name){
		case "config":
			console.log([
		      // Timestamp
		      String(+new Date()).grey,
		      // Message
		      String("sending config").cyan
		    ].join(" "));

			sb.send("config", "string", JSON.stringify( config ) );//or toString()?
			break;
		case "capture button":
			if(value == true){
				console.log([
			      // Timestamp
			      String(+new Date()).grey,
			      // Message
			      String("starting camera").magenta
			    ].join(" "));

				//change output filename to current timestamp
				var timestamp_filename = new Date().getTime() + ".png";
				camera.set("output", image_path + timestamp_filename);

				// start timelapse
				camera.start();
			}	
			break;
		case "test button":
			if(value == true){
				console.log("calling test");
				fs.readFile(image_path + "test/test.png", function(err, data) {
					var base64data = data.toString('base64');
					console.log('sending base 64 with length' + base64data.length);

					var message = {
						filename: "test.png",
						binary: base64data
					};

					console.log('stringified:');
					console.log(JSON.stringify( message ));

					sb.send("image", "binary", JSON.stringify( message ).toString('base64'));
				});
			}
	}
}