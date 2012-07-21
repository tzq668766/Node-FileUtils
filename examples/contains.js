var File = require ("../build/file-utils").File;

new File ("..").contains ("file-utils.js", function (error, found){
	console.log (found); //Prints: true
});