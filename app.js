var RaspiCam = require("raspicam"),
	colors = require("colors"),
	Spacebrew = require('./sb-1.3.0').Spacebrew,
	sb,
	camera,
	image_timestamp,
	config = require("./machine"),
	fs = require("fs");


var image_path = __dirname + "/files/";

var IMAGE_TTL = 40000;//time after which to delete image


// setup spacebrew
sb = new Spacebrew.Client( config.server, config.name, config.description );  // create spacebrew client object


// create the spacebrew subscription channels
//sb.addPublish("config", "string", "");	// publish config for handshake
//sb.addSubscribe("config", "boolean");	// subscription for config handshake


sb.addSubscribe("capture", "boolean");	// subscription for taking snapshot
//sb.addSubscribe("stop", "boolean");	// subscription for stopping snapshopt


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

	image_timestamp = new Date().getTime();//temporary timestamp
	console.log("connected at: " + image_timestamp + "\n");

	// initialize RaspiCam timelapse
	camera = new RaspiCam({
		mode: "photo",
		output: image_path + "image.png", // will change this before taking a picture
		encoding: "png",
		width: 640,
		height: 480,
		//colfx: "128:128", //greyscale
		timeout: 0 // take snapshot immediately with 0 delay
	});

	camera.on("start", function( err, timestamp ){
		console.log([
			// Timestamp
			String(+new Date()).grey,
			// Message
			String("CAMERA emitted START at ").green,
			timestamp.grey
		].join(" "));
	});

	camera.on("read", function( err, timestamp, filename ){
		console.log([
			// Timestamp
			String(+new Date()).grey,
			// Message
			String("CAMERA emitted READ with ").green,
			filename,
			timestamp.grey
		].join(" "));

		//don't trigger on provisional file with trailing ~
		if(filename.charAt(filename.length-1) != "~"){

			setTimeout(function(){
				console.log("calling readfile with: " + image_path + filename);

				fs.readFile(image_path + filename, function(err, data) {
					var base64data = data.toString('base64');
					console.log('sending base 64 with length' + base64data.length);

					var message = { 
						filename: filename,
						image_timestamp: image_timestamp,
						binary: base64data,
						encoding: "png"
					};

					console.log('sending image with filename: ' + message.filename );
					sb.send("image", "binary", JSON.stringify( message ) );

					if(IMAGE_TTL > 0){
						//delete file after 40s
						setTimeout(function(){
							fs.unlink(image_path + filename, function (err) {
								if (err){
									console.log("Error attempting to delete: " + image_path + filename );
									return false;
								}
								console.log("Deleted: " + image_path + filename );

							});
						}, IMAGE_TTL);
					}
					
				});
			}, 2000);
		}
		
			
	});


	camera.on("exit", function( timestamp ){
		console.log([
			// Timestamp
			String(+new Date()).grey,
			// Message
			String("CAMERA EXITED at ").green,
			timestamp.grey
		].join(" "));
	});

	camera.on("stop", function( err, timestamp ){
		console.log([
			// Timestamp
			String(+new Date()).grey,
			// Message
			String("CAMERA emitted STOP at ").green,
			timestamp.grey
		].join(" "));
	});

}



/**
 * onStringMessage Function that is called whenever new spacebrew string messages are received.
 *          It accepts two parameters:
 * @param  {String} name    Holds name of the subscription feed channel
 * @param  {String} value 	Holds value received from the subscription feed
 */
function onBooleanMessage( name, value ){
	console.log([
		// Timestamp
		String(+new Date()).grey,
		// Message
		String("+++++++ RECEIVED from controller:").cyan,
		name.grey,
		value
	].join(" "));

	switch(name){
		case "capture":
			if(value == true){
				image_timestamp = new Date().getTime();

		    	var image_name = image_timestamp + "." + camera.get("encoding");

		    	console.log([
			      // Timestamp
			      String(+new Date()).grey,
			      // Message
			      String("starting camera with filename:").blue,
			      camera.get("output")
			    ].join(" "));

		    	// take snapshot
				camera.start();
			    	
			}	
		case "stop":
			if(value == true){
				console.log([
			      // Timestamp
			      String(+new Date()).grey,
			      // Message
			      String("stopping camera").magenta
			    ].join(" "));

				// stop timelapse
				//camera.stop();
			}
			break;
	}
}