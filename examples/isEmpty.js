var File = require ("../build/file-utils").File;

File.createTempFolder (function (error, folder){
	folder.isEmpty (function (error, isEmpty){
		console.log ("2: " + isEmpty); //Prints: true
	});
});

new File (".").isEmpty (function (error, isEmpty){
	console.log ("1: " + isEmpty); //Prints: false
});