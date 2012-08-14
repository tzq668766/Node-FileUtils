var File = require ("../build/file-utils").File;

console.log ("<" + new File ("test.js").getExtension () + ">"); //Prints: <js>
console.log ("<" + new File ("test.").getExtension () + ">"); //Prints: <> (empty string)
console.log ("<" + new File ("test...").getExtension () + ">"); //Prints: <> (empty string)
console.log ("<" + new File ("test.test.js").getExtension () + ">"); //Prints: <js>
console.log ("<" + new File ("test").getExtension () + ">"); //Prints: <> (empty string)
console.log ("<" + new File ("").getExtension () + ">"); //Prints: <> (empty string)