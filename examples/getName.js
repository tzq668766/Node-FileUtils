var File = require ("../build/file-utils").File;

console.log ("<" + new File ("a/b/c").getName () + ">"); //Prints: <c>
console.log ("<" + new File ("c").getName () + ">"); //Prints: <c>
console.log ("<" + new File ("a/test.js").getName () + ">"); //Prints: <test.js>
console.log ("<" + new File ("").getName () + ">"); //Prints: <> (empty string)