var AWS = require('aws-sdk');
var fs = require('fs');



function uploadOneFile(fileName, bucket, key, callback){
	var readStream = fs.createReadStream(fileName);
	var params = {Bucket: bucket, Key: key, Body: readStream};
	var options = { partSize: 5 * 1024 * 1024, queueSize: 10 };
	var s3 = new AWS.S3({ httpOptions: { timeout: 10 * 60 * 1000 }});
	s3.upload(params, options)
  	.on('httpUploadProgress', function(evt) { 
  		console.log('Completed ' + (evt.loaded * 100 / evt.total).toFixed() + '% of upload');
  	})
    .send(function(err, data) { 
		console.log('Wait while we configure...');
		callback(err);
    });
}

function upload(credentials, bucket, folder, zipFileName, zipFile, callback){
  AWS.config.update(credentials);
  uploadOneFile(zipFile, bucket, destFolder + "/" + zipFileName, callback);
}

module.exports.upload = upload;