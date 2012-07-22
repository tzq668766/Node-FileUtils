var File = require ("../build/file-utils").File;

var settings = {
	prefix: "foo",
	suffix: "bar",
	directory: "."
};

File.createTempFolder (settings, function (error, folder){
	console.log (folder.toString ()); //Prints: foo<random number>bar
});